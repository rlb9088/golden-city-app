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

test('getFiltered combina rango de fechas, agente, banco y usuario', async () => {
  const pagosService = loadPagosService({
    getAll: async () => ([
      {
        id: 'PAG-1',
        usuario: 'Juan Perez',
        banco: 'BCP',
        agente: 'Agente 1',
        fecha_registro: '2026-04-10T09:15:00',
      },
      {
        id: 'PAG-2',
        usuario: 'Maria Lopez',
        banco: 'Interbank',
        agente: 'Agente 2',
        fecha_registro: '2026-04-12T10:20:00',
      },
      {
        id: 'PAG-3',
        usuario: 'juan pablo',
        banco: 'BCP',
        agente: 'Agente 1',
        fecha_registro: '2026-04-14T13:45:00',
      },
    ]),
  });

  const result = await pagosService.getFiltered({
    desde: '2026-04-09',
    hasta: '2026-04-13',
    agente: 'agente 1',
    banco: 'bcp',
    usuario: 'juan',
  });

  assert.deepStrictEqual(result.map((item) => item.id), ['PAG-1']);
});

test('getFiltered usa fecha_comprobante como respaldo si falta fecha_registro', async () => {
  const pagosService = loadPagosService({
    getAll: async () => ([
      {
        id: 'PAG-4',
        usuario: 'Cliente Demo',
        banco: 'BCP',
        agente: 'Agente 3',
        fecha_comprobante: '2026-04-15T11:00:00',
      },
    ]),
  });

  const result = await pagosService.getFiltered({
    desde: '2026-04-15',
    hasta: '2026-04-15',
  });

  assert.deepStrictEqual(result.map((item) => item.id), ['PAG-4']);
});
