const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const bootstrapEnvPath = require.resolve('../config/bootstrapEnv');

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

test('bootstrapGoogleCredentialsFromBase64 genera un archivo temporal reutilizable', async () => {
  delete require.cache[bootstrapEnvPath];
  const { bootstrapGoogleCredentialsFromBase64 } = require('../config/bootstrapEnv');
  const expectedPayload = JSON.stringify({ project_id: 'golden-city-prod' });
  const encodedPayload = Buffer.from(expectedPayload, 'utf8').toString('base64');
  const expectedPath = path.join(os.tmpdir(), 'appgolden-google-creds.json');

  await withEnv({
    GOOGLE_CREDENTIALS_BASE64: encodedPayload,
    GOOGLE_APPLICATION_CREDENTIALS: undefined,
  }, async () => {
    const credentialsPath = bootstrapGoogleCredentialsFromBase64();

    assert.equal(credentialsPath, expectedPath);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, expectedPath);
    assert.equal(fs.readFileSync(credentialsPath, 'utf8'), expectedPayload);

    fs.unlinkSync(credentialsPath);
  });
});

test('bootstrapGoogleCredentialsFromBase64 no modifica el entorno si no hay credenciales embebidas', () => {
  delete require.cache[bootstrapEnvPath];
  const { bootstrapGoogleCredentialsFromBase64 } = require('../config/bootstrapEnv');

  return withEnv({
    GOOGLE_CREDENTIALS_BASE64: undefined,
    GOOGLE_APPLICATION_CREDENTIALS: 'C:\\existing-creds.json',
  }, async () => {
    const credentialsPath = bootstrapGoogleCredentialsFromBase64();

    assert.equal(credentialsPath, null);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'C:\\existing-creds.json');
  });
});
