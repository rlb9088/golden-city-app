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
              return { data: { updates: { updatedRange: 'sheet!A2:Z2' } } };
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

test('ingresos migrates legacy headers without banco_id before appending', async () => {
  const headers = ['id', 'estado', 'agente', 'banco_id', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'];
  const { repo, updateCalls, appendCalls } = loadRepository({
    actualHeaders: ['id', 'estado', 'agente', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'],
  });

  await repo.append('ingresos', {
    id: 'ING-1',
    estado: 'activo',
    agente: 'Agente 1',
    banco_id: 'BK-1',
    banco: 'BCP',
    monto: 150,
    fecha_movimiento: '2026-04-17T09:00:00',
    fecha_registro: '2026-04-17T09:01:00',
  }, headers);

  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(updateCalls[0].requestBody.values[0], headers);
  assert.deepStrictEqual(appendCalls[0].requestBody.values[0], [
    'ING-1',
    'activo',
    'Agente 1',
    'BK-1',
    'BCP',
    150,
    '2026-04-17T09:00:00',
    '2026-04-17T09:01:00',
  ]);
});

test('gastos migrates legacy headers without banco_id before appending', async () => {
  const headers = ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco_id', 'banco', 'monto'];
  const { repo, updateCalls, appendCalls } = loadRepository({
    actualHeaders: ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco', 'monto'],
  });

  await repo.append('gastos', {
    id: 'GAS-1',
    estado: 'activo',
    fecha_gasto: '2026-04-17T10:00:00',
    fecha_registro: '2026-04-17T10:01:00',
    concepto: 'Papelería',
    categoria: 'Oficina',
    subcategoria: 'Suministros',
    banco_id: 'BK-2',
    banco: 'BBVA',
    monto: 45,
  }, headers);

  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(updateCalls[0].requestBody.values[0], headers);
  assert.deepStrictEqual(appendCalls[0].requestBody.values[0], [
    'GAS-1',
    'activo',
    '2026-04-17T10:00:00',
    '2026-04-17T10:01:00',
    'Papelería',
    'Oficina',
    'Suministros',
    'BK-2',
    'BBVA',
    45,
  ]);
});

test('bancos migrates legacy headers without banco_id before appending', async () => {
  const headers = ['id', 'fecha', 'banco_id', 'banco', 'saldo'];
  const { repo, updateCalls, appendCalls } = loadRepository({
    actualHeaders: ['id', 'fecha', 'banco', 'saldo'],
  });

  await repo.append('bancos', {
    id: 'BAN-1',
    fecha: '2026-04-17',
    banco_id: 'BK-3',
    banco: 'Interbank',
    saldo: 1000,
  }, headers);

  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(updateCalls[0].requestBody.values[0], headers);
  assert.deepStrictEqual(appendCalls[0].requestBody.values[0], [
    'BAN-1',
    '2026-04-17',
    'BK-3',
    'Interbank',
    1000,
  ]);
});
