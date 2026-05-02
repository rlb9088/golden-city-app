const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
const { validateReferences, getConfigBancoById } = require('./config.service');
const { ForbiddenError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');
const { createPrefixedId } = require('../utils/id');

const SHEET_NAME = 'gastos';
const HEADERS = ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco_id', 'banco', 'monto'];

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

function getAuthLabel(caller = {}) {
  if (typeof caller === 'string') {
    return caller;
  }

  return caller?.user || caller?.nombre || caller?.username || caller?.userId || 'system';
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

function getOwnerId(caller = {}) {
  if (typeof caller === 'string') {
    return normalizeId(caller);
  }

  return normalizeId(caller?.userId);
}

async function assertBancoOwnershipForCaller(bancoId, caller) {
  const bancoDetails = await resolveBancoDetails(bancoId);
  const bancoOwnerId = normalizeId(bancoDetails.propietario_id);
  const ownerId = getOwnerId(caller);

  if (!ownerId) {
    throw new ForbiddenError('No se pudo resolver el usuario autenticado.', {
      context: { component: 'gastos.owner-check' },
    });
  }

  if (!bancoOwnerId || bancoOwnerId !== ownerId) {
    throw new ForbiddenError('El banco no pertenece al administrador autenticado.', {
      context: {
        banco_id: bancoDetails.banco_id,
        banco_owner_id: bancoOwnerId,
        owner_user_id: ownerId,
      },
    });
  }

  return bancoDetails;
}

function normalizeEstado(value) {
  const estado = normalizeText(value);
  return estado || 'activo';
}

function normalizeDateOnly(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const localMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) {
    return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  }

  return '';
}

function normalizeFilters(filters = {}) {
  const desde = normalizeDateOnly(filters.desde);
  const hasta = normalizeDateOnly(filters.hasta);
  const categoria = normalizeText(filters.categoria);

  if (desde && hasta && desde > hasta) {
    return {
      categoria,
      desde: hasta,
      hasta: desde,
    };
  }

  return {
    categoria,
    desde,
    hasta,
  };
}

function matchesDateRange(rowDate, desde, hasta) {
  if (!desde && !hasta) return true;
  if (!rowDate) return false;
  if (desde && rowDate < desde) return false;
  if (hasta && rowDate > hasta) return false;
  return true;
}

function matchesExactField(value, filterValue) {
  if (!filterValue) return true;
  return normalizeText(value) === filterValue;
}

function filterGastos(gastos, filters = {}) {
  const normalized = normalizeFilters(filters);

  return gastos.filter((gasto) => {
    const rowDate = normalizeDateOnly(gasto.fecha_gasto || gasto.fecha_registro);

    return matchesDateRange(rowDate, normalized.desde, normalized.hasta)
      && matchesExactField(gasto.categoria, normalized.categoria);
  });
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

async function create(data, caller) {
  const warnings = await validateReferences([
    {
      tableName: 'categorias',
      label: 'categoría',
      tableLabel: 'config_categorias',
      value: data.categoria,
      matcher: (row, value) => String(row.categoria ?? '').trim().toLowerCase() === String(value).trim().toLowerCase(),
    },
    {
      tableName: 'categorias',
      label: 'subcategoría',
      tableLabel: `config_categorias (${data.categoria || 'sin categoría'})`,
      value: data.subcategoria,
      matcher: (row, value) => String(row.categoria ?? '').trim().toLowerCase() === String(data.categoria ?? '').trim().toLowerCase()
        && String(row.subcategoria ?? '').trim().toLowerCase() === String(value).trim().toLowerCase(),
      message: data.subcategoria
        ? `La subcategoría "${data.subcategoria}" no existe dentro de la categoría "${data.categoria}". Se registró igualmente para no bloquear la operación.`
        : '',
    },
    {
      tableName: 'bancos',
      field: 'id',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco_id,
    },
  ], getAuthLabel(caller), 'gasto');

  const bancoDetails = await assertBancoOwnershipForCaller(data.banco_id, caller);

  const gasto = {
    id: createPrefixedId('GAS'),
    estado: 'activo',
    fecha_gasto: data.fecha_gasto,
    fecha_registro: nowLima(),
    concepto: data.concepto,
    categoria: data.categoria,
    subcategoria: data.subcategoria || '',
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
    monto: data.monto,
  };

  await repo.append(SHEET_NAME, gasto, HEADERS);
  await audit.log('create', 'gasto', getAuthLabel(caller), gasto);

  return { record: gasto, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

function sortGastosForList(gastos) {
  return [...gastos].reverse();
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const gastos = await getAll();
  const filtered = filterGastos(gastos, filters);
  return paginateItems(sortGastosForList(filtered), limit, offset);
}

async function getPaged(limit, offset, filters = {}) {
  return getPagedAndFiltered(filters, limit, offset);
}

async function getById(id) {
  return repo.findById(SHEET_NAME, id);
}

function buildUpdatedGasto(existing, updates) {
  return {
    ...existing,
    ...updates,
    estado: normalizeEstado(existing.estado),
  };
}

async function update(id, updates, caller) {
  const gastos = await getAll();
  const existing = gastos.find((gasto) => gasto.id === id);

  if (!existing) {
    throw new NotFoundError('No se encontró el gasto solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  const nextBancoReference = Object.prototype.hasOwnProperty.call(updates, 'banco_id')
    ? updates.banco_id
    : existing.banco_id;

  if (Object.prototype.hasOwnProperty.call(updates, 'banco_id')) {
    await validateReferences([
      {
        tableName: 'bancos',
        field: 'id',
        label: 'banco',
        tableLabel: 'config_bancos',
        value: updates.banco_id,
      },
    ], getAuthLabel(caller), 'gasto');
  }

  const bancoDetails = await assertBancoOwnershipForCaller(nextBancoReference, caller);

  let nextRecord = buildUpdatedGasto(existing, updates);
  nextRecord = {
    ...nextRecord,
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
  };

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'gasto', getAuthLabel(caller), {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: Object.prototype.hasOwnProperty.call(updates, 'banco_id')
      ? { ...updates, banco: nextRecord.banco }
      : updates,
  });

  return nextRecord;
}

async function remove(id, caller) {
  const existing = await repo.findById(SHEET_NAME, id);

  if (!existing) {
    throw new NotFoundError('No se encontró el gasto solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  await repo.delete(SHEET_NAME, existing._rowIndex);
  await audit.log('delete', 'gasto', getAuthLabel(caller), {
    before: stripInternalFields(existing),
  });

  return { id };
}

module.exports = {
  create,
  getAll,
  getPaged,
  getPagedAndFiltered,
  getById,
  update,
  remove,
};
