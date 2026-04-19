const { google } = require('googleapis');
const logger = require('../lib/logger');

let sheetsInstance = null;
let driveInstance = null;
let parsedCredentials = null;

/**
 * Inicializa y retorna la instancia de Google Sheets API.
 * Si GOOGLE_CREDENTIALS_BASE64 no está configurado,
 * usa un mock in-memory para desarrollo.
 */
function getCredentialsFromEnv() {
  if (parsedCredentials) {
    return parsedCredentials;
  }

  const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!encodedCredentials) {
    return null;
  }

  try {
    const normalizedEncodedCredentials = String(encodedCredentials).trim();
    parsedCredentials = JSON.parse(
      Buffer.from(normalizedEncodedCredentials, 'base64').toString('utf-8'),
    );
    return parsedCredentials;
  } catch (error) {
    const wrappedError = new Error('Invalid GOOGLE_CREDENTIALS_BASE64 value.');
    wrappedError.cause = error;
    throw wrappedError;
  }
}

async function getSheetsClient() {
  if (sheetsInstance) return sheetsInstance;

  const credentials = getCredentialsFromEnv();
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentials || !sheetId) {
    logger.warn('Missing Google Sheets credentials. Using in-memory mock.', {
      context: {
        hasCredentials: Boolean(credentials),
        hasSheetId: Boolean(sheetId),
      },
    });
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  const authClient = await auth.getClient();

  sheetsInstance = google.sheets({ version: 'v4', auth: authClient });
  driveInstance = google.drive({ version: 'v3', auth: authClient });

  logger.info('Connected to Google Sheets API');
  return sheetsInstance;
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    logger.warn('GOOGLE_SHEET_ID not set');
  }
  return id;
}

module.exports = { getSheetsClient, getSheetId };
