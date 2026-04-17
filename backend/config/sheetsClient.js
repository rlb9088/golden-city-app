const { google } = require('googleapis');
const path = require('path');
const logger = require('../lib/logger');

let sheetsInstance = null;
let driveInstance = null;

/**
 * Inicializa y retorna la instancia de Google Sheets API.
 * Si GOOGLE_APPLICATION_CREDENTIALS no está configurado,
 * usa un mock in-memory para desarrollo.
 */
async function getSheetsClient() {
  if (sheetsInstance) return sheetsInstance;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credPath || !sheetId) {
    logger.warn('Missing Google Sheets credentials. Using in-memory mock.', {
      context: {
        hasCredentialsPath: Boolean(credPath),
        hasSheetId: Boolean(sheetId),
      },
    });
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(credPath),
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
