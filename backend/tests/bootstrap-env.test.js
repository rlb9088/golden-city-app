const test = require('node:test');
const assert = require('node:assert/strict');

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

test('bootstrapEnvironment no toca GOOGLE_APPLICATION_CREDENTIALS', async () => {
  delete require.cache[bootstrapEnvPath];
  const { bootstrapEnvironment } = require('../config/bootstrapEnv');

  await withEnv({
    GOOGLE_CREDENTIALS_BASE64: Buffer.from(JSON.stringify({ project_id: 'golden-city-prod' }), 'utf8').toString('base64'),
    GOOGLE_APPLICATION_CREDENTIALS: 'C:\\existing-creds.json',
  }, async () => {
    const result = bootstrapEnvironment();

    assert.equal(result, null);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'C:\\existing-creds.json');
  });
});

test('bootstrapEnvironment no modifica el entorno si no hay credenciales embebidas', () => {
  delete require.cache[bootstrapEnvPath];
  const { bootstrapEnvironment } = require('../config/bootstrapEnv');

  return withEnv({
    GOOGLE_CREDENTIALS_BASE64: undefined,
    GOOGLE_APPLICATION_CREDENTIALS: 'C:\\existing-creds.json',
  }, async () => {
    const result = bootstrapEnvironment();

    assert.equal(result, null);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'C:\\existing-creds.json');
  });
});
