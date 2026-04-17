const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadLogger(envOverrides = {}) {
  const loggerPath = require.resolve('../lib/logger');
  const previous = new Map(Object.keys(envOverrides).map((key) => [key, process.env[key]]));

  delete require.cache[loggerPath];

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const logger = require('../lib/logger');

  return {
    logger,
    restore() {
      delete require.cache[loggerPath];
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

test('logger sanea credenciales sensibles en consola', () => {
  const lines = [];
  const originalWarn = console.warn;
  console.warn = (line) => lines.push(line);

  const { logger, restore } = loadLogger({
    NODE_ENV: 'development',
    LOG_DIR: undefined,
  });

  try {
    logger.warn('Sensitive payload', {
      password: 'super-secret',
      nested: {
        token: 'abc123',
        authorization: 'Bearer xyz',
      },
      user: 'admin',
    });
  } finally {
    restore();
    console.warn = originalWarn;
  }

  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.equal(payload.password, '[REDACTED]');
  assert.equal(payload.nested.token, '[REDACTED]');
  assert.equal(payload.nested.authorization, '[REDACTED]');
  assert.equal(payload.user, 'admin');
});

test('logger persiste archivos JSON en produccion', () => {
  const lines = [];
  const originalLog = console.log;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-logger-'));
  console.log = (line) => lines.push(line);

  const { logger, restore } = loadLogger({
    NODE_ENV: 'production',
    LOG_DIR: tempDir,
  });

  try {
    logger.info('Persisted message', {
      context: { component: 'test' },
    });
  } finally {
    restore();
    console.log = originalLog;
  }

  const files = fs.readdirSync(tempDir);
  assert.equal(files.length, 1);
  const logPath = path.join(tempDir, files[0]);
  const persistedLine = fs.readFileSync(logPath, 'utf8').trim();
  const payload = JSON.parse(persistedLine);

  assert.equal(lines.length, 1);
  assert.equal(payload.message, 'Persisted message');
  assert.equal(payload.context.component, 'test');

  fs.rmSync(tempDir, { recursive: true, force: true });
});
