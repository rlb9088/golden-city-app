const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  return import(pathToFileURL(path.resolve(__dirname, '../scripts/backupSheets.mjs')).href);
}

test('runBackupSheets creates a dated manifest and csv artifacts', async () => {
  const { runBackupSheets } = await loadModule();

  const fakeSheets = {
    spreadsheets: {
      get: async () => ({
        data: {
          properties: { title: 'Ledger' },
          sheets: [
            { properties: { sheetId: 1, title: 'pagos', index: 0, gridProperties: { columnCount: 3 } } },
            { properties: { sheetId: 2, title: 'audit', index: 1, gridProperties: { columnCount: 2 } } },
          ],
        },
      }),
      values: {
        get: async ({ range }) => {
          if (range.startsWith("'pagos'")) {
            return { data: { values: [['id', 'monto'], ['P-1', 125]] } };
          }

          return { data: { values: [['evento'], ['backup']] } };
        },
      },
    },
  };

  const result = await runBackupSheets(
    {
      dryRun: true,
      spreadsheetId: 'sheet-123',
      bucket: 'bucket-123',
      date: new Date('2026-04-20T00:00:00Z'),
    },
    {
      getSheetsClient: async () => fakeSheets,
    },
  );

  assert.equal(result.prefix, 'backups/sheets/2026-04-20');
  assert.equal(result.artifactCount, 3);
  assert.equal(result.manifest.sheetCount, 2);
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.key),
    [
      'backups/sheets/2026-04-20/spreadsheet.json',
      'backups/sheets/2026-04-20/sheets/pagos.csv',
      'backups/sheets/2026-04-20/sheets/audit.csv',
    ],
  );
});
