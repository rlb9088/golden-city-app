const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const repo = require('../repositories/sheetsRepository');
const audit = require('../services/audit.service');
const { SHEETS_SCHEMA_MAP } = require('../config/sheetsSchema');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_SHEETS = ['pagos', 'ingresos', 'gastos', 'bancos'];
const CONFIG_BANCOS_SHEET = 'config_bancos';
const CONFIG_AGENTES_SHEET = 'config_agentes';
const REPORT_PATH = path.resolve(__dirname, 'migrateBancoId.report.json');
const SHEET_HEADERS = {
  pagos: SHEETS_SCHEMA_MAP.pagos,
  ingresos: SHEETS_SCHEMA_MAP.ingresos,
  gastos: SHEETS_SCHEMA_MAP.gastos,
  bancos: SHEETS_SCHEMA_MAP.bancos,
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLookup(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNameKey(value) {
  return normalizeLookup(value).replace(/\s+/g, ' ');
}

function hasOwnValue(row, field) {
  return Object.prototype.hasOwnProperty.call(row || {}, field)
    && normalizeText(row?.[field]) !== '';
}

function buildAgentIndex(agentRows = []) {
  const byId = new Map();
  const byName = new Map();
  const byUsername = new Map();

  for (const row of agentRows) {
    const normalizedRow = {
      ...row,
      id: normalizeText(row.id),
      nombre: normalizeText(row.nombre),
      username: normalizeText(row.username),
    };

    if (normalizedRow.id) {
      byId.set(normalizedRow.id.toLowerCase(), normalizedRow);
    }

    const nameKey = normalizeNameKey(normalizedRow.nombre);
    if (nameKey) {
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey).push(normalizedRow);
    }

    const usernameKey = normalizeLookup(normalizedRow.username);
    if (usernameKey) {
      byUsername.set(usernameKey, normalizedRow);
    }
  }

  return { byId, byName, byUsername };
}

function resolveAgentFromRow(row, agentIndex) {
  const agentIdValue = normalizeText(row?.agente_id);
  if (agentIdValue) {
    const directMatch = agentIndex.byId.get(agentIdValue.toLowerCase());
    if (directMatch) {
      return {
        status: 'resolved',
        agentId: directMatch.id,
        source: 'agente_id',
        match: directMatch,
      };
    }
  }

  const agentValue = normalizeText(row?.agente);
  if (!agentValue) {
    return {
      status: 'missing',
      agentId: '',
      source: '',
      match: null,
    };
  }

  const byIdMatch = agentIndex.byId.get(agentValue.toLowerCase());
  if (byIdMatch) {
    return {
      status: 'resolved',
      agentId: byIdMatch.id,
      source: 'agente',
      match: byIdMatch,
    };
  }

  const nameMatches = agentIndex.byName.get(normalizeNameKey(agentValue)) || [];
  if (nameMatches.length === 1) {
    return {
      status: 'resolved',
      agentId: nameMatches[0].id,
      source: 'agente',
      match: nameMatches[0],
    };
  }

  if (nameMatches.length > 1) {
    return {
      status: 'ambiguous',
      agentId: '',
      source: 'agente',
      candidates: nameMatches.map((candidate) => ({
        id: candidate.id,
        nombre: candidate.nombre,
        username: candidate.username,
      })),
    };
  }

  const usernameMatch = agentIndex.byUsername.get(normalizeLookup(agentValue));
  if (usernameMatch) {
    return {
      status: 'resolved',
      agentId: usernameMatch.id,
      source: 'agente',
      match: usernameMatch,
    };
  }

  return {
    status: 'missing',
    agentId: '',
    source: 'agente',
    match: null,
  };
}

function resolveBancoMatches(row, bancoRows, agentIndex) {
  const bancoName = normalizeNameKey(row?.banco);
  if (!bancoName) {
    return {
      status: 'missing_bank',
      matches: [],
      agent: resolveAgentFromRow(row, agentIndex),
    };
  }

  const agent = resolveAgentFromRow(row, agentIndex);
  const matchesByName = bancoRows.filter((banco) => normalizeNameKey(banco.nombre) === bancoName);
  const hasAgentReference = hasOwnValue(row, 'agente_id') || hasOwnValue(row, 'agente');

  if (hasAgentReference) {
    if (agent.status !== 'resolved') {
      return {
        status: agent.status === 'ambiguous' ? 'ambiguous_agent' : 'agent_not_found',
        matches: [],
        agent,
      };
    }

    const matchesByOwner = matchesByName.filter(
      (banco) => normalizeLookup(banco.propietario_id) === normalizeLookup(agent.agentId),
    );

    if (matchesByOwner.length === 1) {
      return {
        status: 'resolved',
        matches: matchesByOwner,
        agent,
      };
    }

    if (matchesByOwner.length > 1) {
      return {
        status: 'ambiguous',
        matches: matchesByOwner,
        agent,
      };
    }

    return {
      status: 'not_found',
      matches: [],
      agent,
    };
  }

  if (matchesByName.length === 1) {
    return {
      status: 'resolved',
      matches: matchesByName,
      agent,
    };
  }

  if (matchesByName.length > 1) {
    return {
      status: 'ambiguous',
      matches: matchesByName,
      agent,
    };
  }

  return {
    status: 'not_found',
    matches: [],
    agent,
  };
}

function createEmptySheetSummary() {
  return {
    resolved: 0,
    empty: 0,
    ambiguous: 0,
    skipped: 0,
  };
}

function createEmptyReport() {
  return {
    mode: 'dry-run',
    runAt: '',
    summary: {
      pagos: createEmptySheetSummary(),
      ingresos: createEmptySheetSummary(),
      gastos: createEmptySheetSummary(),
      bancos: createEmptySheetSummary(),
    },
    unresolved: {
      pagos: [],
      ingresos: [],
      gastos: [],
      bancos: [],
    },
  };
}

function buildRowContext(sheetName, row) {
  return {
    sheet: sheetName,
    id: normalizeText(row.id),
    banco: normalizeText(row.banco),
    agente: normalizeText(row.agente),
    agente_id: normalizeText(row.agente_id),
    rowIndex: row._rowIndex ?? null,
  };
}

function toReportUnresolvedItem(sheetName, row, result, reason) {
  const item = buildRowContext(sheetName, row);
  item.reason = reason;
  item.candidates = result.matches.map((candidate) => ({
    id: candidate.id,
    nombre: candidate.nombre,
    propietario_id: candidate.propietario_id,
  }));

  if (result.agent?.status) {
    item.agent_status = result.agent.status;
  }

  if (result.agent?.candidates) {
    item.agent_candidates = result.agent.candidates;
  }

  return item;
}

function writeReport(reportPath, report) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function safeGetRows(getRows, sheetName) {
  try {
    return await getRows(sheetName);
  } catch (error) {
    if (error?.statusCode === 404 || error?.status === 404) {
      return [];
    }
    throw error;
  }
}

async function runMigration(options = {}, dependencies = {}) {
  const mode = options.mode === 'commit' ? 'commit' : 'dry-run';
  const isCommit = mode === 'commit';
  const reportPath = dependencies.reportPath || REPORT_PATH;
  const getRows = dependencies.getRows || repo.getAll;
  const updateRow = dependencies.updateRow || repo.update;
  const writeReportFn = dependencies.writeReport || writeReport;
  const auditLog = dependencies.auditLog || audit.log;
  const log = dependencies.log || (() => {});
  const now = dependencies.now || (() => new Date().toISOString());

  const [bancoRows, agentRows] = await Promise.all([
    safeGetRows(getRows, CONFIG_BANCOS_SHEET),
    safeGetRows(getRows, CONFIG_AGENTES_SHEET),
  ]);

  const agentIndex = buildAgentIndex(agentRows);
  const report = createEmptyReport();
  report.mode = mode;
  report.runAt = now();

  const sheetRows = await Promise.all(TARGET_SHEETS.map(async (sheetName) => ({
    sheetName,
    rows: await safeGetRows(getRows, sheetName),
  })));

  const updateOps = [];
  const stdoutAmbiguities = [];

  for (const { sheetName, rows } of sheetRows) {
    const sheetSummary = report.summary[sheetName];

    for (const row of rows) {
      if (normalizeText(row.banco_id)) {
        sheetSummary.skipped += 1;
        continue;
      }

      const result = resolveBancoMatches(row, bancoRows, agentIndex);

      if (result.status === 'resolved') {
        sheetSummary.resolved += 1;
        if (isCommit) {
          updateOps.push({
            sheetName,
            rowIndex: row._rowIndex,
            data: {
              ...row,
              banco_id: result.matches[0].id,
            },
          });
        }
        continue;
      }

      sheetSummary.empty += 1;
      if (result.status === 'ambiguous' || result.status === 'ambiguous_agent') {
        sheetSummary.ambiguous += 1;
      }

      const reason = result.status === 'ambiguous'
        ? 'ambiguous_bank'
        : result.status === 'ambiguous_agent'
          ? 'ambiguous_agent'
          : result.status === 'agent_not_found'
            ? 'agent_not_found'
          : result.status === 'missing_bank'
            ? 'missing_bank_name'
            : 'not_found';

      const unresolvedItem = toReportUnresolvedItem(sheetName, row, result, reason);
      report.unresolved[sheetName].push(unresolvedItem);

      if (result.status === 'ambiguous') {
        stdoutAmbiguities.push(unresolvedItem);
      }
    }
  }

  if (isCommit) {
    for (const op of updateOps) {
      await updateRow(op.sheetName, op.rowIndex, op.data, SHEET_HEADERS[op.sheetName]);
    }

    await auditLog('migration', 'migration_banco_id', 'system', {
      mode,
      resolved: TARGET_SHEETS.reduce((sum, sheetName) => sum + report.summary[sheetName].resolved, 0),
      empty: TARGET_SHEETS.reduce((sum, sheetName) => sum + report.summary[sheetName].empty, 0),
      ambiguous: TARGET_SHEETS.reduce((sum, sheetName) => sum + report.summary[sheetName].ambiguous, 0),
      skipped: TARGET_SHEETS.reduce((sum, sheetName) => sum + report.summary[sheetName].skipped, 0),
    });
  }

  writeReportFn(reportPath, report);

  log(`Migracion banco_id (${mode})`);
  for (const sheetName of TARGET_SHEETS) {
    const summary = report.summary[sheetName];
    log(`- ${sheetName}: ${summary.resolved} resueltos, ${summary.empty} vacios, ${summary.ambiguous} ambiguos`);
  }
  log(`- report: ${reportPath}`);

  if (stdoutAmbiguities.length > 0) {
    console.warn('Casos ambiguos de banco detectados:');
    for (const item of stdoutAmbiguities) {
      console.warn(`- ${item.sheet} row ${item.rowIndex || '?'} id=${item.id || ''} banco="${item.banco}"`);
      for (const candidate of item.candidates) {
        console.warn(`  candidate: ${candidate.id} | ${candidate.nombre} | propietario_id=${candidate.propietario_id || ''}`);
      }
    }
  }

  return report;
}

function printUsage() {
  console.error('Uso: node scripts/migrateBancoId.js --dry-run | --commit');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const hasDryRun = args.has('--dry-run');
  const hasCommit = args.has('--commit');

  if ((hasDryRun && hasCommit) || (!hasDryRun && !hasCommit)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await runMigration(
    { mode: hasCommit ? 'commit' : 'dry-run' },
    { log: (message) => console.log(message) },
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error en migracion banco_id: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG_AGENTES_SHEET,
  CONFIG_BANCOS_SHEET,
  REPORT_PATH,
  TARGET_SHEETS,
  buildAgentIndex,
  createEmptyReport,
  normalizeLookup,
  normalizeNameKey,
  normalizeText,
  resolveAgentFromRow,
  resolveBancoMatches,
  runMigration,
  writeReport,
};
