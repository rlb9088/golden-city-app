const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAgentIndex,
  resolveAgentFromRow,
  resolveBancoMatches,
  runMigration,
} = require('../scripts/migrateBancoId');

function createDependencies({ rowsBySheet = {} } = {}) {
  const updateCalls = [];
  const auditCalls = [];
  const reports = [];
  const logs = [];
  const warns = [];

  return {
    rowsBySheet,
    deps: {
      getRows: async (sheetName) => rowsBySheet[sheetName] || [],
      updateRow: async (sheetName, rowIndex, data) => {
        updateCalls.push({ sheetName, rowIndex, data });
        return { status: 'success' };
      },
      auditLog: async (...args) => {
        auditCalls.push(args);
        return { id: 'AUD-1' };
      },
      writeReport: (reportPath, report) => {
        reports.push({ reportPath, report });
      },
      log: (message) => logs.push(message),
      now: () => '2026-04-18T10:00:00.000Z',
    },
    updateCalls,
    auditCalls,
    reports,
    logs,
    warns,
  };
}

test('resolveBancoMatches finds a unique match using bank name and agent owner', () => {
  const agentIndex = buildAgentIndex([
    { id: 'AG-1', nombre: 'Paolo', username: 'paolo' },
  ]);

  const result = resolveBancoMatches(
    { banco: 'BBVA', agente: 'Paolo' },
    [
      { id: 'BK-1', nombre: 'BBVA', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'BBVA', propietario_id: 'AG-2' },
    ],
    agentIndex,
  );

  assert.equal(result.status, 'resolved');
  assert.equal(result.matches[0].id, 'BK-1');
});

test('resolveBancoMatches returns ambiguous when same bank name exists for multiple owners', () => {
  const agentIndex = buildAgentIndex([]);

  const result = resolveBancoMatches(
    { banco: 'BBVA' },
    [
      { id: 'BK-1', nombre: 'BBVA', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'BBVA', propietario_id: 'AG-2' },
    ],
    agentIndex,
  );

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.matches.length, 2);
});

test('resolveAgentFromRow detects ambiguous agent references', () => {
  const agentIndex = buildAgentIndex([
    { id: 'AG-1', nombre: 'Paolo', username: 'paolo' },
    { id: 'AG-2', nombre: 'Paolo', username: 'paolo-2' },
  ]);

  const result = resolveAgentFromRow({ agente: 'Paolo' }, agentIndex);

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.candidates.length, 2);
});

test('commit migrates resolvable rows, leaves unresolved rows in report and is idempotent on migrated rows', async () => {
  const context = createDependencies({
    rowsBySheet: {
      config_agentes: [
        { id: 'AG-1', nombre: 'Paolo', username: 'paolo' },
      ],
      config_bancos: [
        { id: 'BK-1', nombre: 'BBVA', propietario_id: 'AG-1' },
        { id: 'BK-2', nombre: 'BBVA', propietario_id: 'AG-2' },
        { id: 'BK-3', nombre: 'BCP', propietario_id: 'AG-1' },
      ],
      pagos: [
        { _rowIndex: 2, id: 'P-1', banco: 'BBVA', banco_id: '', agente: 'Paolo' },
        { _rowIndex: 3, id: 'P-2', banco: 'BBVA', banco_id: '', agente: 'Desconocido' },
        { _rowIndex: 4, id: 'P-3', banco: 'BCP', banco_id: 'BK-3', agente: 'Paolo' },
      ],
      ingresos: [
        { _rowIndex: 2, id: 'I-1', banco: 'BCP', banco_id: '', agente: 'AG-1' },
      ],
      gastos: [
        { _rowIndex: 2, id: 'G-1', banco: 'No existe', banco_id: '', agente: '' },
      ],
      bancos: [
        { _rowIndex: 2, id: 'B-1', banco: 'BBVA', banco_id: '', saldo: 10 },
      ],
    },
  });
  const { deps, updateCalls, auditCalls, reports } = context;

  const report = await runMigration({ mode: 'commit' }, deps);

  assert.equal(updateCalls.length, 2);
  assert.deepStrictEqual(updateCalls.map((call) => [call.sheetName, call.rowIndex]), [
    ['pagos', 2],
    ['ingresos', 2],
  ]);
  assert.equal(updateCalls[0].data.banco_id, 'BK-1');
  assert.equal(updateCalls[1].data.banco_id, 'BK-3');

  assert.equal(auditCalls.length, 1);
  assert.deepStrictEqual(auditCalls[0], [
    'migration',
    'migration_banco_id',
    'system',
    {
      mode: 'commit',
      resolved: 2,
      empty: 3,
      ambiguous: 1,
      skipped: 1,
    },
  ]);

  assert.equal(reports.length, 1);
  assert.equal(reports[0].reportPath.endsWith('migrateBancoId.report.json'), true);
  assert.equal(report.summary.pagos.resolved, 1);
  assert.equal(report.summary.ingresos.resolved, 1);
  assert.equal(report.summary.bancos.ambiguous, 1);
  assert.equal(report.summary.gastos.empty, 1);
  assert.equal(report.unresolved.pagos.length, 1);
  assert.equal(report.unresolved.bancos.length, 1);
  assert.equal(report.unresolved.gastos.length, 1);

  const rerunContext = createDependencies({
    rowsBySheet: {
      ...context.rowsBySheet,
      pagos: [
        { _rowIndex: 2, id: 'P-1', banco: 'BBVA', banco_id: 'BK-1', agente: 'Paolo' },
      ],
      ingresos: [
        { _rowIndex: 2, id: 'I-1', banco: 'BCP', banco_id: 'BK-3', agente: 'AG-1' },
      ],
      bancos: [
        { _rowIndex: 2, id: 'B-1', banco: 'BBVA', banco_id: 'BK-1', saldo: 10 },
      ],
      gastos: [
        { _rowIndex: 2, id: 'G-1', banco: 'No existe', banco_id: '', agente: '' },
      ],
    },
  });

  const rerun = await runMigration({ mode: 'commit' }, rerunContext.deps);

  assert.equal(rerun.summary.pagos.skipped, 1);
  assert.equal(rerun.summary.ingresos.skipped, 1);
  assert.equal(rerun.summary.bancos.skipped, 1);
});
