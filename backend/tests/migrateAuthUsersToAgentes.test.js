const test = require('node:test');
const assert = require('node:assert/strict');
const { runMigration, REQUIRED_AGENT_HEADERS } = require('../scripts/migrateAuthUsersToAgentes');

function createDependencies({ rowsBySheet = {}, agentHeaders = REQUIRED_AGENT_HEADERS } = {}) {
  const updateCalls = [];
  const appendCalls = [];
  const auditCalls = [];
  const archiveCalls = [];
  const reports = [];
  const logs = [];

  return {
    deps: {
      getRows: async (sheetName) => rowsBySheet[sheetName] || [],
      updateRow: async (sheetName, rowIndex, data, headers) => {
        updateCalls.push({ sheetName, rowIndex, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      appendRow: async (sheetName, data, headers) => {
        appendCalls.push({ sheetName, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      auditLog: async (...args) => {
        auditCalls.push(args);
        return { id: 'AUD-1' };
      },
      archiveAuthSheet: async (payload) => {
        archiveCalls.push(payload);
        return { status: 'archived' };
      },
      writeReport: (reportPath, report) => {
        reports.push({ reportPath, report });
      },
      getSheetHeaders: async () => agentHeaders,
      reportPath: 'memory://migrateAuthUsersToAgentes.report.json',
      log: (message) => logs.push(message),
    },
    updateCalls,
    appendCalls,
    auditCalls,
    archiveCalls,
    reports,
    logs,
  };
}

test('dry-run reporta casos A/B/C sin escribir cambios', async () => {
  const { deps, updateCalls, appendCalls, reports } = createDependencies({
    rowsBySheet: {
      config_auth_users: [
        { id: 'AUTH-1', username: 'admin', password_hash: 'hash-1', role: 'admin', nombre: 'Paolo' },
        { id: 'AUTH-2', username: 'juan', password_hash: 'hash-2', role: 'agent', nombre: 'Juan' },
        { id: 'AUTH-3', username: 'maria', password_hash: 'hash-3', role: 'agent', nombre: 'Maria' },
      ],
      config_agentes: [
        { _rowIndex: 2, id: 'AG-10', nombre: 'Paolo', username: '', password_hash: '', role: '', activo: '' },
        { _rowIndex: 3, id: 'AG-11', nombre: 'Maria', username: '', password_hash: '', role: '', activo: '' },
        { _rowIndex: 4, id: 'AG-12', nombre: 'Maria', username: '', password_hash: '', role: '', activo: '' },
      ],
    },
  });

  const report = await runMigration({ mode: 'dry-run' }, deps);

  assert.equal(report.updated.length, 1);
  assert.equal(report.created.length, 1);
  assert.equal(report.ambiguous.length, 1);
  assert.equal(report.skipped.length, 0);
  assert.deepStrictEqual(updateCalls, []);
  assert.deepStrictEqual(appendCalls, []);
  assert.equal(reports.length, 1);
});

test('commit actualiza match unico, crea faltantes, archiva hoja y audita', async () => {
  const { deps, updateCalls, appendCalls, auditCalls, archiveCalls, reports } = createDependencies({
    rowsBySheet: {
      config_auth_users: [
        { id: 'AUTH-1', username: 'admin', password_hash: 'hash-admin', role: 'admin', nombre: 'Paolo' },
        { id: 'AUTH-2', username: 'agent1', password_hash: 'hash-agent', role: 'agent', nombre: 'Lucia' },
      ],
      config_agentes: [
        { _rowIndex: 2, id: 'AG-10', nombre: 'Paolo', username: '', password_hash: '', role: '', activo: '' },
      ],
    },
  });

  const report = await runMigration({ mode: 'commit' }, deps);

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].sheetName, 'config_agentes');
  assert.equal(updateCalls[0].rowIndex, 2);
  assert.deepStrictEqual(updateCalls[0].headers, REQUIRED_AGENT_HEADERS);
  assert.equal(updateCalls[0].data.id, 'AG-10');
  assert.equal(updateCalls[0].data.username, 'admin');
  assert.equal(updateCalls[0].data.password_hash, 'hash-admin');
  assert.equal(updateCalls[0].data.role, 'admin');
  assert.equal(updateCalls[0].data.activo, 'true');

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0].sheetName, 'config_agentes');
  assert.deepStrictEqual(appendCalls[0].headers, REQUIRED_AGENT_HEADERS);
  assert.match(appendCalls[0].data.id, /^AG-/);
  assert.equal(appendCalls[0].data.nombre, 'Lucia');
  assert.equal(appendCalls[0].data.username, 'agent1');

  assert.deepStrictEqual(archiveCalls, [
    {
      sourceSheet: 'config_auth_users',
      targetSheet: 'config_auth_users_deprecated',
    },
  ]);
  assert.equal(report.archiveStatus, 'archived');

  assert.deepStrictEqual(auditCalls, [
    ['migration_auth', 'config_agentes', 'system', {
      sourceSheet: 'config_auth_users',
      updated: 1,
      created: 1,
      ambiguous: 0,
      skipped: 0,
      archiveStatus: 'archived',
    }],
  ]);
  assert.equal(reports.length, 1);
});

test('re-ejecucion usando hoja deprecated es idempotente y no duplica agentes', async () => {
  const { deps, updateCalls, appendCalls, archiveCalls, auditCalls } = createDependencies({
    rowsBySheet: {
      config_auth_users: [],
      config_auth_users_deprecated: [
        { id: 'AUTH-1', username: 'admin', password_hash: 'hash-admin', role: 'admin', nombre: 'Paolo' },
      ],
      config_agentes: [
        {
          _rowIndex: 2,
          id: 'AG-10',
          nombre: 'Paolo',
          username: 'admin',
          password_hash: 'hash-admin',
          role: 'admin',
          activo: 'true',
        },
      ],
    },
  });

  const report = await runMigration({ mode: 'commit' }, deps);

  assert.deepStrictEqual(updateCalls, []);
  assert.deepStrictEqual(appendCalls, []);
  assert.deepStrictEqual(archiveCalls, []);
  assert.equal(report.archiveStatus, 'already_archived');
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0].reason, 'already_migrated');
  assert.deepStrictEqual(auditCalls, [
    ['migration_auth', 'config_agentes', 'system', {
      sourceSheet: 'config_auth_users_deprecated',
      updated: 0,
      created: 0,
      ambiguous: 0,
      skipped: 1,
      archiveStatus: 'already_archived',
    }],
  ]);
});

