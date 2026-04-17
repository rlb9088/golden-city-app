const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
const { validateReferences } = require('./config.service');
const { BadRequestError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'gastos';
const HEADERS = ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco', 'monto'];

let gastoCounter = 1;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeEstado(value) {
  const estado = normalizeText(value);
  return estado || 'activo';
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

function isActivo(record) {
  return normalizeEstado(record.estado) !== 'anulado';
}

async function create(data, adminUser) {
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
      field: 'nombre',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco,
    },
  ], adminUser, 'gasto');

  const gasto = {
    id: `GAS-${Date.now()}-${gastoCounter++}`,
    estado: 'activo',
    fecha_gasto: data.fecha_gasto,
    fecha_registro: nowLima(),
    concepto: data.concepto,
    categoria: data.categoria,
    subcategoria: data.subcategoria || '',
    banco: data.banco,
    monto: data.monto,
  };

  await repo.append(SHEET_NAME, gasto, HEADERS);
  await audit.log('create', 'gasto', adminUser, gasto);

  return { record: gasto, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

function sortGastosForList(gastos) {
  return [...gastos].reverse();
}

async function getPaged(limit, offset) {
  const gastos = await getAll();
  return paginateItems(sortGastosForList(gastos), limit, offset);
}

function buildUpdatedGasto(existing, updates) {
  return {
    ...existing,
    ...updates,
    estado: normalizeEstado(existing.estado),
  };
}

async function update(id, updates, user) {
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

  const nextRecord = buildUpdatedGasto(existing, updates);

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'gasto', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: updates,
  });

  return nextRecord;
}

async function cancel(id, motivo, user) {
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

  if (!isActivo(existing)) {
    throw new BadRequestError('El gasto ya se encuentra anulado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  const nextRecord = {
    ...existing,
    estado: 'anulado',
  };

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('delete', 'gasto', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    motivo,
  });

  return nextRecord;
}

module.exports = { create, getAll, getPaged, update, cancel };
