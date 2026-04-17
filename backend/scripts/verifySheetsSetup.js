const path = require('path');
const dotenv = require('dotenv');
const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
const { SHEETS_SCHEMA } = require('../config/sheetsSchema');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const spreadsheetId = getSheetId();

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID no está configurado en backend/.env.');
  }

  const sheets = await getSheetsClient();

  if (!sheets) {
    throw new Error('No fue posible inicializar Google Sheets. Revisa tus credenciales y GOOGLE_SHEET_ID.');
  }

  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = new Set(
    (metadata.data.sheets || []).map((sheet) => sheet.properties.title),
  );

  const missingSheets = SHEETS_SCHEMA
    .map((sheet) => sheet.name)
    .filter((sheetName) => !sheetNames.has(sheetName));

  if (missingSheets.length > 0) {
    throw new Error(`Faltan hojas requeridas: ${missingSheets.join(', ')}`);
  }

  for (const sheet of SHEETS_SCHEMA) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet.name}!1:1`,
    });

    const actualHeaders = response.data.values?.[0] || [];
    const expectedHeaders = sheet.headers;
    const isMatch =
      actualHeaders.length === expectedHeaders.length &&
      actualHeaders.every((header, index) => header === expectedHeaders[index]);

    if (!isMatch) {
      throw new Error(
        `Headers inválidos en ${sheet.name}. Esperado: ${expectedHeaders.join(', ')}. Actual: ${actualHeaders.join(', ')}`,
      );
    }
  }

  console.log('[SheetsVerify] OK. Estructura de Google Sheets válida.');
}

main().catch((error) => {
  console.error('[SheetsVerify] Error:', error.message);
  process.exitCode = 1;
});
