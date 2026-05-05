const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
const logger = require('../lib/logger');

async function ensureSchemaAligned() {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();

  if (!sheets || !spreadsheetId) {
    logger.warn('Skipping sheets schema bootstrap: client or spreadsheetId not available', {
      context: { component: 'sheetsBootstrap' },
    });
    return { skipped: true };
  }

  const { ensureSheetsExist, writeHeaders } = require('../scripts/setupSheets');
  const created = await ensureSheetsExist(sheets, spreadsheetId);
  if (created.length > 0) {
    logger.info('Bootstrap created missing sheets', {
      context: { component: 'sheetsBootstrap', created },
    });
  }

  await writeHeaders(sheets, spreadsheetId);
  return { skipped: false, created };
}

module.exports = { ensureSchemaAligned };
