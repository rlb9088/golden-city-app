const test = require('node:test');
const assert = require('node:assert/strict');

function getRouteStack(router, method, path) {
  const layer = router.stack.find((item) => item.route && item.route.path === path && item.route.methods[method]);

  if (!layer) {
    throw new Error(`No se encontro la ruta ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack.map((entry) => entry.handle.name || entry.name);
}

function getRouteIndex(router, method, path) {
  return router.stack.findIndex((item) => item.route && item.route.path === path && item.route.methods[method]);
}

function getRouteHandlers(router, method, path) {
  const layer = router.stack.find((item) => item.route && item.route.path === path && item.route.methods[method]);

  if (!layer) {
    throw new Error(`No se encontro la ruta ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack.map((entry) => entry.handle);
}

test('los GET de movimientos y balance requieren verifyToken + requireAuth', () => {
  const pagosRouter = require('../routes/pagos.routes');
  const ingresosRouter = require('../routes/ingresos.routes');
  const gastosRouter = require('../routes/gastos.routes');
  const bancosRouter = require('../routes/bancos.routes');
  const balanceRouter = require('../routes/balance.routes');

  assert.deepStrictEqual(getRouteStack(pagosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getAll']);
  assert.deepStrictEqual(getRouteStack(ingresosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getPagedAndFiltered']);
  assert.deepStrictEqual(getRouteStack(gastosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getPagedAndFiltered']);
  assert.deepStrictEqual(getRouteStack(bancosRouter, 'get', '/scoped'), ['verifyToken', 'requireAuth', 'getScoped']);
  assert.deepStrictEqual(getRouteStack(bancosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getPagedAndFiltered']);
  assert.deepStrictEqual(getRouteStack(balanceRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'validateQueryMiddleware', 'getGlobal']);
  assert.deepStrictEqual(getRouteStack(balanceRouter, 'get', '/mi-caja'), ['verifyToken', 'requireAuth', 'validateQueryMiddleware', 'getMiCaja']);
  assert.deepStrictEqual(getRouteStack(balanceRouter, 'get', '/:agente'), ['verifyToken', 'requireAuth', 'getByAgent']);
  assert.ok(getRouteIndex(balanceRouter, 'get', '/mi-caja') < getRouteIndex(balanceRouter, 'get', '/:agente'));
});

test('config mantiene el listado general publico y protege las tablas', () => {
  const configRouter = require('../routes/config.routes');

  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/'), ['getFullConfig']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/settings/:key'), ['verifyToken', 'requireAuth', 'validateSettingKey', 'getSetting']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'put', '/settings/:key'), ['verifyToken', 'requireAdmin', 'validateSettingKey', 'validateSettingUpsert', 'upsertSetting']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/settings/caja_inicio_mes/banco/:bancoId'), ['verifyToken', 'requireAuth', 'loadBankSettingContext', 'authorizeBankSettingRead', 'getCajaInicioMesByBanco']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'put', '/settings/caja_inicio_mes/banco/:bancoId'), ['verifyToken', 'requireAdmin', 'validateSettingUpsert', 'loadBankSettingContext', 'authorizeBankSettingWrite', 'upsertCajaInicioMesByBanco']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/:table'), ['verifyToken', 'requireAdmin', 'getTable']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'put', '/:table/:id/password'), ['verifyToken', 'requireAdmin', 'changePassword']);
});

test('config protege la consulta de caja_inicio_mes por banco cuando el banco no pertenece al agente', async () => {
  const servicePath = require.resolve('../services/config.service');
  const controllerPath = require.resolve('../controllers/config.controller');
  const routePath = require.resolve('../routes/config.routes');

  delete require.cache[routePath];
  delete require.cache[controllerPath];
  delete require.cache[servicePath];

  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      getConfigBancoById: async () => ({
        id: 'BK-1',
        nombre: 'Caja 1',
        propietario_id: 'AG-OWNER',
      }),
      getAdminBankIds: async () => new Set(),
      getAgentBankIds: async () => new Set(['BK-1']),
      getBankClassificationFromRecord: (record, adminIds, agentIds) => ({
        bankId: record.id,
        classification: agentIds.has(record.id) ? 'agente' : 'unknown',
      }),
      getSetting: async () => ({ value: 0 }),
      getCajaInicioMesByBanco: async () => ({ value: 0, fecha_efectiva: null }),
      upsertSetting: async () => ({ value: 0, fecha_efectiva: null }),
    },
  };

  require.cache[controllerPath] = {
    id: controllerPath,
    filename: controllerPath,
    loaded: true,
    exports: {
      getFullConfig: async () => ({}),
      getTable: async () => [],
      getSetting: async () => ({}),
      upsertSetting: async () => ({}),
      getCajaInicioMesByBanco: async () => ({}),
      upsertCajaInicioMesByBanco: async () => ({}),
      addToTable: async () => ({}),
      updateInTable: async () => ({}),
      changePassword: async () => ({}),
      removeFromTable: async () => ({}),
      importBatch: async () => ({}),
    },
  };

  try {
    const router = require('../routes/config.routes');
    const handlers = getRouteHandlers(router, 'get', '/settings/caja_inicio_mes/banco/:bancoId');
    const req = {
      originalUrl: '/api/config/settings/caja_inicio_mes/banco/BK-1',
      params: { bancoId: 'BK-1' },
      auth: { role: 'agent', userId: 'AG-OTHER' },
      user: { id: 'AG-OTHER' },
    };

    await new Promise((resolve, reject) => {
      handlers[2](req, {}, (nextError) => {
        if (nextError) {
          reject(nextError);
          return;
        }
        resolve();
      });
    });

    const error = await new Promise((resolve) => {
      handlers[3](req, {}, (nextError) => resolve(nextError));
    });

    assert.ok(error);
    assert.equal(error.statusCode, 403);
  } finally {
    delete require.cache[routePath];
    delete require.cache[controllerPath];
    delete require.cache[servicePath];
  }
});

test('auth expone login y refresh sin verifyToken, y protege me', () => {
  const authRouter = require('../routes/auth.routes');

  assert.deepStrictEqual(getRouteStack(authRouter, 'post', '/login'), ['login']);
  assert.deepStrictEqual(getRouteStack(authRouter, 'post', '/refresh'), ['refresh']);
  assert.deepStrictEqual(getRouteStack(authRouter, 'get', '/me'), ['verifyToken', 'me']);
});
