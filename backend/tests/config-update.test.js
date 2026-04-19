const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfigService({ getAll, auditLog }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const servicePath = require.resolve('../services/config.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];

  const updateCalls = [];
  const appendCalls = [];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      deleteRow: async () => ({}),
      append: async (sheetName, data, headers) => {
        appendCalls.push({ sheetName, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      update: async (sheetName, rowIndex, data, headers) => {
        updateCalls.push({ sheetName, rowIndex, data, headers });
        return { status: 'success', mode: 'memory' };
      },
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

  return {
    service: require('../services/config.service'),
    updateCalls,
    appendCalls,
  };
}

function loadConfigController({ updateInTable, changePassword }) {
  const servicePath = require.resolve('../services/config.service');
  const controllerPath = require.resolve('../controllers/config.controller');

  delete require.cache[controllerPath];
  delete require.cache[servicePath];

  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      updateInTable,
      updateAgentPassword: changePassword,
    },
  };

  return require('../controllers/config.controller');
}

test('updateInTable actualiza una fila real y registra before/after', async () => {
  const auditCalls = [];
  const { service, updateCalls } = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_bancos') {
        return [
          {
            _rowIndex: 8,
            id: 'BK-10',
            nombre: 'Banco Demo',
            propietario: '',
            propietario_id: 'AG-1',
          },
        ];
      }

      if (sheetName === 'config_agentes') {
        return [
          {
            _rowIndex: 2,
            id: 'AG-1',
            nombre: 'Agente 1',
            username: 'agente1',
            password_hash: 'hash-1',
            role: 'agent',
            activo: true,
          },
          {
            _rowIndex: 3,
            id: 'AG-3',
            nombre: 'Agente 3',
            username: 'agente3',
            password_hash: 'hash-3',
            role: 'admin',
            activo: true,
          },
        ];
      }

      return [];
    },
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-10' };
    },
  });

  const result = await service.updateInTable('bancos', 'BK-10', {
    nombre: 'Banco Premium',
    propietario_id: 'AG-3',
  }, 'tester');

  assert.deepStrictEqual(result, {
    id: 'BK-10',
    nombre: 'Banco Premium',
    propietario: 'Agente 3',
    propietario_id: 'AG-3',
  });
  assert.deepStrictEqual(updateCalls, [
    {
      sheetName: 'config_bancos',
      rowIndex: 8,
      data: {
        _rowIndex: 8,
        id: 'BK-10',
        nombre: 'Banco Premium',
        propietario: 'Agente 3',
        propietario_id: 'AG-3',
      },
      headers: ['id', 'nombre', 'propietario', 'propietario_id'],
    },
  ]);
  assert.equal(auditCalls[0][0], 'update');
  assert.equal(auditCalls[0][1], 'config_bancos');
  assert.equal(auditCalls[0][2], 'tester');
  assert.deepStrictEqual(auditCalls[0][3], {
    before: {
      id: 'BK-10',
      nombre: 'Banco Demo',
      propietario: '',
      propietario_id: 'AG-1',
    },
    after: {
      id: 'BK-10',
      nombre: 'Banco Premium',
      propietario: 'Agente 3',
      propietario_id: 'AG-3',
    },
    changes: {
      nombre: 'Banco Premium',
      propietario: 'Agente 3',
      propietario_id: 'AG-3',
    },
  });
});

test('addToTable valida el propietario_id del banco antes de persistir', async () => {
  const auditCalls = [];
  const { service, appendCalls } = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_agentes') {
        return [
          { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', password_hash: '', role: 'agent', activo: true },
          { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', password_hash: '', role: 'agent', activo: true },
        ];
      }

      return [];
    },
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-13' };
    },
  });

  const result = await service.addToTable('bancos', {
    nombre: 'Banco Demo',
    propietario_id: 'AG-2',
  }, 'tester');

  assert.match(result.id, /^BAN-/);
  assert.deepStrictEqual(result, {
    id: result.id,
    nombre: 'Banco Demo',
    propietario: 'Agente 2',
    propietario_id: 'AG-2',
  });
  assert.deepStrictEqual(appendCalls, [
    {
      sheetName: 'config_bancos',
      data: {
        id: result.id,
        nombre: 'Banco Demo',
        propietario: 'Agente 2',
        propietario_id: 'AG-2',
      },
      headers: ['id', 'nombre', 'propietario', 'propietario_id'],
    },
  ]);
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][1], 'config_bancos');
  assert.equal(auditCalls[0][2], 'tester');
  assert.deepStrictEqual(auditCalls[0][3], {
    id: result.id,
    nombre: 'Banco Demo',
    propietario: 'Agente 2',
    propietario_id: 'AG-2',
  });
});

test('addToTable rechaza propietario_id inexistente en bancos', async () => {
  const { service } = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_agentes') {
        return [
          { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', password_hash: '', role: 'agent', activo: true },
        ];
      }

      return [];
    },
    auditLog: async () => ({ id: 'AUD-14' }),
  });

  await assert.rejects(
    () => service.addToTable('bancos', {
      nombre: 'Banco Fallido',
      propietario_id: 'AG-999',
    }, 'tester'),
    (error) => error?.statusCode === 400 && /no existe en configuracion/i.test(error.message),
  );
});