test('usuarios sin password_hash quedan en skipped y no se migran', async () => {
  const { deps, updateCalls, appendCalls } = createDependencies({
    rowsBySheet: {
      config_auth_users: [
        { id: 'AUTH-7', username: 'sinhash', password_hash: '', role: 'agent', nombre: 'Sin Hash' },
      ],
      config_agentes: [],
    },
  });

  const report = await runMigration({ mode: 'commit' }, deps);

  assert.deepStrictEqual(updateCalls, []);
  assert.deepStrictEqual(appendCalls, []);
  assert.deepStrictEqual(report.skipped, [
    {
      auth_username: 'sinhash',
      auth_id: 'AUTH-7',
      reason: 'missing_password_hash',
    },
  ]);
});

test('falla si config_agentes no tiene columnas extendidas de identidad', async () => {
  const { deps } = createDependencies({
    rowsBySheet: {
      config_auth_users: [
        { id: 'AUTH-1', username: 'admin', password_hash: 'hash', role: 'admin', nombre: 'Paolo' },
      ],
      config_agentes: [],
    },
    agentHeaders: ['id', 'nombre'],
  });

  await assert.rejects(
    () => runMigration({ mode: 'dry-run' }, deps),
    /config_agentes no tiene el schema esperado/i,
  );
});
