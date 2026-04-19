const test = require('node:test');
const assert = require('node:assert/strict');

function loadSheetsClient({ env = {} } = {}) {
  const modulePath = require.resolve('../config/sheetsClient');
  delete require.cache[modulePath];

  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  return {
    module: require('../config/sheetsClient'),
    restore,
  };
}

test('getSheetsClient usa GOOGLE_CREDENTIALS_BASE64 sin tocar archivos locales', async () => {
  const credentials = {
    client_email: 'service-account@golden-city.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    project_id: 'golden-city',
  };
  const encoded = Buffer.from(JSON.stringify(credentials), 'utf8').toString('base64');

  const originalGoogleAuth = require('googleapis').google.auth.GoogleAuth;
  let receivedOptions = null;

  class GoogleAuthMock {
    constructor(options) {
      receivedOptions = options;
    }

    async getClient() {
      return { kind: 'mock-client' };
    }
  }

  require('googleapis').google.auth.GoogleAuth = GoogleAuthMock;

  const { module: sheetsClient, restore } = loadSheetsClient({
    env: {
      GOOGLE_CREDENTIALS_BASE64: encoded,
      GOOGLE_SHEET_ID: 'sheet-id',
    },
  });

  try {
    const client = await sheetsClient.getSheetsClient();

    assert.ok(client);
    assert.deepStrictEqual(receivedOptions.credentials, credentials);
    assert.equal(Object.prototype.hasOwnProperty.call(receivedOptions, 'keyFile'), false);
  } finally {
    require('googleapis').google.auth.GoogleAuth = originalGoogleAuth;
    restore();
  }
});

test('getSheetsClient cae a modo in-memory si faltan credenciales base64', async () => {
  const { module: sheetsClient, restore } = loadSheetsClient({
    env: {
      GOOGLE_CREDENTIALS_BASE64: undefined,
      GOOGLE_SHEET_ID: 'sheet-id',
    },
  });

  try {
    const client = await sheetsClient.getSheetsClient();
    assert.equal(client, null);
  } finally {
    restore();
  }
});
