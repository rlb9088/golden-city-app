const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

function loadAuthService({ rows }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const servicePath = require.resolve('../services/auth.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll: async () => rows,
      append: async () => ({}),
      update: async () => ({}),
      deleteRow: async () => ({}),
      findByColumn: async () => [],
    },
  };

  return require('../services/auth.service');
}

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of keys) {
        const previousValue = previous.get(key);
        if (previousValue === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previousValue;
        }
      }
    });
}

test('login valida credenciales y genera JWT', async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  const passwordHash = await bcrypt.hash('secret123', 10);
  const authService = loadAuthService({
    rows: [
      {
        id: 'AUTH-1',
        username: 'admin',
        password_hash: passwordHash,
        role: 'admin',
        nombre: 'Administrador',
      },
    ],
  });

  const result = await authService.login('admin', 'secret123');

  assert.equal(result.user.username, 'admin');
  assert.equal(result.user.role, 'admin');
  assert.equal(result.user.nombre, 'Administrador');
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.expiresIn, '15m');

  const session = authService.verifyToken(result.accessToken);
  assert.deepStrictEqual(session, {
    userId: 'AUTH-1',
    username: 'admin',
    role: 'admin',
    nombre: 'Administrador',
  });
});

test('refresh genera un nuevo access token para un refresh token valido', async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  const passwordHash = await bcrypt.hash('secret123', 10);
  const authService = loadAuthService({
    rows: [
      {
        id: 'AUTH-1',
        username: 'admin',
        password_hash: passwordHash,
        role: 'admin',
        nombre: 'Administrador',
      },
    ],
  });

  const loginResult = await authService.login('admin', 'secret123');
  const refreshResult = await authService.refresh(loginResult.refreshToken);

  assert.ok(refreshResult.accessToken);
  assert.ok(refreshResult.refreshToken);
  assert.equal(refreshResult.user.userId, 'AUTH-1');
  assert.equal(refreshResult.expiresIn, '15m');
});

test('refresh rechaza tokens invalidos', async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  const authService = loadAuthService({ rows: [] });

  await assert.rejects(authService.refresh('nope'), /Refresh token invalido/);
});

test('ensureAuthSheetSeed prepara usuarios bootstrap cuando la hoja esta vacia', async () => {
  const writes = [];
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const servicePath = require.resolve('../services/auth.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll: async () => [],
      append: async (sheetName, data, headers) => {
        writes.push({ sheetName, data, headers });
        return {};
      },
      update: async () => ({}),
      deleteRow: async () => ({}),
      findByColumn: async () => [],
    },
  };

  const authService = require('../services/auth.service');
  const seeded = await authService.ensureAuthSheetSeed();

  assert.equal(seeded, true);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].sheetName, 'config_auth_users');
  assert.deepStrictEqual(writes[0].headers, ['id', 'username', 'password_hash', 'role', 'nombre']);
});

test('ensureAuthSheetSeed falla en produccion si falta JWT_SECRET', async () => {
  await withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: undefined,
    AUTH_JWT_SECRET: undefined,
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: 'admin-strong-secret',
    AUTH_BOOTSTRAP_AGENT_PASSWORD: 'agent-strong-secret',
  }, async () => {
    const authService = loadAuthService({
      rows: [
        {
          id: 'AUTH-1',
          username: 'admin',
          password_hash: await bcrypt.hash('secret123', 10),
          role: 'admin',
          nombre: 'Administrador',
        },
      ],
    });

    await assert.rejects(authService.ensureAuthSheetSeed(), /JWT_SECRET no configurada en produccion/);
  });
});

test('ensureAuthSheetSeed falla en produccion si faltan passwords bootstrap', async () => {
  await withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'production-secret',
    AUTH_JWT_SECRET: undefined,
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: undefined,
    AUTH_BOOTSTRAP_AGENT_PASSWORD: undefined,
  }, async () => {
    const authService = loadAuthService({
      rows: [
        {
          id: 'AUTH-1',
          username: 'admin',
          password_hash: await bcrypt.hash('secret123', 10),
          role: 'admin',
          nombre: 'Administrador',
        },
      ],
    });

    await assert.rejects(authService.ensureAuthSheetSeed(), /AUTH_BOOTSTRAP_ADMIN_PASSWORD no definida en produccion/);
  });
});

test('en desarrollo se registran warnings y se usan fallbacks inseguros', async () => {
  const warnings = [];
  const originalWarn = console.warn;

  await withEnv({
    NODE_ENV: 'development',
    JWT_SECRET: undefined,
    AUTH_JWT_SECRET: undefined,
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: undefined,
    AUTH_BOOTSTRAP_AGENT_PASSWORD: undefined,
  }, async () => {
    console.warn = (...args) => {
      warnings.push(args.join(' '));
    };

    try {
      const authService = loadAuthService({ rows: [] });
      const seeded = await authService.ensureAuthSheetSeed();

      assert.equal(seeded, true);
      assert.ok(warnings.some((message) => message.includes('JWT_SECRET not defined')));
      assert.ok(warnings.some((message) => message.includes('Bootstrap passwords not defined')));
    } finally {
      console.warn = originalWarn;
    }
  });
});
