const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const { SHEETS_SCHEMA } = require('../config/sheetsSchema');

const ENV_PATH = path.resolve(__dirname, '../.env');
dotenv.config({ path: ENV_PATH });

function getCredentialsPath() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not configured in backend/.env.');
  }
  return path.resolve(__dirname, '..', credPath);
}

function getServiceAccountEmail() {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file was not found at ${credentialsPath}.`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  if (!credentials.client_email) {
    throw new Error('Credentials JSON does not include client_email.');
  }
  return credentials.client_email;
}

function getOwnerEmail() {
  const ownerEmail = process.env.GOOGLE_SHEET_OWNER_EMAIL;
  if (!ownerEmail || !ownerEmail.trim()) return null;
  return ownerEmail.trim();
}

function upsertEnvVar(key, value) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const lines = current.split(/\r?\n/);
  const prefix = `${key}=`;
  const replacement = `${prefix}${value}`;
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (line.startsWith(prefix)) {
      replaced = true;
      return replacement;
    }
    return line;
  });

  if (!replaced) {
    nextLines.push(replacement);
  }

  const normalized = `${nextLines.filter((line, i, arr) => !(i === arr.length - 1 && line === '')).join('\n')}\n`;
  fs.writeFileSync(ENV_PATH, normalized, 'utf8');
  process.env[key] = value;
}

async function getGoogleClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: getCredentialsPath(),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const authClient = await auth.getClient();
  return {
    sheets: google.sheets({ version: 'v4', auth: authClient }),
    drive: google.drive({ version: 'v3', auth: authClient }),
  };
}

async function createSpreadsheet(sheets) {
  const today = new Date().toISOString().slice(0, 10);
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Golden City Backoffice ${today}` },
    },
  });

  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Could not read spreadsheetId from create response.');
  }
  return spreadsheetId;
}

async function shareWithOwnerIfConfigured(drive, spreadsheetId, ownerEmail, serviceAccountEmail) {
  if (!ownerEmail) {
    console.log('[SheetsSetup] GOOGLE_SHEET_OWNER_EMAIL not set. Skipping owner share.');
    return;
  }

  if (ownerEmail.toLowerCase() === serviceAccountEmail.toLowerCase()) {
    return;
  }

  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: false,
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: ownerEmail,
    },
  });

  console.log(`[SheetsSetup] Shared spreadsheet with ${ownerEmail}.`);
}

function toColumnLetter(columnNumber) {
  let current = columnNumber;
  let column = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }
  return column;
}

async function ensureSheetsExist(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((metadata.data.sheets || []).map((s) => s.properties.title));

  const requests = SHEETS_SCHEMA
    .filter((sheet) => !existing.has(sheet.name))
    .map((sheet) => ({
      addSheet: { properties: { title: sheet.name } },
    }));

  if (requests.length === 0) return [];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return requests.map((request) => request.addSheet.properties.title);
}

async function writeHeaders(sheets, spreadsheetId) {
  for (const sheet of SHEETS_SCHEMA) {
    const endColumn = toColumnLetter(sheet.headers.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet.name}!A1:${endColumn}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [sheet.headers] },
    });
  }
}

async function verifyHeaders(sheets, spreadsheetId) {
  const failures = [];

  for (const sheet of SHEETS_SCHEMA) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet.name}!1:1`,
    });
    const actual = response.data.values?.[0] || [];
    const expected = sheet.headers;
    const isMatch =
      actual.length === expected.length &&
      actual.every((header, index) => header === expected[index]);

    if (!isMatch) {
      failures.push({ sheet: sheet.name, expected, actual });
    }
  }

  return failures;
}

async function main() {
  const serviceAccountEmail = getServiceAccountEmail();
  const ownerEmail = getOwnerEmail();
  console.log('[SheetsSetup] Service Account:', serviceAccountEmail);

  const { sheets, drive } = await getGoogleClients();
  let spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId || !spreadsheetId.trim()) {
    spreadsheetId = await createSpreadsheet(sheets);
    upsertEnvVar('GOOGLE_SHEET_ID', spreadsheetId);
    await shareWithOwnerIfConfigured(drive, spreadsheetId, ownerEmail, serviceAccountEmail);
    console.log('[SheetsSetup] Created spreadsheet and updated backend/.env.');
  }

  console.log('[SheetsSetup] Spreadsheet ID:', spreadsheetId);
  console.log(`[SheetsSetup] Spreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);

  try {
    const createdSheets = await ensureSheetsExist(sheets, spreadsheetId);
    if (createdSheets.length > 0) {
      console.log('[SheetsSetup] Created sheets:', createdSheets.join(', '));
    } else {
      console.log('[SheetsSetup] All sheets already existed.');
    }

    await writeHeaders(sheets, spreadsheetId);
    console.log('[SheetsSetup] Headers written in row 1.');

    const failures = await verifyHeaders(sheets, spreadsheetId);
    if (failures.length > 0) {
      console.error('[SheetsSetup] Header verification failed.');
      failures.forEach((failure) => {
        console.error(`- ${failure.sheet}`);
        console.error(`  Expected: ${failure.expected.join(', ')}`);
        console.error(`  Actual:   ${failure.actual.join(', ')}`);
      });
      process.exitCode = 1;
      return;
    }

    console.log('[SheetsSetup] OK. Spreadsheet setup completed.');
  } catch (error) {
    if (error.code === 403) {
      console.error('[SheetsSetup] Permission denied to spreadsheet.');
      console.error(`[SheetsSetup] Share it with ${serviceAccountEmail} as Editor and re-run.`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('[SheetsSetup] Error:', error.message);
  if (error.response?.data) {
    console.error('[SheetsSetup] Error details:', JSON.stringify(error.response.data));
  }
  if (
    error.response?.data?.error?.code === 403 &&
    (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SHEET_ID.trim())
  ) {
    console.error('[SheetsSetup] Fallback required: create the spreadsheet manually in Google Sheets, share it with the service account as Editor, and set GOOGLE_SHEET_ID in backend/.env.');
  }
  process.exitCode = 1;
});
