const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
const { validateReferences } = require('./config.service');
const { BadRequestError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'ingresos';
const HEADERS = ['id', 'estado', 'agente', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'];

let ingresoCounter = 1;

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
      tableName: 'agentes',
      field: 'nombre',
      label: 'agente',
      tableLabel: 'config_agentes',
      value: data.agente,
    },
    {
      tableName: 'bancos',
      field: 'nombre',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco,
    },
  ], adminUser, 'ingreso');

  const ingreso = {
    id: `ING-${Date.now()}-${ingresoCounter++}`,
    estado: 'activo',
    agente: data.agente,
    banco: data.banco,
    monto: data.monto,
    fecha_movimiento: data.fecha_movimiento,
    fecha_registro: nowLima(),
  };

  await repo.append(SHEET_NAME, ingreso, HEADERS);
  await audit.log('create', 'ingreso', adminUser, ingreso);

  return { record: ingreso, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

function sortIngresosForList(ingresos) {
  return [...ingresos].reverse();
}

async function getPaged(limit, offset, filters = {}) {
  const ingresos = await getAll();
  const filtered = filters.agente
    ? ingresos.filter((ingreso) => normalizeText(ingreso.agente) === normalizeText(filters.agente))
    : ingresos;

  return paginateItems(sortIngresosForList(filtered), limit, offset);
}

async function getByAgent(agente) {
  return repo.findByColumn(SHEET_NAME, 'agente', agente);
}

function buildUpdatedIngreso(existing, updates) {
  return {
    ...existing,
    ...updates,
    estado: normalizeEstado(existing.estado),
  };
}

async function update(id, updates, user) {
  const ingresos = await getAll();
  const existing = ingresos.find((ingreso) => ingreso.id === id);

  if (!existing) {
    throw new NotFoundError('No se encontró el ingreso solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  const nextRecord = buildUpdatedIngreso(existing, updates);

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'ingreso', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: updates,
  });

  return nextRecord;
}

async function cancel(id, motivo, user) {
  const ingresos = await getAll();
  const existing = ingresos.find((ingreso) => ingreso.id === id);

  if (!existing) {
    throw new NotFoundError('No se encontró el ingreso solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  if (!isActivo(existing)) {
    throw new BadRequestError('El ingreso ya se encuentra anulado.', {
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
  await audit.log('delete', 'ingreso', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    motivo,
  });

  return nextRecord;
}

module.exports = { create, getAll, getPaged, getByAgent, update, cancel };
