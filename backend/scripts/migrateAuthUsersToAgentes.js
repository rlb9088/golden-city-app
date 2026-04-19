const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const repo = require('../repositories/sheetsRepository');
const audit = require('../services/audit.service');
const { getSheetsClient, getSheetId } = require('../config/sheetsClient');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AUTH_SHEET_NAME = 'config_auth_users';
const AUTH_DEPRECATED_SHEET_NAME = 'config_auth_users_deprecated';
const AGENTES_SHEET_NAME = 'config_agentes';
const REQUIRED_AGENT_HEADERS = ['id', 'nombre', 'username', 'password_hash', 'role', 'activo'];
const REPORT_PATH = path.resolve(__dirname, 'migrateAuthUsersToAgentes.report.json');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLookup(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNameKey(value) {
  return normalizeLookup(value).replace(/\s+/g, ' ');
}

function normalizeRole(value) {
  return normalizeLookup(value) === 'admin' ? 'admin' : 'agent';
}

function normalizeBooleanString(value) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const normalized = normalizeLookup(value);
  return normalized === 'true' || normalized === '1' || normalized === 'si' ? 'true' : 'false';
}

function isMissingSheetError(error) {
  const statusCode = error?.statusCode || error?.status || error?.response?.status;
  const message = [
    error?.message,
    error?.details,
    error?.response?.data?.error?.message,
  ]
    .filter(Boolean)
    .join(' ');

  return statusCode === 404
    || (statusCode === 400 && /Unable to parse range/i.test(message));
}

function normalizeAuthUser(row) {
  return {
    id: normalizeText(row.id),
    username: normalizeText(row.username),
    password_hash: normalizeText(row.password_hash),
    role: normalizeRole(row.role),
    nombre: normalizeText(row.nombre) || normalizeText(row.username),
  };
}

function normalizeAgentRow(row) {
  return {
    ...row,
    id: normalizeText(row.id),
    nombre: normalizeText(row.nombre),
    username: normalizeText(row.username),
    password_hash: normalizeText(row.password_hash),
    role: normalizeRole(row.role),
    activo: normalizeBooleanString(row.activo),
  };
}

function buildAgentIndex(agentRows) {
  const byName = new Map();
  const byUsername = new Map();

  for (const row of agentRows.map(normalizeAgentRow)) {
    const nameKey = normalizeNameKey(row.nombre);
    if (nameKey) {
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey).push(row);
    }

    const usernameKey = normalizeLookup(row.username);
    if (usernameKey) {
      byUsername.set(usernameKey, row);
    }
  }

  return { byName, byUsername };
}

function buildUpdatedAgent(agent, authUser) {
  return {
    ...agent,
    nombre: agent.nombre || authUser.nombre || authUser.username,
    username: authUser.username,
    password_hash: authUser.password_hash,
    role: authUser.role,
    activo: 'true',
  };
}

function hasAuthData(agent) {
  return Boolean(normalizeText(agent.password_hash));
}

function isAlreadyMigrated(agent, authUser) {
  return normalizeLookup(agent.username) === normalizeLookup(authUser.username)
    && normalizeText(agent.password_hash) === normalizeText(authUser.password_hash)
    && normalizeRole(agent.role) === normalizeRole(authUser.role)
    && normalizeBooleanString(agent.activo) === 'true';
}

function createAgentId(index) {
  return `AG-${Date.now()}-${index + 1}`;
}

function buildCreatedAgent(authUser, index) {
  return {
    id: createAgentId(index),
    nombre: authUser.nombre || authUser.username,
    username: authUser.username,
    password_hash: authUser.password_hash,
    role: authUser.role,
    activo: 'true',
  };
}

function assertAgentHeaders(headers) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return;
  }

  const missingHeaders = REQUIRED_AGENT_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(
      `La hoja ${AGENTES_SHEET_NAME} no tiene el schema esperado. Faltan columnas: ${missingHeaders.join(', ')}.`,
    );
  }
}

async function safeGetRows(getRows, sheetName) {
  try {
    return await getRows(sheetName);
  } catch (error) {
    if (isMissingSheetError(error)) {
      return null;
    }
    throw error;
  }
}

