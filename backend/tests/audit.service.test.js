const test = require('node:test');
const assert = require('node:assert/strict');

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

test('getAll normaliza changes y ordena por timestamp descendente', async () => {
  const auditService = loadAuditService({
    getAll: async () => ([
      {
        id: 'AUD-1',
        action: 'create',
        entity: 'pago',
        user: 'Admin',
        timestamp: '2026-04-15T10:00:00',
        changes: '{"monto":250,"estado":"activo"}',
      },
      {
        id: 'AUD-2',
        action: 'delete',
        entity: 'gasto',
        user: 'Admin',
        timestamp: '2026-04-16T08:15:00',
        changes: { motivo: 'Duplicado' },
      },
    ]),
  });

  const result = await auditService.getAll();

  assert.deepStrictEqual(result.map((entry) => entry.id), ['AUD-2', 'AUD-1']);
  assert.deepStrictEqual(result[0].changes, { motivo: 'Duplicado' });
  assert.deepStrictEqual(result[1].changes, { monto: 250, estado: 'activo' });
});

test('getFiltered aplica filtros por entidad, accion, usuario y rango de fecha', async () => {
  const auditService = loadAuditService({
    getAll: async () => ([
      {
        id: 'AUD-1',
        action: 'create',
        entity: 'pago',
        user: 'Admin Principal',
        timestamp: '2026-04-14T18:05:00',
        changes: '{"foo":"bar"}',
      },
      {
        id: 'AUD-2',
        action: 'delete',
        entity: 'gasto',
        user: 'Admin Principal',
        timestamp: '2026-04-15T09:30:00',
        changes: '{"motivo":"Ajuste"}',
      },
      {
        id: 'AUD-3',
        action: 'create',
        entity: 'gasto',
        user: 'Otro usuario',
        timestamp: '2026-04-16T12:00:00',
        changes: '{"foo":"baz"}',
      },
    ]),
  });

  const result = await auditService.getFiltered({
    entity: 'gasto',
    action: 'delete',
    user: 'admin',
    desde: '2026-04-15',
    hasta: '2026-04-15',
  });

  assert.deepStrictEqual(result.map((entry) => entry.id), ['AUD-2']);
});
