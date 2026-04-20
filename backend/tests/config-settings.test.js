const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfigService({ getAll, append, update, auditLog }) {
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
      append,
      update,
      deleteRow: async () => ({}),
      appendBatch: async () => ({}),
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

function getCurrentMonthStartLima() {
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Lima',
  });

  return `${today.slice(0, 7)}-01`;
}

test('getSetting devuelve el seed de caja_inicio_mes cuando la hoja esta vacia', async () => {
  const service = loadConfigService({
    getAll: async () => [],
    append: async () => ({}),
    update: async () => ({}),
    auditLog: async () => ({ id: 'AUD-1' }),
  });

  const result = await service.getSetting('caja_inicio_mes');

  assert.deepStrictEqual(result, {
    key: 'caja_inicio_mes',
    value: 0,
    fecha_efectiva: getCurrentMonthStartLima(),
  });
});

test('upsertSetting crea el ajuste y registra auditoria', async () => {
  const appendCalls = [];
  const auditCalls = [];
  const service = loadConfigService({
    getAll: async () => [],
    append: async (sheetName, data, headers) => {
      appendCalls.push({ sheetName, data, headers });
      return { status: 'success' };
    },
    update: async () => ({}),
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-2' };
    },
  });

  const result = await service.upsertSetting('caja_inicio_mes', {
    value: 1250.5,
    fecha_efectiva: '2026-04-01',
  }, 'tester');

  assert.deepStrictEqual(result, {
    key: 'caja_inicio_mes',
    value: 1250.5,
    fecha_efectiva: '2026-04-01',
  });
  assert.deepStrictEqual(appendCalls, [
    {
      sheetName: 'config_settings',
      data: {
        key: 'caja_inicio_mes',
        value: '1250.5',
        fecha_efectiva: '2026-04-01',
        actualizado_por: 'tester',
        actualizado_en: appendCalls[0].data.actualizado_en,
      },
      headers: ['key', 'value', 'fecha_efectiva', 'actualizado_por', 'actualizado_en'],
    },
  ]);
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][1], 'config_settings');
  assert.equal(auditCalls[0][2], 'tester');
  assert.deepStrictEqual(auditCalls[0][3], {
    key: 'caja_inicio_mes',
    value: 1250.5,
    fecha_efectiva: '2026-04-01',
  });
});

test('upsertSetting actualiza un ajuste existente', async () => {
  const updateCalls = [];
  const auditCalls = [];
  const service = loadConfigService({
    getAll: async () => ([
      {
        _rowIndex: 2,
        key: 'caja_inicio_mes',
        value: '0',
        fecha_efectiva: '2026-04-01',
        actualizado_por: 'system',
        actualizado_en: '2026-04-20T00:00:00',
      },
    ]),
    append: async () => ({}),
    update: async (sheetName, rowIndex, data, headers) => {
      updateCalls.push({ sheetName, rowIndex, data, headers });
      return { status: 'success' };
    },
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-3' };
    },
  });

  const result = await service.upsertSetting('caja_inicio_mes', {
    value: '1500.75',
    fecha_efectiva: '2026-05-01',
  }, 'tester');

  assert.deepStrictEqual(result, {
    key: 'caja_inicio_mes',
    value: 1500.75,
    fecha_efectiva: '2026-05-01',
  });
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].sheetName, 'config_settings');
  assert.equal(updateCalls[0].rowIndex, 2);
  assert.deepStrictEqual(updateCalls[0].data, {
    _rowIndex: 2,
    key: 'caja_inicio_mes',
    value: '1500.75',
    fecha_efectiva: '2026-05-01',
    actualizado_por: 'tester',
    actualizado_en: updateCalls[0].data.actualizado_en,
  });
  assert.equal(auditCalls[0][0], 'update');
  assert.equal(auditCalls[0][1], 'config_settings');
  assert.equal(auditCalls[0][2], 'tester');
  assert.deepStrictEqual(auditCalls[0][3], {
    before: {
      key: 'caja_inicio_mes',
      value: 0,
      fecha_efectiva: '2026-04-01',
    },
    after: {
      key: 'caja_inicio_mes',
      value: 1500.75,
      fecha_efectiva: '2026-05-01',
    },
    changes: {
      key: 'caja_inicio_mes',
      value: 1500.75,
      fecha_efectiva: '2026-05-01',
    },
  });
});
