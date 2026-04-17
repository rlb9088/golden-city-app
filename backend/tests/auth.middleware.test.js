const test = require('node:test');
const assert = require('node:assert/strict');

function loadMiddleware({ verifyTokenImpl }) {
  const authServicePath = require.resolve('../services/auth.service');
  const middlewarePath = require.resolve('../middleware/auth.middleware');

  delete require.cache[middlewarePath];
  delete require.cache[authServicePath];

  require.cache[authServicePath] = {
    id: authServicePath,
    filename: authServicePath,
    loaded: true,
    exports: {
      verifyToken: verifyTokenImpl,
    },
  };

  return require('../middleware/auth.middleware');
}

test('verifyToken extrae el bearer token y adjunta req.auth', () => {
  const middleware = loadMiddleware({
    verifyTokenImpl: (token) => ({
      userId: 'AUTH-1',
      username: token,
      role: 'admin',
      nombre: 'Administrador',
    }),
  });

  const req = {
    originalUrl: '/api/pagos',
    headers: {
      authorization: 'Bearer test-token',
    },
  };

  let nextCalled = false;
  middleware.verifyToken(req, {}, (error) => {
    nextCalled = true;
    assert.equal(error, undefined);
  });

  assert.equal(nextCalled, true);
  assert.deepStrictEqual(req.auth, {
    userId: 'AUTH-1',
    username: 'test-token',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });
});

test('requireAdmin rechaza usuarios no administradores', () => {
  const middleware = loadMiddleware({
    verifyTokenImpl: () => ({
      userId: 'AUTH-2',
      username: 'agent',
      role: 'agent',
      nombre: 'Agente',
    }),
  });

  const req = {
    originalUrl: '/api/config',
    headers: {
      authorization: 'Bearer test-token',
    },
  };

  middleware.verifyToken(req, {}, () => {});

  let capturedError = null;
  middleware.requireAdmin(req, {}, (error) => {
    capturedError = error;
  });

  assert.ok(capturedError);
  assert.equal(capturedError.statusCode, 403);
});
