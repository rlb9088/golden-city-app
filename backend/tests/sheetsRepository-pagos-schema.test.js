const test = require('node:test');
const assert = require('node:assert/strict');

function loadRepository({ actualHeaders }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const sheetsClientPath = require.resolve('../config/sheetsClient');
  const loggerPath = require.resolve('../lib/logger');

  delete require.cache[repoPath];
  delete require.cache[sheetsClientPath];
  delete require.cache[loggerPath];

  const updateCalls = [];
  const appendCalls = [];

  require.cache[sheetsClientPath] = {
    id: sheetsClientPath,
    filename: sheetsClientPath,
    loaded: true,
    exports: {
      getSheetsClient: async () => ({
        spreadsheets: {
          values: {
            get: async () => ({ data: { values: [actualHeaders] } }),
            update: async (request) => {
              updateCalls.push(request);
              return { data: {} };
            },
            append: async (request) => {
              appendCalls.push(request);
              return { data: { updates: { updatedRange: 'pagos!A2:M2' } } };
            },
          },
        },
      }),
      getSheetId: () => 'sheet-123',
    },
  };

  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };

  return {
    repo: require('../repositories/sheetsRepository'),
    updateCalls,
    appendCalls,
  };
}

test('append migrates legacy pagos headers without banco_id and keeps column order', async () => {
  const expectedHeaders = [
    'id',
    'estado',
    'usuario',
    'caja',
    'banco_id',
    'banco',
    'monto',
    'tipo',
    'comprobante_url',
    'comprobante_file_id',
    'fecha_comprobante',
    'fecha_registro',
    'agente',
  ];

  const { repo, updateCalls, appendCalls } = loadRepository({
    actualHeaders: [
      'id',
      'estado',
      'usuario',
      'caja',
      'banco',
      'monto',
      'tipo',
      'comprobante_url',
      'comprobante_file_id',
      'fecha_comprobante',
      'fecha_registro',
      'agente',
    ],
  });

  await repo.append('pagos', {
    id: 'PAG-1',
    estado: 'activo',
    usuario: 'Juan Perez',
    caja: 'Caja 1',
    banco_id: 'BK-1',
    banco: 'BCP',
    monto: 120,
    tipo: 'Transferencia',
    comprobante_url: 'https://example.com/receipt.jpg',
    comprobante_file_id: 'receipts/1.jpg',
    fecha_comprobante: '2026-04-17T09:30:00',
    fecha_registro: '2026-04-17T09:31:00',
    agente: 'Agente 1',
  }, expectedHeaders);

  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(updateCalls[0].requestBody.values[0], expectedHeaders);
  assert.equal(appendCalls.length, 1);
  assert.deepStrictEqual(appendCalls[0].requestBody.values[0], [
    'PAG-1',
    'activo',
    'Juan Perez',
    'Caja 1',
    'BK-1',
    'BCP',
    120,
    'Transferencia',
    'https://example.com/receipt.jpg',
    'receipts/1.jpg',
    '2026-04-17T09:30:00',
    '2026-04-17T09:31:00',
    'Agente 1',
  ]);
});

test('append migrates legacy pagos headers without banco_id and comprobante_file_id', async () => {
  const expectedHeaders = [
    'id',
    'estado',
    'usuario',
    'caja',
    'banco_id',
    'banco',
    'monto',
    'tipo',
    'comprobante_url',
    'comprobante_file_id',
    'fecha_comprobante',
    'fecha_registro',
    'agente',
  ];

  const { repo, updateCalls } = loadRepository({
    actualHeaders: [
      'id',
      'estado',
      'usuario',
      'caja',
      'banco',
      'monto',
      'tipo',
      'comprobante_url',
      'fecha_comprobante',
      'fecha_registro',
      'agente',
    ],
  });

  await repo.append('pagos', {
    id: 'PAG-2',
    estado: 'activo',
    usuario: 'Maria Lopez',
    caja: 'Caja 2',
    banco_id: 'BK-2',
    banco: 'BBVA',
    monto: 80,
    tipo: 'Yape',
    comprobante_url: '',
    comprobante_file_id: '',
    fecha_comprobante: '2026-04-17T10:00:00',
    fecha_registro: '2026-04-17T10:01:00',
    agente: 'Agente 2',
  }, expectedHeaders);

  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(updateCalls[0].requestBody.values[0], expectedHeaders);
});
