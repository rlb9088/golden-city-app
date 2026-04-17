const test = require('node:test');
const assert = require('node:assert/strict');

function loadService({ serviceName, getAll }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve(`../services/${serviceName}.service`);

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[configPath];

  const updateCalls = [];
  const auditCalls = [];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async () => ({}),
      update: async (sheetName, rowIndex, data, headers) => {
        updateCalls.push({ sheetName, rowIndex, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      deleteRow: async () => ({}),
      findByColumn: async () => [],
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: async (...args) => {
        auditCalls.push(args);
        return { id: 'AUD-1' };
      },
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      validateReferences: async () => [],
    },
  };

  return {
    service: require(`../services/${serviceName}.service`),
    updateCalls,
    auditCalls,
  };
}

test('ingresos update/cancel preserves state and writes audit logs', async () => {
  const { service, updateCalls, auditCalls } = loadService({
    serviceName: 'ingresos',
    getAll: async () => ([
      {
        _rowIndex: 4,
        id: 'ING-1',
        estado: 'activo',
        agente: 'Agente 1',
        banco: 'BCP',
        monto: 250,
        fecha_movimiento: '2026-04-16T09:00:00',
        fecha_registro: '2026-04-16T09:05:00',
      },
    ]),
  });

  const updated = await service.update('ING-1', { monto: 275 }, 'admin-user');
  assert.equal(updated.estado, 'activo');
  assert.equal(updated.monto, 275);
  assert.equal(updateCalls[0].sheetName, 'ingresos');
  assert.equal(auditCalls[0][0], 'update');

  const cancelled = await service.cancel('ING-1', 'Corrección de registro', 'admin-user');
  assert.equal(cancelled.estado, 'anulado');
  assert.equal(updateCalls[1].data.estado, 'anulado');
  assert.equal(auditCalls[1][0], 'delete');
  assert.equal(auditCalls[1][3].motivo, 'Corrección de registro');
});

test('gastos update/cancel preserves state and writes audit logs', async () => {
  const { service, updateCalls, auditCalls } = loadService({
    serviceName: 'gastos',
    getAll: async () => ([
      {
        _rowIndex: 6,
        id: 'GAS-1',
        estado: '',
        fecha_gasto: '2026-04-15',
        fecha_registro: '2026-04-15T08:00:00',
        concepto: 'Papelería',
        categoria: 'Operativo',
        subcategoria: 'Material oficina',
        banco: 'Interbank',
        monto: 90,
      },
    ]),
  });

  const updated = await service.update('GAS-1', { monto: 110, concepto: 'Papelería y útiles' }, 'admin-user');
  assert.equal(updated.estado, 'activo');
  assert.equal(updated.monto, 110);
  assert.equal(updateCalls[0].sheetName, 'gastos');
  assert.equal(auditCalls[0][0], 'update');

  const cancelled = await service.cancel('GAS-1', 'Duplicado', 'admin-user');
  assert.equal(cancelled.estado, 'anulado');
  assert.equal(updateCalls[1].data.estado, 'anulado');
  assert.equal(auditCalls[1][0], 'delete');
  assert.equal(auditCalls[1][3].motivo, 'Duplicado');
});
