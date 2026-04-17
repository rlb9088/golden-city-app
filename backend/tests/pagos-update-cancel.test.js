const test = require('node:test');
const assert = require('node:assert/strict');

function loadPagosService({ getAll }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve('../services/pagos.service');

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
    service: require('../services/pagos.service'),
    updateCalls,
    auditCalls,
  };
}

test('update conserva el estado y audita before/after', async () => {
  const { service, updateCalls, auditCalls } = loadPagosService({
    getAll: async () => ([
      {
        _rowIndex: 5,
        id: 'PAG-1',
        estado: 'activo',
        usuario: 'Juan Perez',
        caja: 'Caja 1',
        banco: 'BCP',
        monto: 120,
        tipo: 'Transferencia',
        comprobante_url: '',
        fecha_comprobante: '2026-04-10T09:15:00',
        fecha_registro: '2026-04-10T09:15:00',
        agente: 'Agente 1',
      },
    ]),
  });

  const result = await service.update('PAG-1', { monto: 150, usuario: 'Juan P.' }, 'admin-user');

  assert.equal(result.monto, 150);
  assert.equal(result.usuario, 'Juan P.');
  assert.equal(result.estado, 'activo');
  assert.deepStrictEqual(updateCalls, [
    {
      sheetName: 'pagos',
      rowIndex: 5,
      data: {
        _rowIndex: 5,
        id: 'PAG-1',
        estado: 'activo',
        usuario: 'Juan P.',
        caja: 'Caja 1',
        banco: 'BCP',
        monto: 150,
        tipo: 'Transferencia',
        comprobante_url: '',
        fecha_comprobante: '2026-04-10T09:15:00',
        fecha_registro: '2026-04-10T09:15:00',
        agente: 'Agente 1',
      },
      headers: ['id', 'estado', 'usuario', 'caja', 'banco', 'monto', 'tipo', 'comprobante_url', 'fecha_comprobante', 'fecha_registro', 'agente'],
    },
  ]);
  assert.equal(auditCalls[0][0], 'update');
  assert.equal(auditCalls[0][1], 'pago');
  assert.equal(auditCalls[0][2], 'admin-user');
  assert.equal(auditCalls[0][3].before.id, 'PAG-1');
  assert.equal(auditCalls[0][3].after.monto, 150);
});

test('cancel marca el registro como anulado y audita el motivo', async () => {
  const { service, updateCalls, auditCalls } = loadPagosService({
    getAll: async () => ([
      {
        _rowIndex: 7,
        id: 'PAG-2',
        estado: '',
        usuario: 'Maria Lopez',
        caja: 'Caja 2',
        banco: 'Interbank',
        monto: 80,
        tipo: 'Efectivo',
        comprobante_url: '',
        fecha_comprobante: '',
        fecha_registro: '2026-04-12T10:20:00',
        agente: 'Agente 2',
      },
    ]),
  });

  const result = await service.cancel('PAG-2', 'Error de registro', 'admin-user');

  assert.equal(result.estado, 'anulado');
  assert.deepStrictEqual(updateCalls[0].data.estado, 'anulado');
  assert.equal(auditCalls[0][0], 'delete');
  assert.equal(auditCalls[0][1], 'pago');
  assert.equal(auditCalls[0][3].motivo, 'Error de registro');
});

