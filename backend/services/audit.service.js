const repo = require('../repositories/sheetsRepository');
const { nowLima } = require('../config/timezone');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'audit';
const HEADERS = ['id', 'action', 'entity', 'user', 'timestamp', 'changes'];

let auditCounter = 1;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeDateOnly(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const localMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) {
    return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  }

  return '';
}

function parseChanges(changes) {
  if (changes === null || changes === undefined || changes === '') {
    return {};
  }

  if (typeof changes !== 'string') {
    return changes;
  }

  try {
    return JSON.parse(changes);
  } catch {
    return changes;
  }
}

function normalizeAuditRecord(record) {
  const { _rowIndex, ...rest } = record;
  return {
    ...rest,
    changes: parseChanges(record.changes),
  };
}

function sortByTimestampDesc(records) {
  return [...records].sort((left, right) => {
    const timestampDiff = String(right.timestamp ?? '').localeCompare(String(left.timestamp ?? ''));
    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return String(right.id ?? '').localeCompare(String(left.id ?? ''));
  });
}

function normalizeFilters(filters = {}) {
  const desde = normalizeDateOnly(filters.desde);
  const hasta = normalizeDateOnly(filters.hasta);

  if (desde && hasta && desde > hasta) {
    return {
      entity: normalizeText(filters.entity),
      action: normalizeText(filters.action),
      user: normalizeText(filters.user),
      desde: hasta,
      hasta: desde,
    };
  }

  return {
    entity: normalizeText(filters.entity),
    action: normalizeText(filters.action),
    user: normalizeText(filters.user),
    desde,
    hasta,
  };
}

function matchesDateRange(timestamp, desde, hasta) {
  if (!desde && !hasta) {
    return true;
  }

  const rowDate = normalizeDateOnly(timestamp);
  if (!rowDate) {
    return false;
  }

  if (desde && rowDate < desde) {
    return false;
  }

  if (hasta && rowDate > hasta) {
    return false;
  }

  return true;
}

function matchesText(value, filterValue) {
  if (!filterValue) {
    return true;
  }

  return normalizeText(value).includes(filterValue);
}

/**
 * Registra un evento de auditoría inmutable.
 */
async function log(action, entity, user, changes = {}) {
  const entry = {
    id: `AUD-${Date.now()}-${auditCounter++}`,
    action,
    entity,
    user: user || 'system',
    timestamp: nowLima(),
    changes: JSON.stringify(changes),
  };

  await repo.append(SHEET_NAME, entry, HEADERS);
  return entry;
}

async function getAll() {
  const entries = await repo.getAll(SHEET_NAME);
  return sortByTimestampDesc(entries.map(normalizeAuditRecord));
}

async function getFiltered(filters = {}) {
  const normalized = normalizeFilters(filters);
  const entries = await getAll();

  return entries.filter((entry) => matchesText(entry.entity, normalized.entity)
    && matchesText(entry.action, normalized.action)
    && matchesText(entry.user, normalized.user)
    && matchesDateRange(entry.timestamp, normalized.desde, normalized.hasta));
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const entries = await getFiltered(filters);
  return paginateItems(entries, limit, offset);
}

module.exports = { log, getAll, getFiltered, getPagedAndFiltered };
