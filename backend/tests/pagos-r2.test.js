const test = require('node:test');
const assert = require('node:assert/strict');

function loadPagosService({
  getAll,
  uploadReceipt,
  validateReferences = async () => [],
  getConfigBancoById = async (bancoId) => (bancoId ? { id: bancoId, nombre: String(bancoId) } : null),
}) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const r2Path = require.resolve('../services/r2.service');
  const servicePath = require.resolve('../services/pagos.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[configPath];
  delete require.cache[r2Path];

  const appendCalls = [];
  const auditCalls = [];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async (sheetName, data, headers) => {
        appendCalls.push({ sheetName, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      update: async () => ({}),
      deleteRow: async () => ({}),
      findByColumn: async () => [],
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: async (...args) => {
        auditCalls.push(args);
        return { id: 'AUD-1' };
      },
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      validateReferences,
      getConfigBancoById,
    },
  };

  require.cache[r2Path] = {
    id: r2Path,
    filename: r2Path,
    loaded: true,
    exports: {
      uploadReceipt,
    },
  };

  return {
    service: require('../services/pagos.service'),
    appendCalls,
    auditCalls,
  };
}

test('create stores R2 links when the upload succeeds', async () => {
  const { service, appendCalls, auditCalls } = loadPagosService({
    getAll: async () => [],
    uploadReceipt: async () => ({
      key: 'receipts/123-abc.jpg',
      url: 'https://r2.example.com/receipts/123-abc.jpg',
    }),
  });

  const result = await service.create({
    usuario: 'Juan Perez',
    caja: 'Caja 1',
    banco_id: 'BK-1',
    monto: 150,
    tipo: 'Transferencia',
    comprobante_base64: 'data:image/jpeg;base64,ZmFrZQ==',
    fecha_comprobante: '2026-04-17T09:30:00',
  }, 'agente-1');

  assert.equal(result.record.comprobante_file_id, 'receipts/123-abc.jpg');
  assert.equal(result.record.comprobante_url, 'https://r2.example.com/receipts/123-abc.jpg');
  assert.equal(result.warnings.length, 0);
  assert.equal(appendCalls[0].data.comprobante_file_id, 'receipts/123-abc.jpg');
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][3].comprobante_file_id, 'receipts/123-abc.jpg');
});

test('create continues when R2 upload fails and persists blank receipt fields', async () => {
  const { service, appendCalls, auditCalls } = loadPagosService({
    getAll: async () => [],
    uploadReceipt: async () => {
      throw new Error('R2 unavailable');
    },
  });

  const result = await service.create({
    usuario: 'Maria Lopez',
    caja: 'Caja 2',
    banco_id: 'BK-2',
    monto: 80,
    tipo: 'Efectivo',
    comprobante_base64: 'data:image/jpeg;base64,ZmFrZQ==',
    fecha_comprobante: '2026-04-17T10:00:00',
  }, 'agente-2');

  assert.equal(result.record.comprobante_url, '');
  assert.equal(result.record.comprobante_file_id, '');
  assert.equal(result.warnings.length, 1);
  assert.equal(appendCalls[0].data.comprobante_url, '');
  assert.equal(appendCalls[0].data.comprobante_file_id, '');
  assert.equal(auditCalls[0][0], 'create');
  assert.match(String(auditCalls[0][3].receipt_warning || ''), /R2/i);
});

test('create returns warning when the receipt payload cannot be parsed', async () => {
  const { service, appendCalls, auditCalls } = loadPagosService({
    getAll: async () => [],
    uploadReceipt: async () => null,
  });

  const result = await service.create({
    usuario: 'Carlos Ruiz',
    caja: 'Caja 3',
    banco_id: 'BK-1',
    monto: 50,
    tipo: 'Transferencia',
    comprobante_base64: 'not-a-valid-image',
    fecha_comprobante: '2026-04-17T11:00:00',
  }, 'agente-3');

  assert.equal(result.record.comprobante_url, '');
  assert.equal(result.record.comprobante_file_id, '');
  assert.equal(result.warnings.length, 1);
  assert.match(String(result.warnings[0]), /no se pudo interpretar/i);
  assert.equal(appendCalls[0].data.comprobante_url, '');
  assert.equal(appendCalls[0].data.comprobante_file_id, '');
  assert.equal(auditCalls[0][0], 'create');
  assert.match(String(auditCalls[0][3].receipt_warning || ''), /interpretar/i);
});

test('create with missing banco_id keeps the record and emits a referential warning', async () => {
  const { service, appendCalls, auditCalls } = loadPagosService({
    getAll: async () => [],
    uploadReceipt: async () => null,
    getConfigBancoById: async () => null,
    validateReferences: async (checks) => checks.some((check) => check.value === 'BK-999')
      ? ['El banco "BK-999" no existe en config_bancos. Se registro igualmente para no bloquear la operacion.']
      : [],
  });

  const result = await service.create({
    usuario: 'Laura Diaz',
    caja: 'Caja 1',
    banco_id: 'BK-999',
    monto: 60,
    tipo: 'Yape',
    comprobante_base64: '',
    fecha_comprobante: '2026-04-17T12:00:00',
  }, 'agente-4');

  assert.equal(result.record.banco_id, 'BK-999');
  assert.equal(result.record.banco, '');
  assert.equal(result.warnings.length, 1);
  assert.equal(appendCalls[0].data.banco_id, 'BK-999');
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][3].banco_id, 'BK-999');
  assert.equal(auditCalls[0][3].banco, '');
});
