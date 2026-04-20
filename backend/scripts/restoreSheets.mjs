import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const require = createRequire(import.meta.url);
const {
  bodyToText,
  createR2Client,
  dateStamp,
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
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is required to restore Sheets.');
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Snapshot payload is invalid.');
  }

  if (!Array.isArray(snapshot.sheets)) {
    throw new Error('Snapshot payload is missing sheets.');
  }

  for (const sheet of snapshot.sheets) {
    if (!sheet || typeof sheet !== 'object') {
      throw new Error('Snapshot sheet entry is invalid.');
    }

    if (!String(sheet.name || '').trim()) {
      throw new Error('Snapshot sheet name is required.');
    }

    if (!Array.isArray(sheet.values)) {
      throw new Error(`Snapshot sheet ${sheet.name} is missing values.`);
    }
  }

  return snapshot;
}

async function loadSnapshotFromFile(snapshotFile) {
  const raw = await fs.promises.readFile(snapshotFile, 'utf8');
  return validateSnapshot(JSON.parse(raw));
}

async function loadSnapshotFromR2(bucket, snapshotKey, deps = {}) {
  const getR2Client = deps.getR2Client || createR2Client;
  const client = await getR2Client();
  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: snapshotKey,
  }));

  return validateSnapshot(JSON.parse(await bodyToText(response.Body)));
}

async function createSpreadsheetFromSnapshot(sheets, snapshot) {
  const title = snapshot.spreadsheetTitle
    ? `${snapshot.spreadsheetTitle} restored ${dateStamp()}`
    : `Sheets restore ${dateStamp()}`;

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Could not create a target spreadsheet.');
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,index)',
  });

  const existingSheets = metadata.data.sheets || [];
  const firstSheet = existingSheets[0]?.properties;

  if (snapshot.sheets.length > 0 && firstSheet) {
    const firstSnapshotSheet = snapshot.sheets[0];

    if (firstSheet.title !== firstSnapshotSheet.name) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: firstSheet.sheetId,
                  title: firstSnapshotSheet.name,
                },
                fields: 'title',
              },
            },
          ],
        },
      });
    }

    for (const sheet of snapshot.sheets.slice(1)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheet.name,
                },
              },
            },
          ],
        },
      });
    }
  }

  return spreadsheetId;
}

async function restoreSnapshotToSpreadsheet(sheets, spreadsheetId, snapshot) {
  for (const sheet of snapshot.sheets) {
    if (!sheet.values.length) {
      continue;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheet.name)}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: sheet.values,
      },
    });
  }
}

async function runRestoreSheets(options = {}, deps = {}) {
  const dryRun = Boolean(options.dryRun);
  const snapshotFile = options.snapshotFile ? path.resolve(options.snapshotFile) : null;
  const snapshotKey = options.snapshotKey ? String(options.snapshotKey).trim() : '';
  const bucket = String(options.bucket || getTrimmedEnv('R2_BUCKET')).trim();
  const getSheetsClient = deps.getSheetsClient || createSheetsClient;
  const loadFile = deps.loadSnapshotFromFile || loadSnapshotFromFile;
  const loadR2 = deps.loadSnapshotFromR2 || loadSnapshotFromR2;
  const logger = deps.logger || console;

  if (!snapshotFile && !snapshotKey) {
    throw new Error('Provide --snapshot-file or --snapshot-key to restore Sheets.');
  }

  const snapshot = snapshotFile
    ? await loadFile(snapshotFile)
    : await loadR2(bucket, snapshotKey, deps);

  const sheetSummaries = snapshot.sheets.map((sheet) => ({
    name: sheet.name,
    rowCount: sheet.values.length,
    columnCount: sheet.values.reduce((max, row) => Math.max(max, row.length), 0),
  }));

  if (dryRun) {
    return {
      dryRun: true,
      spreadsheetTitle: snapshot.spreadsheetTitle || null,
      sheetCount: snapshot.sheets.length,
      sheetSummaries,
    };
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = await createSpreadsheetFromSnapshot(sheets, snapshot);
  await restoreSnapshotToSpreadsheet(sheets, spreadsheetId, snapshot);

  logger.log(`Sheets restore created spreadsheet ${spreadsheetId}`);

  return {
    dryRun: false,
    spreadsheetId,
    spreadsheetTitle: snapshot.spreadsheetTitle || null,
    sheetCount: snapshot.sheets.length,
    sheetSummaries,
  };
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    snapshotFile: argv.includes('--snapshot-file')
      ? argv[argv.indexOf('--snapshot-file') + 1]
      : undefined,
    snapshotKey: argv.includes('--snapshot-key')
      ? argv[argv.indexOf('--snapshot-key') + 1]
      : undefined,
    bucket: argv.includes('--bucket')
      ? argv[argv.indexOf('--bucket') + 1]
      : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runRestoreSheets(args);

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Sheets restore failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  createSpreadsheetFromSnapshot,
  loadSnapshotFromFile,
  loadSnapshotFromR2,
  parseArgs,
  restoreSnapshotToSpreadsheet,
  runRestoreSheets,
  validateSnapshot,
};
