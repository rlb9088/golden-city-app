/**
 * Ejecuta manualmente la migracion de gastos/repartos (la misma que corre al arrancar el servidor).
 *   node scripts/migrateGastosRepartos.js            # DRY-RUN
 *   node scripts/migrateGastosRepartos.js --apply [--prune-categorias]
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const apply = process.argv.includes('--apply');
  const prune = process.argv.includes('--prune-categorias');
  console.log(`[Migracion] Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();
  if (!sheets || !spreadsheetId) {
    throw new Error('No hay cliente de Google Sheets configurado. Abortando.');
  }

  if (apply) {
    const { ensureSheetsExist, writeHeaders } = require('./setupSheets');
    await ensureSheetsExist(sheets, spreadsheetId);
    await writeHeaders(sheets, spreadsheetId);
  }

  const { runMigration } = require('../services/gastosRepartosMigration.service');
  await runMigration({ apply, prune, sheets, spreadsheetId, log: (m) => console.log(`[Migracion] ${m}`) });
}

main().catch((error) => {
  console.error('[Migracion] Error:', error.message);
  process.exitCode = 1;
});
