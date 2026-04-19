const test = require('node:test');
const assert = require('node:assert/strict');

function loadPagosService({
  getAll,
  getConfigBancoById = async (bancoId) => (bancoId ? { id: bancoId, nombre: String(bancoId) } : null),
  getAuthUserById = async (userId) => (userId ? { id: userId, nombre: String(userId), username: String(userId).toLowerCase(), role: 'agent', activo: true } : null),
  getAuthUsers = async () => [],
}) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const authPath = require.resolve('../services/auth.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve('../services/pagos.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[authPath];
  delete require.cache[configPath];

  const appendCalls = [];
  const updateCalls = [];
  const auditCalls = [];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async (sheetName, data, headers) => {
        appendCalls.push({ sheetName, data, headers });
        return { status: 'success', mode: 'memory' };
      },
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

  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      getAuthUserById,
      getAuthUsers,
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      validateReferences: async () => [],
      getConfigBancoById,
    },
  };

  return {
    service: require('../services/pagos.service'),
    appendCalls,
    updateCalls,
    auditCalls,
  };
}

test('create rejects a bank that belongs to another agent', async () => {
  const { service } = loadPagosService({
    getAuthUserById: async (userId) => ({
      id: userId,
      nombre: 'Agente 1',
      username: 'agente1',
      role: 'agent',
      activo: true,
    }),
    getConfigBancoById: async (bancoId) => ({
      id: bancoId,
      nombre: 'BCP',
      propietario_id: 'AG-2',
    }),
  });

  await assert.rejects(
    () => service.create({
      usuario: 'Juan Perez',
      caja: 'Caja 1',
      banco_id: 'BK-9',
      monto: 120,
      tipo: 'Transferencia',
    }, {
      userId: 'AG-1',
      role: 'agent',
      nombre: 'Agente 1',
      user: 'Agente 1',
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test('create as admin can impersonate another agent and stores that agent name', async () => {
  const { service, appendCalls } = loadPagosService({
    getAuthUserById: async (userId) => {
      if (userId === 'AUTH-ADMIN') {
        return {
          id: 'AUTH-ADMIN',
          nombre: 'Administrador',
          username: 'admin',
          role: 'admin',
          activo: true,
        };
      }

      if (userId === 'AG-2') {
        return {
          id: 'AG-2',
          nombre: 'Agente 2',
          username: 'agente2',
          role: 'agent',
          activo: true,
        };
      }

      return null;
    },
    getConfigBancoById: async (bancoId) => ({
      id: bancoId,
      nombre: 'BBVA',
      propietario_id: 'AG-2',
    }),
  });

  const result = await service.create({
    usuario: 'Cliente Demo',
    caja: 'Caja 1',
    banco_id: 'BK-2',
    monto: 150,
    tipo: 'Yape',
    agente_id: 'AG-2',
  }, {
    userId: 'AUTH-ADMIN',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

  assert.equal(result.record.agente, 'Agente 2');
  assert.equal(appendCalls[0].data.agente, 'Agente 2');
});

test('update respects the owner of the original payment and blocks cross-bank edits', async () => {
  const { service } = loadPagosService({
    getAll: async () => ([
      {
        _rowIndex: 5,
        id: 'PAG-1',
        estado: 'activo',
        usuario: 'Juan Perez',
        caja: 'Caja 1',
        banco_id: 'BK-1',
        banco: 'BCP',
        monto: 120,
        tipo: 'Transferencia',
        comprobante_url: '',
        comprobante_file_id: '',
        fecha_comprobante: '2026-04-10T09:15:00',
        fecha_registro: '2026-04-10T09:15:00',
        agente: 'Agente 1',
      },
    ]),
    getAuthUsers: async () => ([
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', role: 'agent', activo: true },
      { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', role: 'agent', activo: true },
    ]),
    getConfigBancoById: async (bancoId) => {
      if (bancoId === 'BK-2') {
        return { id: 'BK-2', nombre: 'Interbank', propietario_id: 'AG-2' };
      }

      return { id: bancoId, nombre: String(bancoId), propietario_id: 'AG-1' };
    },
  });

  await assert.rejects(
    () => service.update('PAG-1', { banco_id: 'BK-2' }, {
      userId: 'AUTH-ADMIN',
      role: 'admin',
      nombre: 'Administrador',
      user: 'Administrador',
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test('update conserva el estado y audita before/after', async () => {
  const { service, updateCalls, auditCalls } = loadPagosService({
    getAll: async () => ([
      {
        _rowIndex: 5,
        id: 'PAG-1',
        estado: 'activo',
        usuario: 'Juan Perez',
        caja: 'Caja 1',
        banco_id: 'BK-1',
        banco: 'BCP',
        monto: 120,
        tipo: 'Transferencia',
        comprobante_url: '',
        comprobante_file_id: '',
        fecha_comprobante: '2026-04-10T09:15:00',
        fecha_registro: '2026-04-10T09:15:00',
        agente: 'Agente 1',
      },
    ]),
    getAuthUsers: async () => ([
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', role: 'agent', activo: true },
    ]),
  });

  const result = await service.update('PAG-1', { monto: 150, usuario: 'Juan P.' }, {
    userId: 'AUTH-ADMIN',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

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
        banco_id: 'BK-1',
        banco: 'BCP',
        monto: 150,
        tipo: 'Transferencia',
        comprobante_url: '',
        comprobante_file_id: '',
        fecha_comprobante: '2026-04-10T09:15:00',
        fecha_registro: '2026-04-10T09:15:00',
        agente: 'Agente 1',
      },
      headers: ['id', 'estado', 'usuario', 'caja', 'banco_id', 'banco', 'monto', 'tipo', 'comprobante_url', 'comprobante_file_id', 'fecha_comprobante', 'fecha_registro', 'agente'],
    },
  ]);
  assert.equal(auditCalls[0][0], 'update');
  assert.equal(auditCalls[0][1], 'pago');
  assert.equal(auditCalls[0][2], 'Administrador');
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
        banco_id: 'BK-2',
        banco: 'Interbank',
        monto: 80,
        tipo: 'Efectivo',
        comprobante_url: '',
        comprobante_file_id: '',
        fecha_comprobante: '',
        fecha_registro: '2026-04-12T10:20:00',
        agente: 'Agente 2',
      },
    ]),
    getAuthUsers: async () => ([
      { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', role: 'agent', activo: true },
    ]),
  });

  const result = await service.cancel('PAG-2', 'Error de registro', {
    userId: 'AUTH-ADMIN',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

  assert.equal(result.estado, 'anulado');
  assert.deepStrictEqual(updateCalls[0].data.estado, 'anulado');
  assert.equal(auditCalls[0][0], 'delete');
  assert.equal(auditCalls[0][1], 'pago');
  assert.equal(auditCalls[0][3].motivo, 'Error de registro');
});
