const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
const { validateReferences } = require('./config.service');
const { BadRequestError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'pagos';
const HEADERS = [
  'id', 'estado', 'usuario', 'caja', 'banco', 'monto', 'tipo',
  'comprobante_url', 'fecha_comprobante', 'fecha_registro', 'agente'
];

let pagoCounter = 1;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeEstado(value) {
  const estado = normalizeText(value);
  return estado || 'activo';
}

function isPagoActivo(pago) {
  return normalizeEstado(pago.estado) !== 'anulado';
}

function stripInternalFields(pago) {
  const { _rowIndex, ...rest } = pago;
  return rest;
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

  if (desde && hasta && desde > hasta) {
    return {
      agente: normalizeText(filters.agente),
      banco: normalizeText(filters.banco),
      usuario: normalizeText(filters.usuario),
      desde: hasta,
      hasta: desde,
    };
  }

  return {
    agente: normalizeText(filters.agente),
    banco: normalizeText(filters.banco),
    usuario: normalizeText(filters.usuario),
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

function matchesUserSearch(usuario, search) {
  if (!search) return true;
  return normalizeText(usuario).includes(search);
}

function matchesExactField(value, filterValue) {
  if (!filterValue) return true;
  return normalizeText(value) === filterValue;
}

function filterPagos(pagos, filters = {}) {
  const normalized = normalizeFilters(filters);

  return pagos.filter((pago) => {
    const rowDate = normalizeDateOnly(pago.fecha_registro || pago.fecha_comprobante);

    return matchesDateRange(rowDate, normalized.desde, normalized.hasta)
      && matchesExactField(pago.agente, normalized.agente)
      && matchesExactField(pago.banco, normalized.banco)
      && matchesUserSearch(pago.usuario, normalized.usuario);
  });
}

function sortPagosForList(pagos) {
  return [...pagos].reverse();
}

async function create(data, agente) {
  const warnings = await validateReferences([
    {
      tableName: 'bancos',
      field: 'nombre',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco,
    },
    {
      tableName: 'cajas',
      field: 'nombre',
      label: 'caja',
      tableLabel: 'config_cajas',
      value: data.caja,
    },
    {
      tableName: 'tipos_pago',
      field: 'nombre',
      label: 'tipo de pago',
      tableLabel: 'config_tipos_pago',
      value: data.tipo,
    },
  ], agente, 'pago');

  const pago = {
    id: `PAG-${Date.now()}-${pagoCounter++}`,
    estado: 'activo',
    usuario: data.usuario,
    caja: data.caja,
    banco: data.banco,
    monto: data.monto,
    tipo: data.tipo,
    comprobante_url: data.comprobante_url || '',
    fecha_comprobante: data.fecha_comprobante || '',
    fecha_registro: nowLima(),
    agente: agente,
  };

  await repo.append(SHEET_NAME, pago, HEADERS);
  await audit.log('create', 'pago', agente, pago);

  return { record: pago, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

async function getFiltered(filters = {}) {
  const pagos = await getAll();
  return filterPagos(pagos, filters);
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const pagos = await getFiltered(filters);
  return paginateItems(sortPagosForList(pagos), limit, offset);
}

async function getByAgent(agente) {
  return getFiltered({ agente });
}

async function getById(id) {
  const pagos = await getAll();
  return pagos.find((pago) => pago.id === id) || null;
}

function buildUpdatedPago(existing, updates) {
  return {
    ...existing,
    ...updates,
    estado: normalizeEstado(existing.estado),
  };
}

async function update(id, updates, user) {
  const pagos = await getAll();
  const existing = pagos.find((pago) => pago.id === id);

  if (!existing) {
    throw new NotFoundError('No se encontró el pago solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  const nextRecord = buildUpdatedPago(existing, updates);

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'pago', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: updates,
  });

  return nextRecord;
}

async function cancel(id, motivo, user) {
  const pagos = await getAll();
  const existing = pagos.find((pago) => pago.id === id);

  if (!existing) {
    throw new NotFoundError('No se encontró el pago solicitado.', {
      context: {
        sheet: SHEET_NAME,
        id,
      },
    });
  }

  if (normalizeEstado(existing.estado) === 'anulado') {
    throw new BadRequestError('El pago ya se encuentra anulado.', {
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
  await audit.log('delete', 'pago', user, {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    motivo,
  });

  return nextRecord;
}

function filterActiveRecords(records) {
  return records.filter(isPagoActivo);
}

module.exports = { create, getAll, getFiltered, getPagedAndFiltered, getByAgent, getById, update, cancel, filterActiveRecords };
