const test = require('node:test');
const assert = require('node:assert/strict');

function loadService({ serviceName, getAll, getConfigBancoById = async (bancoId) => (bancoId ? { id: bancoId, nombre: String(bancoId) } : null) }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const authPath = require.resolve('../services/auth.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve(`../services/${serviceName}.service`);

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[authPath];
  delete require.cache[configPath];

  const updateCalls = [];
  const deleteCalls = [];
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
      deleteRow: async (sheetName, rowIndex) => {
        deleteCalls.push({ sheetName, rowIndex });
        return { status: 'success', mode: 'memory' };
      },
      delete: async (sheetName, rowIndex) => {
        deleteCalls.push({ sheetName, rowIndex });
        return { status: 'success', mode: 'memory' };
      },
      findByColumn: async () => [],
      findById: async (sheetName, id) => {
        const rows = typeof getAll === 'function' ? await getAll(sheetName) : [];
        return rows.find((row) => row.id === id) || null;
      },
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
      getAuthUsers: async () => ([
        { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', role: 'agent', activo: true },
        { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', role: 'agent', activo: true },
        { id: 'AUTH-ADMIN', nombre: 'Administrador', username: 'admin', role: 'admin', activo: true },
      ]),
      getAuthUserById: async (userId) => {
        const users = await require.cache[authPath].exports.getAuthUsers();
        return users.find((user) => user.id === userId) || null;
      },
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
    service: require(`../services/${serviceName}.service`),
    updateCalls,
    deleteCalls,
    auditCalls,
  };
}

test('ingresos update/remove preserves state and hard deletes with audit snapshot', async () => {
  const { service, updateCalls, deleteCalls, auditCalls } = loadService({
    serviceName: 'ingresos',
    getAll: async () => ([
      {
        _rowIndex: 4,
        id: 'ING-1',
        estado: 'activo',
        agente: 'Agente 1',
        banco_id: 'BK-1',
        banco: 'BCP',
        monto: 250,
        fecha_movimiento: '2026-04-16T09:00:00',
        fecha_registro: '2026-04-16T09:05:00',
      },
    ]),
    getConfigBancoById: async (bancoId) => {
      if (bancoId === 'BK-1') {
        return { id: 'BK-1', nombre: 'BCP', propietario_id: 'AG-1' };
      }

      return { id: bancoId, nombre: String(bancoId), propietario_id: 'AG-1' };
    },
  });

  const updated = await service.update('ING-1', { monto: 275 }, 'admin-user');
  assert.equal(updated.estado, 'activo');
  assert.equal(updated.monto, 275);
  assert.equal(updateCalls[0].sheetName, 'ingresos');
  assert.equal(auditCalls[0][0], 'update');

  const removed = await service.remove('ING-1', 'admin-user');
  assert.deepStrictEqual(removed, { id: 'ING-1' });
  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(deleteCalls, [{ sheetName: 'ingresos', rowIndex: 4 }]);
  assert.equal(auditCalls[1][0], 'delete');
  assert.deepStrictEqual(auditCalls[1][3], {
    before: {
      id: 'ING-1',
      estado: 'activo',
      agente: 'Agente 1',
      banco_id: 'BK-1',
      banco: 'BCP',
      monto: 250,
      fecha_movimiento: '2026-04-16T09:00:00',
      fecha_registro: '2026-04-16T09:05:00',
    },
  });
});

test('gastos update/remove preserves state and hard deletes with audit snapshot', async () => {
  const { service, updateCalls, deleteCalls, auditCalls } = loadService({
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
        banco_id: 'BK-2',
        banco: 'Interbank',
        monto: 90,
      },
    ]),
    getConfigBancoById: async (bancoId) => {
      if (bancoId === 'BK-2') {
        return { id: 'BK-2', nombre: 'Interbank', propietario_id: 'AUTH-ADMIN' };
      }

      return { id: bancoId, nombre: String(bancoId), propietario_id: 'AUTH-ADMIN' };
    },
  });

  const updated = await service.update('GAS-1', { monto: 110, concepto: 'Papelería y útiles' }, {
    userId: 'AUTH-ADMIN',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });
  assert.equal(updated.estado, 'activo');
  assert.equal(updated.monto, 110);
  assert.equal(updateCalls[0].sheetName, 'gastos');
  assert.equal(auditCalls[0][0], 'update');

  const removed = await service.remove('GAS-1', {
    userId: 'AUTH-ADMIN',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });
  assert.deepStrictEqual(removed, { id: 'GAS-1' });
  assert.equal(updateCalls.length, 1);
  assert.deepStrictEqual(deleteCalls, [{ sheetName: 'gastos', rowIndex: 6 }]);
  assert.equal(auditCalls[1][0], 'delete');
  assert.deepStrictEqual(auditCalls[1][3], {
    before: {
      id: 'GAS-1',
      estado: '',
      fecha_gasto: '2026-04-15',
      fecha_registro: '2026-04-15T08:00:00',
      concepto: 'Papelería',
      categoria: 'Operativo',
      subcategoria: 'Material oficina',
      banco_id: 'BK-2',
      banco: 'Interbank',
      monto: 90,
    },
  });
});

test('ingresos y gastos remove devuelven 404 cuando el id no existe', async () => {
  for (const serviceName of ['ingresos', 'gastos']) {
    const { service, deleteCalls, auditCalls } = loadService({
      serviceName,
      getAll: async () => [],
    });

    await assert.rejects(
      () => service.remove(`${serviceName.toUpperCase()}-NOPE`, 'admin-user'),
      (error) => {
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    assert.deepStrictEqual(deleteCalls, []);
    assert.deepStrictEqual(auditCalls, []);
  }
});

test('ingresos create rejects a bank outside the selected agent scope', async () => {
  const { service } = loadService({
    serviceName: 'ingresos',
    getAll: async () => [],
    getConfigBancoById: async () => ({
      id: 'BK-9',
      nombre: 'BCP',
      propietario_id: 'AG-2',
    }),
  });

  await assert.rejects(
    () => service.create({
      agente: 'Agente 1',
      banco_id: 'BK-9',
      monto: 120,
      fecha_movimiento: '2026-04-18T09:00:00',
    }, {
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

test('gastos update rejects a bank outside the admin scope', async () => {
  const { service } = loadService({
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
        banco_id: 'BK-2',
        banco: 'Interbank',
        monto: 90,
      },
    ]),
    getConfigBancoById: async (bancoId) => {
      if (bancoId === 'BK-2') {
        return { id: 'BK-2', nombre: 'Interbank', propietario_id: 'AUTH-ADMIN' };
      }

      return { id: bancoId, nombre: String(bancoId), propietario_id: 'AG-2' };
    },
  });

  await assert.rejects(
    () => service.update('GAS-1', { banco_id: 'BK-9' }, {
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
