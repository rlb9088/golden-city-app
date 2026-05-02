const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_CALLER = {
  userId: 'AG-1',
  role: 'agent',
  nombre: 'Agente 1',
  user: 'Agente 1',
};

const BASE_BANCO = { id: 'BK-1', nombre: 'BCP', propietario_id: 'AG-1' };

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

function loadPagosService({ existingPagos = [] } = {}) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const authPath = require.resolve('../services/auth.service');
  const configPath = require.resolve('../services/config.service');
  const r2Path = require.resolve('../services/r2.service');
  const timezonePath = require.resolve('../config/timezone');
  const idPath = require.resolve('../utils/id');
  const servicePath = require.resolve('../services/pagos.service');

  for (const p of [servicePath, repoPath, auditPath, authPath, configPath]) {
    delete require.cache[p];
  }

  const appendCalls = [];

  require.cache[repoPath] = {
    id: repoPath, filename: repoPath, loaded: true,
    exports: {
      getAll: async () => existingPagos,
      append: async (sheetName, data) => { appendCalls.push(data); },
      findById: async (sheetName, id) => existingPagos.find((r) => r.id === id) || null,
    },
  };

  require.cache[auditPath] = {
    id: auditPath, filename: auditPath, loaded: true,
    exports: { log: async () => {} },
  };

  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      getAuthUserById: async (userId) => (userId === 'AG-1'
        ? { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', role: 'agent', activo: true }
        : null),
      getAuthUsers: async () => [],
    },
  };

  require.cache[configPath] = {
    id: configPath, filename: configPath, loaded: true,
    exports: {
      validateReferences: async () => [],
      getConfigBancoById: async () => BASE_BANCO,
    },
  };

  // r2 and timezone/id may already be cached; clear service so it re-requires them fresh
  delete require.cache[servicePath];

  return { service: require('../services/pagos.service'), appendCalls };
}

const BASE_PAYLOAD = {
  usuario: 'Juan Perez',
  caja: 'Caja 1',
  banco_id: 'BK-1',
  monto: 100,
  tipo: 'Transferencia',
  fecha_comprobante: '2026-05-02',
};

function makeExistingPago(overrides = {}) {
  return {
    _rowIndex: 1,
    id: 'PAG-OLD',
    estado: 'activo',
    usuario: 'Juan Perez',
    caja: 'Caja 1',
    banco_id: 'BK-1',
    banco: 'BCP',
    monto: 100,
    tipo: 'Transferencia',
    comprobante_url: '',
    comprobante_file_id: '',
    fecha_comprobante: '2026-05-02',
    fecha_registro: minutesAgo(2),
    agente: 'Agente 1',
    ...overrides,
  };
}

test('duplicate within window → throws DuplicatePagoError (409)', async () => {
  const { service } = loadPagosService({ existingPagos: [makeExistingPago()] });

  await assert.rejects(
    () => service.create(BASE_PAYLOAD, BASE_CALLER),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'DUPLICATE_PAGO');
      assert.equal(err.existing.id, 'PAG-OLD');
      return true;
    },
  );
});

test('duplicate outside window (11 min ago) → inserts normally', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago({ fecha_registro: minutesAgo(11) })],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER);
  assert.equal(appendCalls.length, 1);
});

test('different monto → not a duplicate', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago({ monto: 200 })],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER);
  assert.equal(appendCalls.length, 1);
});

test('different banco_id → not a duplicate', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago({ banco_id: 'BK-9' })],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER);
  assert.equal(appendCalls.length, 1);
});

test('different fecha_comprobante → not a duplicate', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago({ fecha_comprobante: '2026-01-01' })],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER);
  assert.equal(appendCalls.length, 1);
});

test('X-Confirm-Duplicate: true (skipDuplicateCheck) → both records inserted', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago()],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER, { skipDuplicateCheck: true });
  assert.equal(appendCalls.length, 1);
});

test('anulled/cancelled pago with same data does not count as duplicate', async () => {
  const { service, appendCalls } = loadPagosService({
    existingPagos: [makeExistingPago({ estado: 'anulado' })],
  });

  await service.create(BASE_PAYLOAD, BASE_CALLER);
  assert.equal(appendCalls.length, 1);
});
