const test = require('node:test');
const assert = require('node:assert/strict');

function getRouteStack(router, method, path) {
  const layer = router.stack.find((item) => item.route && item.route.path === path && item.route.methods[method]);

  if (!layer) {
    throw new Error(`No se encontro la ruta ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack.map((entry) => entry.handle.name || entry.name);
}

test('los GET de movimientos y balance requieren verifyToken + requireAuth', () => {
  const pagosRouter = require('../routes/pagos.routes');
  const ingresosRouter = require('../routes/ingresos.routes');
  const gastosRouter = require('../routes/gastos.routes');
  const bancosRouter = require('../routes/bancos.routes');
  const balanceRouter = require('../routes/balance.routes');

  assert.deepStrictEqual(getRouteStack(pagosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getAll']);
  assert.deepStrictEqual(getRouteStack(ingresosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getAll']);
  assert.deepStrictEqual(getRouteStack(gastosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getAll']);
  assert.deepStrictEqual(getRouteStack(bancosRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getAll']);
  assert.deepStrictEqual(getRouteStack(balanceRouter, 'get', '/'), ['verifyToken', 'requireAuth', 'getGlobal']);
  assert.deepStrictEqual(getRouteStack(balanceRouter, 'get', '/:agente'), ['verifyToken', 'requireAuth', 'getByAgent']);
});

test('config mantiene el listado general publico y protege las tablas', () => {
  const configRouter = require('../routes/config.routes');

  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/'), ['getFullConfig']);
  assert.deepStrictEqual(getRouteStack(configRouter, 'get', '/:table'), ['verifyToken', 'requireAdmin', 'getTable']);
});

test('auth expone login y refresh sin verifyToken, y protege me', () => {
  const authRouter = require('../routes/auth.routes');

  assert.deepStrictEqual(getRouteStack(authRouter, 'post', '/login'), ['login']);
  assert.deepStrictEqual(getRouteStack(authRouter, 'post', '/refresh'), ['refresh']);
  assert.deepStrictEqual(getRouteStack(authRouter, 'get', '/me'), ['verifyToken', 'me']);
});
