const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
const { getTable, assertCatalogValue, validateReferences } = require('./config.service');
const { assertBancoOwnershipForCaller, getAuthLabel, normalizeDateOnly } = require('./gastos.service');
const { BadRequestError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');
const { createPrefixedId } = require('../utils/id');

/**
 * Modulo "Reparto e inversiones": puramente informativo.
 * NO debe ser consumido por balance.service ni por ningun calculo de caja.
 */
const SHEET_NAME = 'repartos';
const HEADERS = ['id', 'estado', 'fecha_movimiento', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'dominio', 'proveedor', 'nota', 'banco_id', 'banco', 'monto'];

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

/**
 * Resuelve el dominio ("Inversión" | "Reparto socios") a partir de la categoria
 * y valida la subcategoria contra config_categorias_reparto.
 */
async function resolveClasificacion(categoria, subcategoria) {
  const rows = await getTable('categorias_reparto');
  const catKey = normalizeText(categoria);
  const inCategoria = rows.filter((row) => normalizeText(row.categoria) === catKey);

  if (inCategoria.length === 0) {
    throw new BadRequestError(`La categoría "${categoria}" no existe en el catálogo de repartos e inversiones.`, {
      context: { categoria },
    });
  }

  const subKey = normalizeText(subcategoria);
  const match = subKey
    ? inCategoria.find((row) => normalizeText(row.subcategoria) === subKey)
    : inCategoria[0];

  if (!match) {
    throw new BadRequestError(`La subcategoría "${subcategoria}" no pertenece a la categoría "${categoria}".`, {
      context: { categoria, subcategoria },
    });
  }

  return {
    dominio: String(match.dominio ?? '').trim(),
    categoria: String(match.categoria).trim(),
    subcategoria: subKey ? String(match.subcategoria).trim() : '',
  };
}

function filterRepartos(repartos, filters = {}) {
  const desde = normalizeDateOnly(filters.desde);
  const hasta = normalizeDateOnly(filters.hasta);
  const [from, to] = desde && hasta && desde > hasta ? [hasta, desde] : [desde, hasta];
  const categoria = normalizeText(filters.categoria);
  const dominio = normalizeText(filters.dominio);

  return repartos.filter((row) => {
    const rowDate = normalizeDateOnly(row.fecha_movimiento || row.fecha_registro);
    if ((from || to) && !rowDate) return false;
    if (from && rowDate < from) return false;
    if (to && rowDate > to) return false;
    if (categoria && normalizeText(row.categoria) !== categoria) return false;
    if (dominio && normalizeText(row.dominio) !== dominio) return false;
    return true;
  });
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const repartos = await getAll();
  return paginateItems([...filterRepartos(repartos, filters)].reverse(), limit, offset);
}

async function getById(id) {
  return repo.findById(SHEET_NAME, id);
}

async function create(data, caller) {
  const concepto = await assertCatalogValue('conceptos_reparto', 'Concepto', data.concepto);
  const proveedor = await assertCatalogValue('proveedores_reparto', 'Proveedor', data.proveedor);
  const clasificacion = await resolveClasificacion(data.categoria, data.subcategoria);

  const warnings = await validateReferences([
    { tableName: 'bancos', field: 'id', label: 'banco', tableLabel: 'config_bancos', value: data.banco_id },
  ], getAuthLabel(caller), 'reparto');

  const bancoDetails = await assertBancoOwnershipForCaller(data.banco_id, caller);

  const reparto = {
    id: createPrefixedId('REP'),
    estado: 'activo',
    fecha_movimiento: data.fecha_movimiento,
    fecha_registro: nowLima(),
    concepto,
    categoria: clasificacion.categoria,
    subcategoria: clasificacion.subcategoria,
    dominio: clasificacion.dominio,
    proveedor,
    nota: String(data.nota ?? '').trim(),
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
    monto: data.monto,
  };

  await repo.append(SHEET_NAME, reparto, HEADERS);
  await audit.log('create', 'reparto', getAuthLabel(caller), reparto);

  return { record: reparto, warnings };
}

async function update(id, updates, caller) {
  const existing = (await getAll()).find((row) => row.id === id);
  if (!existing) {
    throw new NotFoundError('No se encontró el reparto solicitado.', { context: { sheet: SHEET_NAME, id } });
  }

  const next = { ...existing, ...updates };

  if (updates.concepto !== undefined && normalizeText(updates.concepto) !== normalizeText(existing.concepto)) {
    next.concepto = await assertCatalogValue('conceptos_reparto', 'Concepto', updates.concepto);
  }
  if (updates.proveedor !== undefined && normalizeText(updates.proveedor) !== normalizeText(existing.proveedor)) {
    next.proveedor = await assertCatalogValue('proveedores_reparto', 'Proveedor', updates.proveedor);
  }
  if (updates.nota !== undefined) {
    next.nota = String(updates.nota ?? '').trim();
  }
  if (updates.categoria !== undefined || updates.subcategoria !== undefined) {
    const clasificacion = await resolveClasificacion(next.categoria, next.subcategoria);
    Object.assign(next, clasificacion);
  }

  await validateReferences([
    { tableName: 'bancos', field: 'id', label: 'banco', tableLabel: 'config_bancos', value: updates.banco_id },
  ], getAuthLabel(caller), 'reparto');
  const bancoDetails = await assertBancoOwnershipForCaller(updates.banco_id, caller);

  const nextRecord = {
    ...next,
    estado: existing.estado || 'activo',
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
  };

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'reparto', getAuthLabel(caller), {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: updates,
  });

  return nextRecord;
}

async function remove(id, caller) {
  const existing = await repo.findById(SHEET_NAME, id);
  if (!existing) {
    throw new NotFoundError('No se encontró el reparto solicitado.', { context: { sheet: SHEET_NAME, id } });
  }

  await repo.deleteRow(SHEET_NAME, existing._rowIndex);
  await audit.log('delete', 'reparto', getAuthLabel(caller), { before: stripInternalFields(existing) });

  return { id };
}

module.exports = { create, getAll, getPagedAndFiltered, getById, update, remove };
