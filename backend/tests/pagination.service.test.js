const test = require('node:test');
const assert = require('node:assert/strict');

function loadPagosService({ getAll }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve('../services/pagos.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[configPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async () => ({}),
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
      log: async () => ({ id: 'AUD-1' }),
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      validateReferences: async () => [],
    },
  };

  return require('../services/pagos.service');
}

function loadAuditService({ getAll }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const servicePath = require.resolve('../services/audit.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async () => ({}),
      update: async () => ({}),
      deleteRow: async () => ({}),
      findByColumn: async () => [],
    },
  };

  return require('../services/audit.service');
}

function loadListService(serviceRelativePath, { getAll }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve(serviceRelativePath);

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[configPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async () => ({}),
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
      log: async () => ({ id: 'AUD-1' }),
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      validateReferences: async () => [],
    },
  };

  return require(serviceRelativePath);
}

test('getPagedAndFiltered pagina pagos con defaults y orden mas reciente primero', async () => {
  const pagosService = loadPagosService({
    getAll: async () => Array.from({ length: 55 }, (_, index) => ({
      id: `PAG-${index + 1}`,
      usuario: `Usuario ${index + 1}`,
      banco: 'BCP',
      agente: 'Agente 1',
      fecha_registro: `2026-04-${String((index % 28) + 1).padStart(2, '0')}T10:00:00`,
      _rowIndex: index + 2,
    })),
  });

  const page = await pagosService.getPagedAndFiltered();

  assert.equal(page.items.length, 50);
  assert.equal(page.pagination.limit, 50);
  assert.equal(page.pagination.offset, 0);
  assert.equal(page.pagination.total, 55);
  assert.equal(page.pagination.hasMore, true);
  assert.deepStrictEqual(page.items.slice(0, 3).map((item) => item.id), ['PAG-55', 'PAG-54', 'PAG-53']);
});

test('getPagedAndFiltered aplica filtros y offset en pagos', async () => {
  const pagosService = loadPagosService({
    getAll: async () => ([
      { id: 'PAG-1', usuario: 'Ana', banco: 'BCP', agente: 'Norte', fecha_registro: '2026-04-01T10:00:00' },
      { id: 'PAG-2', usuario: 'Ana', banco: 'BCP', agente: 'Norte', fecha_registro: '2026-04-02T10:00:00' },
      { id: 'PAG-3', usuario: 'Ana', banco: 'BCP', agente: 'Norte', fecha_registro: '2026-04-03T10:00:00' },
      { id: 'PAG-4', usuario: 'Luis', banco: 'Interbank', agente: 'Sur', fecha_registro: '2026-04-04T10:00:00' },
    ]),
  });

  const page = await pagosService.getPagedAndFiltered({ usuario: 'ana', banco: 'bcp' }, 1, 1);

  assert.deepStrictEqual(page.items.map((item) => item.id), ['PAG-2']);
  assert.equal(page.pagination.total, 3);
  assert.equal(page.pagination.hasMore, true);
});

test('getPagedAndFiltered limita valores extremos y responde vacio si offset excede total', async () => {
  const pagosService = loadPagosService({
    getAll: async () => ([
      { id: 'PAG-1', usuario: 'Ana', banco: 'BCP', agente: 'Norte', fecha_registro: '2026-04-01T10:00:00' },
      { id: 'PAG-2', usuario: 'Luis', banco: 'BCP', agente: 'Sur', fecha_registro: '2026-04-02T10:00:00' },
    ]),
  });

  const page = await pagosService.getPagedAndFiltered({}, 9999, 100);

  assert.deepStrictEqual(page.items, []);
  assert.equal(page.pagination.limit, 500);
  assert.equal(page.pagination.offset, 100);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasMore, false);
});

