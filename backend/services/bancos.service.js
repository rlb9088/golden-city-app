const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { validateReferences, getConfigBancoById, getTable } = require('./config.service');
const { ForbiddenError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'bancos';
const HEADERS = ['id', 'fecha', 'banco_id', 'banco', 'saldo'];

let bancoCounter = 1;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getAuthLabel(caller = {}) {
  if (typeof caller === 'string') {
    return caller;
  }

  return caller?.user || caller?.nombre || caller?.username || caller?.userId || 'system';
}

function getCallerUserId(caller = {}) {
  if (typeof caller === 'string') {
    return normalizeText(caller);
  }

  return normalizeText(caller?.userId);
}

async function resolveBancoDetails(bancoId) {
  const banco = await getConfigBancoById(bancoId);
  if (!banco) {
    return {
      banco_id: String(bancoId ?? '').trim(),
      banco: '',
      propietario_id: '',
    };
  }

  return {
    banco_id: banco.id,
    banco: banco.nombre,
    propietario_id: banco.propietario_id || '',
  };
}

function matchesExactField(value, filterValue) {
  if (!filterValue) return true;
  return normalizeText(value) === normalizeText(filterValue);
}

function filterBancos(bancos, filters = {}) {
  return bancos.filter((banco) => matchesExactField(banco.agente, filters.agente));
}

function sortBancosForList(bancos) {
  return [...bancos].sort((a, b) => {
    const fechaCompare = String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''));
    if (fechaCompare !== 0) {
      return fechaCompare;
    }

    return String(a.banco ?? '').localeCompare(String(b.banco ?? ''));
  });
}

function sortConfigBancosForSelect(bancos) {
  return [...bancos].sort((a, b) => {
    const nombreCompare = String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''));
    if (nombreCompare !== 0) {
      return nombreCompare;
    }

    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

function resolveScopedOwnerId(caller = {}, requestedAgenteId = '') {
  const callerId = normalizeText(caller?.userId);
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const requestedId = normalizeText(requestedAgenteId);

  if (callerRole === 'agent') {
    return callerId;
  }

  return requestedId || callerId;
}

async function assertBancoOwnershipForCaller(bancoId, caller) {
  const bancoDetails = await resolveBancoDetails(bancoId);
  const bancoOwnerId = normalizeText(bancoDetails.propietario_id);
  const ownerUserId = getCallerUserId(caller);

  if (!ownerUserId) {
    throw new ForbiddenError('No se pudo resolver el usuario autenticado.', {
      context: { component: 'bancos.owner-check' },
    });
  }

  if (!bancoOwnerId || bancoOwnerId !== ownerUserId) {
    throw new ForbiddenError('El banco no pertenece al administrador autenticado.', {
      context: {
        banco_id: bancoDetails.banco_id,
        banco_owner_id: bancoOwnerId,
        owner_user_id: ownerUserId,
      },
    });
  }

  return bancoDetails;
}

/**
 * Upsert: si ya existe un registro con misma fecha+banco, lo sobreescribe.
 * Si no existe, crea uno nuevo.
 */
async function upsert(data, caller) {
  const warnings = await validateReferences([
    {
      tableName: 'bancos',
      field: 'id',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco_id,
    },
  ], getAuthLabel(caller), 'banco');

  const bancoDetails = await assertBancoOwnershipForCaller(data.banco_id, caller);

  const all = await repo.getAll(SHEET_NAME);
  const existing = all.find((r) => r.fecha === data.fecha && r.banco_id === bancoDetails.banco_id);

  if (existing) {
    // Overwrite existing
    const updated = {
      ...existing,
      saldo: data.saldo,
      banco_id: bancoDetails.banco_id,
      banco: bancoDetails.banco,
    };
    await repo.update(SHEET_NAME, existing._rowIndex, updated, HEADERS);
    await audit.log('update', 'banco', getAuthLabel(caller), {
      action: 'upsert_overwrite',
      fecha: data.fecha,
      banco_id: bancoDetails.banco_id,
      banco: bancoDetails.banco,
      saldo_anterior: existing.saldo,
      saldo_nuevo: data.saldo,
    });
    return { ...updated, overwritten: true, warnings };
  }

  // Create new
  const banco = {
    id: `BAN-${Date.now()}-${bancoCounter++}`,
    fecha: data.fecha,
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
    saldo: data.saldo,
  };

  await repo.append(SHEET_NAME, banco, HEADERS);
  await audit.log('create', 'banco', getAuthLabel(caller), banco);

  return { ...banco, overwritten: false, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const bancos = await getAll();
  const filtered = filterBancos(bancos, filters);
  return paginateItems(sortBancosForList(filtered), limit, offset);
}

async function getScopedBancos({ caller = {}, agenteId = '' } = {}) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const ownerId = resolveScopedOwnerId(caller, agenteId);
  const bancosConfigurados = await getTable('bancos');

  const scopedBancos = bancosConfigurados.filter((banco) => {
    if (callerRole === 'agent') {
      return normalizeText(banco.propietario_id) === ownerId;
    }

    if (ownerId) {
      return normalizeText(banco.propietario_id) === ownerId;
    }

    return true;
  });

  return sortConfigBancosForSelect(scopedBancos.map(stripInternalFields));
}

/**
 * Retorna el último saldo (fecha más reciente) por cada banco.
 */
async function getLatest() {
  const all = await repo.getAll(SHEET_NAME);
  const latest = {};
  all.forEach((row) => {
    const key = row.banco_id || row.banco;
    if (!latest[key] || row.fecha > latest[key].fecha) {
      latest[key] = row;
    }
  });
  return Object.values(latest);
}

module.exports = {
  upsert,
  getAll,
  getPagedAndFiltered,
  getScopedBancos,
  getLatest,
};