test('getTable hidrata propietario_id legacy en bancos a partir del propietario', async () => {
  const { service } = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_bancos') {
        return [
          {
            _rowIndex: 8,
            id: 'BK-10',
            nombre: 'Banco Legacy',
            propietario: 'Agente 3',
          },
        ];
      }

      if (sheetName === 'config_agentes') {
        return [
          {
            _rowIndex: 2,
            id: 'AG-1',
            nombre: 'Agente 1',
            username: 'agente1',
            password_hash: 'hash-1',
            role: 'agent',
            activo: true,
          },
          {
            _rowIndex: 3,
            id: 'AG-3',
            nombre: 'Agente 3',
            username: 'agente3',
            password_hash: 'hash-3',
            role: 'admin',
            activo: true,
          },
        ];
      }

      return [];
    },
    auditLog: async () => ({ id: 'AUD-17' }),
  });

  const result = await service.getTable('bancos');

  assert.deepStrictEqual(result, [
    {
      _rowIndex: 8,
      id: 'BK-10',
      nombre: 'Banco Legacy',
      propietario: 'Agente 3',
      propietario_id: 'AG-3',
    },
  ]);
});

test('updateInTable actualiza seed data de agentes sin tocar repo.update', async () => {
  const auditCalls = [];
  const { service, updateCalls } = loadConfigService({
    getAll: async () => [],
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-11' };
    },
  });

  const result = await service.updateInTable('agentes', 'AG-1', {
    nombre: 'Agente Principal',
    username: 'principal',
    role: 'admin',
    activo: true,
  }, 'tester');

  assert.deepStrictEqual(result, {
    id: 'AG-1',
    nombre: 'Agente Principal',
    username: 'principal',
    role: 'admin',
    activo: true,
  });
  assert.deepStrictEqual(updateCalls, []);
  assert.deepStrictEqual(await service.getTable('agentes'), [
    { id: 'AG-1', nombre: 'Agente Principal', username: 'principal', role: 'admin', activo: true },
    { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', role: 'agent', activo: true },
    { id: 'AG-3', nombre: 'Agente 3', username: 'agente3', role: 'agent', activo: true },
  ]);
  assert.equal(auditCalls[0][0], 'update');
  assert.equal(auditCalls[0][1], 'config_agentes');
});

test('updateInTable valida username unico en agentes', async () => {
  const { service } = loadConfigService({
    getAll: async () => [
      {
        _rowIndex: 2,
        id: 'AG-1',
        nombre: 'Agente 1',
        username: 'agente1',
        password_hash: 'hash-1',
        role: 'admin',
        activo: true,
      },
      {
        _rowIndex: 3,
        id: 'AG-2',
        nombre: 'Agente 2',
        username: 'agente2',
        password_hash: 'hash-2',
        role: 'agent',
        activo: true,
      },
    ],
    auditLog: async () => ({ id: 'AUD-15' }),
  });

  await assert.rejects(
    () => service.updateInTable('agentes', 'AG-2', {
      username: 'agente1',
    }, 'tester'),
    /username ya existe/i,
  );
});

test('updateAgentPassword rota la contrasena y audita el cambio', async () => {
  const auditCalls = [];
  const { service, updateCalls } = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_agentes') {
        return [
          {
            _rowIndex: 2,
            id: 'AG-1',
            nombre: 'Administrador',
            username: 'admin',
            password_hash: 'hash-old',
            role: 'admin',
            activo: true,
          },
        ];
      }

      return [];
    },
    auditLog: async (...args) => {
      auditCalls.push(args);
      return { id: 'AUD-16' };
    },
  });

  const result = await service.updateAgentPassword('AG-1', 'new-secret', 'tester');

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].sheetName, 'config_agentes');
  assert.equal(updateCalls[0].rowIndex, 2);
  assert.equal(updateCalls[0].data.password_hash.length > 0, true);
  assert.equal(result.id, 'AG-1');
  assert.equal(result.username, 'admin');
  assert.equal(auditCalls[0][0], 'update_password');
  assert.equal(auditCalls[0][1], 'config_agentes');
  assert.equal(auditCalls[0][2], 'tester');
});

test('updateInTable del controller propaga usuario y payload al service', async () => {
  let receivedArgs = null;
  const controller = loadConfigController({
    updateInTable: async (table, id, patch, user) => {
      receivedArgs = { table, id, patch, user };
      return { id, ...patch };
    },
    changePassword: async () => ({ id: 'AG-1' }),
  });

  const req = {
    params: { table: 'cajas', id: 'CJ-1' },
    body: { nombre: 'Caja Central' },
    auth: { user: 'controller-user' },
  };
  const res = {
    jsonPayload: null,
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };

  await controller.updateInTable(req, res);

  assert.deepStrictEqual(receivedArgs, {
    table: 'cajas',
    id: 'CJ-1',
    patch: { nombre: 'Caja Central' },
    user: 'controller-user',
  });
  assert.deepStrictEqual(res.jsonPayload, {
    status: 'success',
    data: { id: 'CJ-1', nombre: 'Caja Central' },
  });
});

test('changePassword del controller propaga el password al service', async () => {
  let receivedArgs = null;
  const controller = loadConfigController({
    updateInTable: async () => ({}),
    changePassword: async (id, password, user) => {
      receivedArgs = { id, password, user };
      return { id };
    },
  });

  const req = {
    params: { table: 'agentes', id: 'AG-1' },
    body: { password: 'new-secret' },
    auth: { user: 'controller-user' },
  };
  const res = {
    jsonPayload: null,
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };

  await controller.changePassword(req, res);

  assert.deepStrictEqual(receivedArgs, {
    id: 'AG-1',
    password: 'new-secret',
    user: 'controller-user',
  });
  assert.deepStrictEqual(res.jsonPayload, {
    status: 'success',
    data: { id: 'AG-1' },
  });
});

test('updateInTable lanza NotFoundError si el registro no existe', async () => {
  const { service } = loadConfigService({
    getAll: async () => [],
    auditLog: async () => ({ id: 'AUD-12' }),
  });

  await assert.rejects(
    () => service.updateInTable('tipos_pago', 'TIP-999', { nombre: 'Nuevo' }, 'tester'),
    (error) => error?.statusCode === 404 && /no se encontro el registro/i.test(error.message),
  );
});