async function getSheetHeadersDefault(sheetName) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();

  if (!sheets || !spreadsheetId) {
    return null;
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return response.data.values?.[0] || [];
  } catch (error) {
    if (isMissingSheetError(error)) {
      return null;
    }
    throw error;
  }
}

async function archiveAuthSheetDefault({ sourceSheet, targetSheet }) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();

  if (!sheets || !spreadsheetId) {
    return { status: 'skipped_no_sheets_client' };
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });

  const sheetProperties = (metadata.data.sheets || []).map((sheet) => sheet.properties || {});
  const source = sheetProperties.find((sheet) => sheet.title === sourceSheet);
  const target = sheetProperties.find((sheet) => sheet.title === targetSheet);

  if (!source && target) {
    return { status: 'already_archived' };
  }

  if (!source) {
    return { status: 'missing_source_sheet' };
  }

  if (target) {
    return { status: 'target_already_exists' };
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: source.sheetId,
              title: targetSheet,
            },
            fields: 'title',
          },
        },
      ],
    },
  });

  return { status: 'archived' };
}

function writeReportDefault(reportPath, report) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function runMigration(options = {}, dependencies = {}) {
  const mode = options.mode === 'commit' ? 'commit' : 'dry-run';
  const isCommit = mode === 'commit';
  const reportPath = dependencies.reportPath || REPORT_PATH;
  const getRows = dependencies.getRows || repo.getAll;
  const appendRow = dependencies.appendRow || repo.append;
  const updateRow = dependencies.updateRow || repo.update;
  const writeReport = dependencies.writeReport || writeReportDefault;
  const getSheetHeaders = dependencies.getSheetHeaders || getSheetHeadersDefault;
  const archiveAuthSheet = dependencies.archiveAuthSheet || archiveAuthSheetDefault;
  const auditLog = dependencies.auditLog || audit.log;
  const log = dependencies.log || (() => {});

  const agentHeaders = await getSheetHeaders(AGENTES_SHEET_NAME);
  assertAgentHeaders(agentHeaders);

  const [activeAuthRows, deprecatedAuthRows, agentRowsRaw] = await Promise.all([
    safeGetRows(getRows, AUTH_SHEET_NAME),
    safeGetRows(getRows, AUTH_DEPRECATED_SHEET_NAME),
    safeGetRows(getRows, AGENTES_SHEET_NAME),
  ]);

  const sourceSheet = Array.isArray(activeAuthRows) && activeAuthRows.length > 0
    ? AUTH_SHEET_NAME
    : (Array.isArray(deprecatedAuthRows) && deprecatedAuthRows.length > 0 ? AUTH_DEPRECATED_SHEET_NAME : null);

  const authRows = (sourceSheet === AUTH_SHEET_NAME ? activeAuthRows : deprecatedAuthRows) || [];
  const agentRows = (agentRowsRaw || []).map(normalizeAgentRow);
  const { byName, byUsername } = buildAgentIndex(agentRows);
  const operations = [];

  const report = {
    mode,
    sourceSheet,
    updated: [],
    created: [],
    ambiguous: [],
    skipped: [],
    archiveStatus: 'not_requested',
  };

  for (const [index, rawAuthUser] of authRows.entries()) {
    const authUser = normalizeAuthUser(rawAuthUser);
    const authNameKey = normalizeNameKey(authUser.nombre);
    const matches = authNameKey ? (byName.get(authNameKey) || []) : [];

    if (!authUser.username) {
      report.skipped.push({
        auth_username: '',
        auth_id: authUser.id,
        reason: 'missing_username',
      });
      continue;
    }

    if (!authUser.password_hash) {
      report.skipped.push({
        auth_username: authUser.username,
        auth_id: authUser.id,
        reason: 'missing_password_hash',
      });
      continue;
    }

    if (matches.length > 1) {
      report.ambiguous.push({
        auth_username: authUser.username,
        auth_id: authUser.id,
        candidates: matches.map((candidate) => ({
          id: candidate.id,
          nombre: candidate.nombre,
          username: candidate.username,
        })),
      });
      continue;
    }

    if (matches.length === 1) {
      const agent = matches[0];

      if (isAlreadyMigrated(agent, authUser)) {
        report.skipped.push({
          auth_username: authUser.username,
          agent_id: agent.id,
          reason: 'already_migrated',
        });
        continue;
      }

      if (hasAuthData(agent)) {
        report.skipped.push({
          auth_username: authUser.username,
          agent_id: agent.id,
          reason: 'agent_already_has_auth_data',
        });
        continue;
      }

      const updatedAgent = buildUpdatedAgent(agent, authUser);
      operations.push({
        type: 'update',
        sheetName: AGENTES_SHEET_NAME,
        rowIndex: agent._rowIndex,
        data: updatedAgent,
      });
      report.updated.push({
        auth_username: authUser.username,
        agent_id: agent.id,
        match: 'A',
      });
      continue;
    }

    const usernameMatch = byUsername.get(normalizeLookup(authUser.username));
    if (usernameMatch && hasAuthData(usernameMatch)) {
      report.skipped.push({
        auth_username: authUser.username,
        agent_id: usernameMatch.id,
        reason: 'already_migrated_by_username',
      });
      continue;
    }

    const createdAgent = buildCreatedAgent(authUser, index);
    operations.push({
      type: 'create',
      sheetName: AGENTES_SHEET_NAME,
      data: createdAgent,
    });
    report.created.push({
      auth_username: authUser.username,
      agent_id: createdAgent.id,
      match: 'B',
    });
  }

  if (isCommit) {
    for (const operation of operations) {
      if (operation.type === 'update') {
        await updateRow(AGENTES_SHEET_NAME, operation.rowIndex, operation.data, REQUIRED_AGENT_HEADERS);
      } else {
        await appendRow(AGENTES_SHEET_NAME, operation.data, REQUIRED_AGENT_HEADERS);
      }
    }

    if (sourceSheet === AUTH_SHEET_NAME) {
      report.archiveStatus = (await archiveAuthSheet({
        sourceSheet: AUTH_SHEET_NAME,
        targetSheet: AUTH_DEPRECATED_SHEET_NAME,
      })).status;
    } else if (sourceSheet === AUTH_DEPRECATED_SHEET_NAME) {
      report.archiveStatus = 'already_archived';
    } else {
      report.archiveStatus = 'no_source_sheet';
    }

    await auditLog('migration_auth', AGENTES_SHEET_NAME, 'system', {
      sourceSheet,
      updated: report.updated.length,
      created: report.created.length,
      ambiguous: report.ambiguous.length,
      skipped: report.skipped.length,
      archiveStatus: report.archiveStatus,
    });
  }

  report.summary = {
    updated: report.updated.length,
    created: report.created.length,
    ambiguous: report.ambiguous.length,
    skipped: report.skipped.length,
  };

  writeReport(reportPath, report);
  log(`Migracion auth->agentes (${mode})`);
  log(`- sourceSheet: ${sourceSheet || 'none'}`);
  log(`- updated (A): ${report.summary.updated}`);
  log(`- created (B): ${report.summary.created}`);
  log(`- ambiguous (C): ${report.summary.ambiguous}`);
  log(`- skipped: ${report.summary.skipped}`);
  log(`- archiveStatus: ${report.archiveStatus}`);
  log(`- report: ${reportPath}`);

  return report;
}

function printUsage() {
  console.error('Uso: node scripts/migrateAuthUsersToAgentes.js --dry-run | --commit');
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

  const report = await runMigration(
    { mode: hasCommit ? 'commit' : 'dry-run' },
    { log: (message) => console.log(message) },
  );

  if (report.ambiguous.length > 0) {
    console.warn('La migracion termino con casos ambiguos. Revise el reporte antes de desplegar TICKET-047.');
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error en migracion auth->agentes: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  AGENTES_SHEET_NAME,
  AUTH_DEPRECATED_SHEET_NAME,
  AUTH_SHEET_NAME,
  REQUIRED_AGENT_HEADERS,
  REPORT_PATH,
  assertAgentHeaders,
  buildCreatedAgent,
  buildUpdatedAgent,
  isMissingSheetError,
  normalizeAuthUser,
  normalizeAgentRow,
  runMigration,
};
