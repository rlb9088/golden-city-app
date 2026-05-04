const test = require('node:test');
const assert = require('node:assert/strict');

const { SHEETS_SCHEMA, TOTALES_POR_CAJA_HEADERS } = require('../config/sheetsSchema');
const { ensureSheetsExist, writeHeaders } = require('../scripts/setupSheets');

const TOTALES_POR_CAJA_SHEETS = [
  'depositos_totales',
  'retiros_totales',
  'bonos_totales',
  'retiros_no_pagados',
];

test('totales por caja comparte el mismo shape base en las cuatro hojas', () => {
  for (const sheetName of TOTALES_POR_CAJA_SHEETS) {
    const sheet = SHEETS_SCHEMA.find((entry) => entry.name === sheetName);
    assert.ok(sheet, `No se encontró ${sheetName} en SHEETS_SCHEMA`);
    assert.deepEqual(sheet.headers, TOTALES_POR_CAJA_HEADERS);
  }
});

test('ensureSheetsExist solo agrega las hojas faltantes', async () => {
  const createdRequests = [];
  const existingSheets = SHEETS_SCHEMA
    .filter((sheet) => !TOTALES_POR_CAJA_SHEETS.includes(sheet.name))
    .map((sheet) => ({ properties: { title: sheet.name } }));

  const fakeSheets = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: existingSheets,
        },
      }),
      batchUpdate: async ({ requestBody }) => {
        createdRequests.push(...requestBody.requests);
        return {};
      },
    },
  };

  const createdSheets = await ensureSheetsExist(fakeSheets, 'spreadsheet-id');

  assert.deepEqual(createdSheets, TOTALES_POR_CAJA_SHEETS);
  assert.equal(createdRequests.length, 4);
  assert.deepEqual(
    createdRequests.map((request) => request.addSheet.properties.title),
    TOTALES_POR_CAJA_SHEETS,
  );
});

test('writeHeaders no reescribe hojas ya alineadas y completa las nuevas', async () => {
  const updates = [];
  const valuesBySheet = new Map();

  for (const sheet of SHEETS_SCHEMA) {
    if (TOTALES_POR_CAJA_SHEETS.includes(sheet.name)) {
      valuesBySheet.set(sheet.name, []);
      continue;
    }

    valuesBySheet.set(sheet.name, sheet.headers);
  }

  const fakeSheets = {
    spreadsheets: {
      values: {
        get: async ({ range }) => {
          const sheetName = String(range).split('!')[0];
          const headers = valuesBySheet.get(sheetName) || [];
          return {
            data: {
              values: headers.length > 0 ? [headers] : [],
            },
          };
        },
        update: async (request) => {
          updates.push(request);
          return {};
        },
      },
    },
  };

  await writeHeaders(fakeSheets, 'spreadsheet-id');

  assert.equal(updates.length, 4);
  assert.deepEqual(
    updates.map((request) => request.range),
    TOTALES_POR_CAJA_SHEETS.map((sheetName) => `${sheetName}!A1:E1`),
  );
});
