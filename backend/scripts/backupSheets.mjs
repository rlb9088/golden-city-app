import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const require = createRequire(import.meta.url);
const {
  buildBackupPrefix,
  createR2Client,
  rowsToCsv,
  sanitizeKeySegment,
  toColumnLetter,
} = require('./backupHelpers');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getTrimmedEnv(name) {
  return String(process.env[name] ?? '').trim();
}

function getGoogleCredentials() {
  const encodedCredentials = getTrimmedEnv('GOOGLE_CREDENTIALS_BASE64');
  if (!encodedCredentials) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is required to back up Sheets.');
  }

  try {
    return JSON.parse(Buffer.from(encodedCredentials, 'base64').toString('utf8'));
  } catch (error) {
    const wrapped = new Error('Invalid GOOGLE_CREDENTIALS_BASE64 value.');
    wrapped.cause = error;
    throw wrapped;
  }
}

async function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function normalize2dValues(values = []) {
  return values.map((row) => (Array.isArray(row) ? row : [row]));
}

function buildSheetBackupKey(prefix, sheetName, extension) {
  return `${prefix}/sheets/${sanitizeKeySegment(sheetName)}.${extension}`;
}

async function loadSpreadsheetSnapshot(sheets, spreadsheetId) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties(sheetId,title,index,hidden,gridProperties)',
  });

  const sheetMeta = [...(spreadsheet.data.sheets || [])].sort((left, right) => {
    const leftIndex = left.properties?.index ?? 0;
    const rightIndex = right.properties?.index ?? 0;
    return leftIndex - rightIndex;
  });

  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    spreadsheetId,
    spreadsheetTitle: spreadsheet.data.properties?.title || null,
    sheetCount: sheetMeta.length,
    sheets: [],
  };

  for (const sheet of sheetMeta) {
    const title = sheet.properties?.title || 'Sheet';
    const columnCount = Math.max(26, sheet.properties?.gridProperties?.columnCount || 26);
    const range = `${quoteSheetName(title)}!A:${toColumnLetter(columnCount)}`;

    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values = normalize2dValues(valuesResponse.data.values || []);

    snapshot.sheets.push({
      sheetId: sheet.properties?.sheetId ?? null,
      name: title,
      index: sheet.properties?.index ?? null,
      hidden: Boolean(sheet.properties?.hidden),
      rowCount: values.length,
      columnCount: values.reduce((max, row) => Math.max(max, row.length), 0),
      values,
    });
  }

  return snapshot;
}

function buildSheetBackupArtifacts(snapshot, prefix) {
  const manifest = {
    ...snapshot,
    artifactPrefix: prefix,
    sheets: snapshot.sheets.map((sheet) => ({
      sheetId: sheet.sheetId,
      name: sheet.name,
      index: sheet.index,
      hidden: sheet.hidden,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      csvKey: buildSheetBackupKey(prefix, sheet.name, 'csv'),
    })),
  };

  const artifacts = [{
    key: `${prefix}/spreadsheet.json`,
    body: `${JSON.stringify(manifest, null, 2)}\n`,
    contentType: 'application/json; charset=utf-8',
  }];

  for (const sheet of snapshot.sheets) {
    artifacts.push({
      key: buildSheetBackupKey(prefix, sheet.name, 'csv'),
      body: `${rowsToCsv(sheet.values)}\n`,
      contentType: 'text/csv; charset=utf-8',
    });
  }

  return { manifest, artifacts };
}

async function uploadArtifact(r2Client, bucket, artifact) {
  await r2Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: artifact.key,
    Body: artifact.body,
    ContentType: artifact.contentType,
  }));
}

async function runBackupSheets(options = {}, deps = {}) {
  const spreadsheetId = String(options.spreadsheetId || getTrimmedEnv('GOOGLE_SHEET_ID')).trim();
  const dryRun = Boolean(options.dryRun);
  const date = options.date || new Date();
  const bucket = String(options.bucket || getTrimmedEnv('R2_BUCKET')).trim();

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is required to back up Sheets.');
  }

  if (!bucket) {
    throw new Error('R2_BUCKET is required to store Sheets backups.');
  }

  const getSheetsClient = deps.getSheetsClient || createSheetsClient;
  const getR2Client = deps.getR2Client || createR2Client;
  const upload = deps.uploadArtifact || uploadArtifact;
  const logger = deps.logger || console;

  const sheets = await getSheetsClient();
  const snapshot = await loadSpreadsheetSnapshot(sheets, spreadsheetId);
  const prefix = buildBackupPrefix('sheets', date);
  const { manifest, artifacts } = buildSheetBackupArtifacts(snapshot, prefix);

  if (dryRun) {
    return {
      dryRun: true,
      bucket,
      prefix,
      artifactCount: artifacts.length,
      manifest,
      artifacts: artifacts.map(({ key, contentType, body }) => ({
        key,
        contentType,
        byteLength: Buffer.byteLength(String(body), 'utf8'),
      })),
    };
  }

  const r2Client = await getR2Client();
  for (const artifact of artifacts) {
    await upload(r2Client, bucket, artifact);
  }

  logger.log(`Sheets backup stored in ${bucket}/${prefix}`);

  return {
    dryRun: false,
    bucket,
    prefix,
    artifactCount: artifacts.length,
    manifest,
  };
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    spreadsheetId: argv.includes('--spreadsheet-id')
      ? argv[argv.indexOf('--spreadsheet-id') + 1]
      : undefined,
    bucket: argv.includes('--bucket')
      ? argv[argv.indexOf('--bucket') + 1]
      : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runBackupSheets(args);

  if (result.dryRun) {
    console.log(JSON.stringify({
      bucket: result.bucket,
      prefix: result.prefix,
      artifactCount: result.artifactCount,
      artifacts: result.artifacts,
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    bucket: result.bucket,
    prefix: result.prefix,
    artifactCount: result.artifactCount,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Sheets backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  buildSheetBackupArtifacts,
  buildSheetBackupKey,
  loadSpreadsheetSnapshot,
  parseArgs,
  quoteSheetName,
  runBackupSheets,
};
