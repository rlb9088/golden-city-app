const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  return import(pathToFileURL(path.resolve(__dirname, '../scripts/restoreSheets.mjs')).href);
}

test('runRestoreSheets validates a snapshot in dry-run mode', async () => {
  const { runRestoreSheets } = await loadModule();

  const snapshot = {
    version: 1,
    exportedAt: '2026-04-20T00:00:00.000Z',
    spreadsheetTitle: 'Ledger',
    sheets: [
      { name: 'pagos', values: [['id', 'monto'], ['P-1', 125]] },
      { name: 'audit', values: [['evento'], ['backup']] },
    ],
  };

  const result = await runRestoreSheets(
    {
      dryRun: true,
      snapshotFile: path.resolve(__dirname, 'fixtures', 'snapshot.json'),
    },
    {
      loadSnapshotFromFile: async () => snapshot,
    },
  );

  assert.equal(result.dryRun, true);
  assert.equal(result.sheetCount, 2);
  assert.deepEqual(result.sheetSummaries, [
    { name: 'pagos', rowCount: 2, columnCount: 2 },
    { name: 'audit', rowCount: 2, columnCount: 1 },
  ]);
});

test('runRestoreSheets creates a clean spreadsheet and writes values', async () => {
  const { runRestoreSheets } = await loadModule();

  const snapshot = {
    version: 1,
    exportedAt: '2026-04-20T00:00:00.000Z',
    spreadsheetTitle: 'Ledger',
    sheets: [
      { name: 'pagos', values: [['id', 'monto'], ['P-1', 125]] },
      { name: 'audit', values: [['evento'], ['backup']] },
    ],
  };

  const calls = {
    create: 0,
    rename: [],
    addSheet: [],
    updates: [],
  };

  const fakeSheets = {
    spreadsheets: {
      create: async () => {
        calls.create += 1;
        return { data: { spreadsheetId: 'spreadsheet-999' } };
      },
      get: async () => ({
        data: {
          sheets: [
            { properties: { sheetId: 11, title: 'Sheet1', index: 0 } },
          ],
        },
      }),
      batchUpdate: async ({ requestBody }) => {
        for (const request of requestBody.requests) {
          if (request.updateSheetProperties) {
            calls.rename.push(request.updateSheetProperties.properties.title);
          }
          if (request.addSheet) {
            calls.addSheet.push(request.addSheet.properties.title);
          }
        }
        return {};
      },
      values: {
        update: async (request) => {
          calls.updates.push(request);
          return {};
        },
      },
    },
  };

  const result = await runRestoreSheets(
    {
      snapshotFile: path.resolve(__dirname, 'fixtures', 'snapshot.json'),
    },
    {
      getSheetsClient: async () => fakeSheets,
      loadSnapshotFromFile: async () => snapshot,
    },
  );

  assert.equal(result.dryRun, false);
  assert.equal(result.spreadsheetId, 'spreadsheet-999');
  assert.equal(calls.create, 1);
  assert.deepEqual(calls.rename, ['pagos']);
  assert.deepEqual(calls.addSheet, ['audit']);
  assert.equal(calls.updates.length, 2);
  assert.equal(calls.updates[0].range, "'pagos'!A1");
  assert.equal(calls.updates[1].range, "'audit'!A1");
});