test('audit getPagedAndFiltered pagina resultados ya ordenados por timestamp descendente', async () => {
  const auditService = loadAuditService({
    getAll: async () => ([
      {
        id: 'AUD-1',
        action: 'create',
        entity: 'pago',
        user: 'Admin',
        timestamp: '2026-04-14T09:00:00',
        changes: '{"foo":"bar"}',
      },
      {
        id: 'AUD-2',
        action: 'update',
        entity: 'pago',
        user: 'Admin',
        timestamp: '2026-04-15T09:00:00',
        changes: '{"foo":"baz"}',
      },
      {
        id: 'AUD-3',
        action: 'delete',
        entity: 'gasto',
        user: 'Root',
        timestamp: '2026-04-16T09:00:00',
        changes: '{"motivo":"dup"}',
      },
    ]),
  });

  const page = await auditService.getPagedAndFiltered({ user: 'admin' }, 1, 1);

  assert.deepStrictEqual(page.items.map((item) => item.id), ['AUD-1']);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasMore, false);
});

test('ingresos getPagedAndFiltered aplica filtros de agente, banco, usuario y rango de fechas', async () => {
  const ingresosService = loadListService('../services/ingresos.service', {
    getAll: async () => ([
      {
        id: 'ING-1',
        agente: 'Norte',
        banco: 'BCP',
        usuario: 'Ana',
        fecha_movimiento: '2026-04-01T10:00:00',
      },
      {
        id: 'ING-2',
        agente: 'Norte',
        banco: 'BCP',
        usuario: 'Ana',
        fecha_movimiento: '2026-04-02T10:00:00',
      },
      {
        id: 'ING-3',
        agente: 'Norte',
        banco: 'Interbank',
        usuario: 'Ana',
        fecha_movimiento: '2026-04-03T10:00:00',
      },
      {
        id: 'ING-4',
        agente: 'Sur',
        banco: 'BCP',
        usuario: 'Luis',
        fecha_movimiento: '2026-04-04T10:00:00',
      },
    ]),
  });

  const page = await ingresosService.getPagedAndFiltered({
    agente: 'norte',
    banco: 'bcp',
    usuario: 'ana',
    desde: '2026-04-01',
    hasta: '2026-04-02',
  }, 10, 0);

  assert.deepStrictEqual(page.items.map((item) => item.id), ['ING-2', 'ING-1']);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasMore, false);
});

test('gastos getPagedAndFiltered filtra por categoria y fechas', async () => {
  const gastosService = loadListService('../services/gastos.service', {
    getAll: async () => ([
      {
        id: 'GAS-1',
        categoria: 'Operativos',
        fecha_gasto: '2026-04-01',
      },
      {
        id: 'GAS-2',
        categoria: 'Logistica',
        fecha_gasto: '2026-04-02',
      },
      {
        id: 'GAS-3',
        categoria: 'Logistica',
        fecha_gasto: '2026-04-03',
      },
      {
        id: 'GAS-4',
        categoria: 'Marketing',
        fecha_gasto: '2026-04-04',
      },
    ]),
  });

  const page = await gastosService.getPagedAndFiltered({
    categoria: 'logistica',
    desde: '2026-04-02',
    hasta: '2026-04-03',
  }, 10, 0);

  assert.deepStrictEqual(page.items.map((item) => item.id), ['GAS-3', 'GAS-2']);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasMore, false);
});

test('bancos getPagedAndFiltered pagina y filtra por agente', async () => {
  const bancosService = loadListService('../services/bancos.service', {
    getAll: async () => ([
      {
        id: 'BAN-1',
        banco: 'BCP',
        agente: 'Norte',
        fecha: '2026-04-01',
      },
      {
        id: 'BAN-2',
        banco: 'Interbank',
        agente: 'Sur',
        fecha: '2026-04-02',
      },
      {
        id: 'BAN-3',
        banco: 'BBVA',
        agente: 'Norte',
        fecha: '2026-04-03',
      },
    ]),
  });

  const page = await bancosService.getPagedAndFiltered({ agente: 'norte' }, 1, 1);

  assert.deepStrictEqual(page.items.map((item) => item.id), ['BAN-1']);
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.hasMore, false);
});
