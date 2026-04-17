const fs = require('fs');
const path = require('path');

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
  /api[-_]?key/i,
];

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function shouldRedactKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key)));
}

function sanitize(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      statusCode: value.statusCode || value.status,
      details: sanitize(value.details, seen),
      context: sanitize(value.context, seen),
    };
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      shouldRedactKey(key) ? REDACTED_VALUE : sanitize(nestedValue, seen),
    ]),
  );
}

function resolveLogDir() {
  const configuredDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(process.cwd(), configuredDir);
}

function shouldPersistToFile() {
  return process.env.NODE_ENV === 'production';
}

function ensureLogDir() {
  const logDir = resolveLogDir();
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function resolveLogFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(ensureLogDir(), `app-${date}.log`);
}

function writeToConsole(level, line) {
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function write(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: String(level || 'info').toUpperCase(),
    message,
    ...sanitize(meta),
  };

  const line = JSON.stringify(entry);
  writeToConsole(level, line);

  if (!shouldPersistToFile()) {
    return entry;
  }

  try {
    fs.appendFileSync(resolveLogFile(), `${line}\n`, 'utf8');
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Failed to persist log entry',
      error: sanitize(error),
    }));
  }

  return entry;
}

module.exports = {
  sanitize,
  info(message, meta) {
    return write('info', message, meta);
  },
  warn(message, meta) {
    return write('warn', message, meta);
  },
  error(message, meta) {
    return write('error', message, meta);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV !== 'development') {
      return null;
    }

    return write('info', message, {
      ...meta,
      debug: true,
    });
  },
};
