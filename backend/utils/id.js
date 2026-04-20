const crypto = require('node:crypto');

function createPrefixedId(prefix) {
  const normalizedPrefix = String(prefix ?? '').trim().toUpperCase();
  if (!normalizedPrefix) {
    throw new Error('El prefijo del ID es obligatorio.');
  }

  return `${normalizedPrefix}-${crypto.randomUUID()}`;
}

module.exports = { createPrefixedId };
