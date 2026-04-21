const test = require('node:test');
const assert = require('node:assert/strict');

const { todayLima } = require('../config/timezone');

function addOneDay(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00-05:00`);
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function loadApp() {
  const appPath = require.resolve('../index');
  const authServicePath = require.resolve('../services/auth.service');
  const balanceServicePath = require.resolve('../services/balance.service');
  const balanceControllerPath = require.resolve('../controllers/balance.controller');
  const balanceRoutesPath = require.resolve('../routes/balance.routes');
  const authMiddlewarePath = require.resolve('../middleware/auth.middleware');
  const validateQueryPath = require.resolve('../middleware/validateQuery.middleware');

  delete require.cache[appPath];
  delete require.cache[authServicePath];
  delete require.cache[balanceServicePath];
  delete require.cache[balanceControllerPath];
  delete require.cache[balanceRoutesPath];
  delete require.cache[authMiddlewarePath];
  delete require.cache[validateQueryPath];

  const balanceCalls = [];

  require.cache[authServicePath] = {
    id: authServicePath,
    filename: authServicePath,
    loaded: true,
    exports: {
      verifyToken: () => ({
        userId: 'AUTH-TEST',
        username: 'tester',
        role: 'admin',
        nombre: 'Tester',
      }),
    },
  };

  require.cache[balanceServicePath] = {
    id: balanceServicePath,
    filename: balanceServicePath,
    loaded: true,
    exports: {
      getBalanceAt: async (params) => {
        balanceCalls.push(params);
        return {
          fecha: params.fecha,
          modo: params.fecha ? 'historico' : 'actual',
        };
      },
      getAgentBalance: async (agente) => ({
        agente,
        ingresos: 0,
        pagos: 0,
        balance: 0,
      }),
      getAgentCajaAt: async (params) => {
        balanceCalls.push({ ...params, route: 'mi-caja' });
        return {
          fecha: params.fecha,
          agente: params.agente,
          total: 123,
          movimiento: {
            montoInicial: 100,
            pagosDia: 10,
            saldoTotal: 90,
          },
          bancos: [
            { banco_id: 'BK-1', banco: 'Caja 1', saldo: 123 },
          ],
        };
      },
    },
  };

  const app = require('../index');
  const server = app.listen(0);

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    balanceCalls,
  };
}

function requestHeaders(ip) {
  return {
    authorization: 'Bearer test-token',
    'content-type': 'application/json',
    'x-forwarded-for': ip,
    'x-forwarded-proto': 'https',
  };
}

test.before(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
});

test('GET /api/balance sin fecha consulta el snapshot actual', async (t) => {
  const { server, baseUrl, balanceCalls } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`${baseUrl}/api/balance`, {
    headers: requestHeaders('203.0.113.21'),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepStrictEqual(body, {
    status: 'success',
    data: {
      fecha: null,
      modo: 'actual',
    },
  });
  assert.deepStrictEqual(balanceCalls, [{ fecha: null }]);
});

test('GET /api/balance con fecha valida pasa el parametro al servicio', async (t) => {
  const { server, baseUrl, balanceCalls } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`${baseUrl}/api/balance?fecha=2026-04-15`, {
    headers: requestHeaders('203.0.113.22'),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepStrictEqual(body, {
    status: 'success',
    data: {
      fecha: '2026-04-15',
      modo: 'historico',
    },
  });
  assert.deepStrictEqual(balanceCalls, [{ fecha: '2026-04-15' }]);
});

test('GET /api/balance/mi-caja responde con la caja del usuario autenticado', async (t) => {
  const { server, baseUrl, balanceCalls } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`${baseUrl}/api/balance/mi-caja`, {
    headers: requestHeaders('203.0.113.25'),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepStrictEqual(body, {
    status: 'success',
    data: {
      fecha: null,
      agente: 'Tester',
      total: 123,
      movimiento: {
        montoInicial: 100,
        pagosDia: 10,
        saldoTotal: 90,
      },
      bancos: [
        { banco_id: 'BK-1', banco: 'Caja 1', saldo: 123 },
      ],
    },
  });
  assert.deepStrictEqual(balanceCalls, [
    { agente: 'Tester', fecha: null, route: 'mi-caja' },
  ]);
});

test('GET /api/balance/mi-caja rechaza fechas invalidas', async (t) => {
  const { server, baseUrl, balanceCalls } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`${baseUrl}/api/balance/mi-caja?fecha=2026-4-15`, {
    headers: requestHeaders('203.0.113.26'),
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'Parámetros de consulta inválidos.');
  assert.deepStrictEqual(body.details, [
    {
      field: 'fecha',
      message: 'La fecha debe tener formato YYYY-MM-DD',
    },
  ]);
  assert.deepStrictEqual(balanceCalls, []);
});

test('GET /api/balance rechaza fechas invalidas y futuras', async (t) => {
  const { server, baseUrl, balanceCalls } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const invalidResponse = await fetch(`${baseUrl}/api/balance?fecha=2026-4-15`, {
    headers: requestHeaders('203.0.113.23'),
  });

  assert.equal(invalidResponse.status, 400);
  const invalidBody = await invalidResponse.json();
  assert.equal(invalidBody.error, 'Parámetros de consulta inválidos.');
  assert.deepStrictEqual(invalidBody.details, [
    {
      field: 'fecha',
      message: 'La fecha debe tener formato YYYY-MM-DD',
    },
  ]);

  const futureDate = addOneDay(todayLima());
  const futureResponse = await fetch(`${baseUrl}/api/balance?fecha=${futureDate}`, {
    headers: requestHeaders('203.0.113.24'),
  });

  assert.equal(futureResponse.status, 400);
  const futureBody = await futureResponse.json();
  assert.equal(futureBody.error, 'La fecha no puede ser futura.');
  assert.deepStrictEqual(balanceCalls, []);
});

test('GET /api/balance/mi-caja sin token responde 401', async (t) => {
  const { server, baseUrl } = loadApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`${baseUrl}/api/balance/mi-caja`);

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'Autenticación requerida.');
});
