const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfigService({ getAll, appendBatch, auditLog }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const servicePath = require.resolve('../services/config.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      deleteRow: async () => ({}),
      append: async () => ({}),
      appendBatch,
      update: async () => ({}),
      findByColumn: async () => [],
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: auditLog,
    },
  };

  return require('../services/config.service');
}

function loadRepository({ getSheetsClient, getSheetId }) {
  const clientPath = require.resolve('../config/sheetsClient');
  const repoPath = require.resolve('../repositories/sheetsRepository');

  delete require.cache[repoPath];
  delete require.cache[clientPath];

  require.cache[clientPath] = {
    id: clientPath,
    filename: clientPath,
    loaded: true,
    exports: {
      getSheetsClient,
      getSheetId,
    },
  };

  return require('../repositories/sheetsRepository');
}

test('importBatch agrupa registros y registra una sola auditoría', async () => {
  const auditCalls = [];
  const appendBatchCalls = [];
  const service = loadConfigService({
    getAll: async () => [],
    appendBatch: async (sheetName, rows) => {
      appendBatchCalls.push({ sheetName, rows });
      return { status: 'success', mode: 'sheets' };
    },
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-200' };
    },
  });

  const result = await service.importBatch('usuarios', [
    { nombre: 'Ana' },
    { nombre: 'Luis' },
  ], 'tester');

  assert.deepStrictEqual(result.map((record) => record.nombre), ['Ana', 'Luis']);
  assert.match(result[0].id, /^USU-/);
  assert.match(result[1].id, /^USU-/);
  assert.deepStrictEqual(appendBatchCalls, [
    {
      sheetName: 'config_usuarios',
      rows: [
        [result[0].id, 'Ana'],
        [result[1].id, 'Luis'],
      ],
    },
  ]);
  assert.deepStrictEqual(auditCalls, [
    ['import', 'config_usuarios', 'tester', {
      count: 2,
      items: ['Ana', 'Luis'],
    }],
  ]);
});

test('appendBatch funciona en modo in-memory', async () => {
  const repo = loadRepository({
    getSheetsClient: async () => null,
    getSheetId: () => null,
  });

  const result = await repo.appendBatch('config_usuarios', [
    { id: 'USE-1', nombre: 'Ana' },
    { id: 'USE-2', nombre: 'Luis' },
  ]);

  assert.equal(result.status, 'success');
  assert.equal(result.mode, 'memory');
  assert.equal(result.chunks, 1);
  assert.ok(result.payloadBytes > 0);

  const rows = await repo.getAll('config_usuarios');
  assert.deepStrictEqual(rows, [
    { _rowIndex: 2, id: 'USE-1', nombre: 'Ana' },
    { _rowIndex: 3, id: 'USE-2', nombre: 'Luis' },
  ]);
});

test('appendBatch usa chunking cuando el payload supera el umbral', async () => {
  const appendCalls = [];
  let nextRow = 2;
  const repo = loadRepository({
    getSheetsClient: async () => ({
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [
              {
                properties: {
                  sheetId: 7,
                  title: 'config_usuarios',
                },
              },
            ],
          },
        }),
        values: {
          append: async (params) => {
            appendCalls.push(params);
            const rowIndex = nextRow;
            nextRow += params.requestBody.values.length;
            return {
              data: {
                updates: {
                  updatedRange: `config_usuarios!A${rowIndex}:B${rowIndex + params.requestBody.values.length - 1}`,
                },
              },
            };
          },
        },
        batchUpdate: async () => ({ data: {} }),
      },
    }),
    getSheetId: () => 'sheet-123',
  });

  const rows = Array.from({ length: 600 }, (_, index) => ({
    id: `USE-${index + 1}`,
    nombre: 'x'.repeat(5000),
  }));

  const result = await repo.appendBatch('config_usuarios', rows);

  assert.equal(result.mode, 'sheets');
  assert.ok(result.chunks > 1);
  assert.ok(appendCalls.length > 1);
  assert.equal(appendCalls.length, result.chunks);
});
