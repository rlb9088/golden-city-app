const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(value, envName) {
  if (!value) {
    throw new Error(`Missing required env var ${envName}.`);
  }

  return String(value).replace(/\/+$/, '');
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const raw = await response.text();
    let json = null;

    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    return { response, json, raw };
  } finally {
    clearTimeout(timeout);
  }
}

function assertStatus(response, expectedStatus, label, rawBody) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected ${expectedStatus} and got ${response.status}. Body: ${rawBody}`);
  }
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logSkip(message) {
  console.log(`SKIP ${message}`);
}

async function main() {
  const backendUrl = normalizeBaseUrl(process.env.PRODUCTION_BACKEND_URL, 'PRODUCTION_BACKEND_URL');
  const frontendUrl = normalizeBaseUrl(process.env.PRODUCTION_FRONTEND_URL, 'PRODUCTION_FRONTEND_URL');
  const adminUsername = process.env.PRODUCTION_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.PRODUCTION_ADMIN_PASSWORD;
  const agentUsername = process.env.PRODUCTION_AGENT_USERNAME;
  const agentPassword = process.env.PRODUCTION_AGENT_PASSWORD;

  const health = await requestJson(`${backendUrl}/api/health`);
  assertStatus(health.response, 200, 'GET /api/health', health.raw);
  if (health.json?.status !== 'ok') {
    throw new Error(`GET /api/health returned unexpected payload: ${health.raw}`);
  }
  logPass('Backend health check');

  const config = await requestJson(`${backendUrl}/api/config`);
  assertStatus(config.response, 200, 'GET /api/config', config.raw);
  logPass('Public config endpoint');

  const invalidLogin = await requestJson(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: adminUsername,
      password: '__invalid_password__',
    }),
  });
  assertStatus(invalidLogin.response, 401, 'POST /api/auth/login with invalid credentials', invalidLogin.raw);
  logPass('Invalid credentials return 401');

  if (adminPassword) {
    const adminLogin = await requestJson(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword,
      }),
    });
    assertStatus(adminLogin.response, 200, 'POST /api/auth/login as admin', adminLogin.raw);

    const adminAccessToken = adminLogin.json?.data?.accessToken;
    const adminRefreshToken = adminLogin.json?.data?.refreshToken;
    if (!adminAccessToken || !adminRefreshToken) {
      throw new Error(`Admin login did not return access and refresh tokens: ${adminLogin.raw}`);
    }
    logPass('Admin login returns access + refresh tokens');

    const pagos = await requestJson(`${backendUrl}/api/pagos`, {
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    assertStatus(pagos.response, 200, 'GET /api/pagos as admin', pagos.raw);
    logPass('Protected pagos endpoint with JWT');

    const balance = await requestJson(`${backendUrl}/api/balance`, {
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    assertStatus(balance.response, 200, 'GET /api/balance as admin', balance.raw);
    logPass('Protected balance endpoint with JWT');

    const audit = await requestJson(`${backendUrl}/api/audit`, {
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    assertStatus(audit.response, 200, 'GET /api/audit as admin', audit.raw);
    logPass('Protected audit endpoint with admin JWT');
  } else {
    logSkip('Admin login flow skipped because PRODUCTION_ADMIN_PASSWORD is not set');
  }

  if (agentUsername && agentPassword) {
    const agentLogin = await requestJson(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: agentUsername,
        password: agentPassword,
      }),
    });
    assertStatus(agentLogin.response, 200, 'POST /api/auth/login as agent', agentLogin.raw);
    const agentAccessToken = agentLogin.json?.data?.accessToken;
    const agentRefreshToken = agentLogin.json?.data?.refreshToken;
    if (!agentAccessToken || !agentRefreshToken) {
      throw new Error(`Agent login did not return access and refresh tokens: ${agentLogin.raw}`);
    }
    logPass('Agent login returns access + refresh tokens');
  } else {
    logSkip('Agent login flow skipped because PRODUCTION_AGENT_USERNAME / PRODUCTION_AGENT_PASSWORD are not set');
  }

  const frontendLoginPage = await requestJson(frontendUrl);
  assertStatus(frontendLoginPage.response, 200, 'GET frontend root', frontendLoginPage.raw);
  const normalizedFrontendMarkup = frontendLoginPage.raw.toLowerCase();
  if (
    !normalizedFrontendMarkup.includes('golden city')
    && !normalizedFrontendMarkup.includes('/balance')
    && !normalizedFrontendMarkup.includes('login')
  ) {
    throw new Error('Frontend root did not look like the expected login app shell.');
  }
  logPass('Frontend root responds successfully');

  console.log('Smoke test completed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
