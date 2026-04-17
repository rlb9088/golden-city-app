const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
process.env.AUTH_BOOTSTRAP_AGENT_PASSWORD = process.env.AUTH_BOOTSTRAP_AGENT_PASSWORD || 'agent123';

const app = require('../index');

const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${server.address().port}`;

test.after(() => new Promise((resolve) => server.close(resolve)));

function requestHeaders(ip) {
  return {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
    'x-forwarded-proto': 'https',
  };
}

test('helmet expone headers de seguridad en /api/health', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: requestHeaders('203.0.113.10'),
  });

  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-security-policy'));
  assert.ok(response.headers.get('x-frame-options'));
  assert.ok(response.headers.get('x-content-type-options'));
  assert.ok(response.headers.get('strict-transport-security'));
});

test('el login bloquea intentos repetidos y no cuenta los exitosos', async () => {
  const ip = '203.0.113.11';
  const invalidBody = JSON.stringify({
    username: 'admin',
    password: 'incorrecto',
  });
  const validBody = JSON.stringify({
    username: 'admin',
    password: 'admin123',
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: requestHeaders(ip),
      body: invalidBody,
    });

    assert.equal(response.status, 401);
  }

  const successResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: requestHeaders(ip),
    body: validBody,
  });

  assert.equal(successResponse.status, 200);

  const fifthFailedAttempt = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: requestHeaders(ip),
    body: invalidBody,
  });

  assert.equal(fifthFailedAttempt.status, 401);

  const sixthFailedAttempt = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: requestHeaders(ip),
    body: invalidBody,
  });

  assert.equal(sixthFailedAttempt.status, 429);
});

test('el limiter global sigue protegiendo endpoints comunes', async () => {
  const ip = '203.0.113.12';

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: requestHeaders(ip),
    });

    assert.equal(response.status, 401);
  }

  const blockedResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: requestHeaders(ip),
  });

  assert.equal(blockedResponse.status, 429);
});
