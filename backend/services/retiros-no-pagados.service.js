const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { getTable } = require('./config.service');
const { BadRequestError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');
const { createPrefixedId } = require('../utils/id');
const { retiroNoPagadoSchema } = require('../schemas/retiros-no-pagados.schema');

const SHEET_NAME = 'retiros_no_pagados';
const HEADERS = ['id', 'fecha', 'caja_id', 'caja', 'monto'];

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

function getAuthLabel(caller = {}) {
  if (typeof caller === 'string') {
    return caller;
  }

  return caller?.user || caller?.nombre || caller?.username || caller?.userId || caller?.id || 'system';
}

async function resolveCajaDetails(cajaId) {
  const cajas = await getTable('cajas');
  const normalizedCajaId = normalizeText(cajaId);
  const match = cajas.find((caja) => normalizeText(caja.id) === normalizedCajaId);

  if (!match) {
    return null;
  }

  return {
    caja_id: match.id,
    caja: match.nombre || match.id,
  };
}

function assertValidPayload(data) {
  const parsed = retiroNoPagadoSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new BadRequestError(firstIssue?.message || 'Datos invalidos para retiro no pagado.', {
      context: {
        sheet: SHEET_NAME,
        issues: parsed.error.issues,
      },
    });
  }

  return parsed.data;
}

function sortRetirosNoPagadosForList(rows) {
  return [...rows].sort((a, b) => {
    const fechaCompare = String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''));
    if (fechaCompare !== 0) {
      return fechaCompare;
    }

    const cajaCompare = String(a.caja ?? '').localeCompare(String(b.caja ?? ''));
    if (cajaCompare !== 0) {
      return cajaCompare;
    }

    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
}

function matchesExactField(value, filterValue) {
  if (!filterValue) {
    return true;
  }

  return normalizeText(value) === normalizeText(filterValue);
}

function filterRetirosNoPagados(retirosNoPagados, filters = {}) {
  return retirosNoPagados.filter((retiroNoPagado) => matchesExactField(retiroNoPagado.caja, filters.caja));
}

async function upsert(data, caller) {
  const payload = assertValidPayload(data);
  const cajaDetails = await resolveCajaDetails(payload.caja_id);

  if (!cajaDetails) {
    throw new BadRequestError('La caja especificada no existe en config_cajas.', {
      context: {
        sheet: SHEET_NAME,
        caja_id: payload.caja_id,
      },
    });
  }

  const all = await repo.getAll(SHEET_NAME);
  const existing = all.find((row) => row.fecha === payload.fecha && normalizeText(row.caja_id) === normalizeText(cajaDetails.caja_id));

  if (existing) {
    const updated = {
      ...existing,
      fecha: payload.fecha,
      caja_id: cajaDetails.caja_id,
      caja: cajaDetails.caja,
      monto: payload.monto,
    };

    await repo.update(SHEET_NAME, existing._rowIndex, updated, HEADERS);
    await audit.log('upsert_overwrite', 'retiro_no_pagado', getAuthLabel(caller), {
      before: stripInternalFields(existing),
      after: stripInternalFields(updated),
      changes: {
        fecha: payload.fecha,
        caja_id: cajaDetails.caja_id,
        caja: cajaDetails.caja,
        monto_anterior: existing.monto,
        monto_nuevo: payload.monto,
      },
    });

    return { ...updated, overwritten: true, warnings: [] };
  }

  const record = {
    id: createPrefixedId('RNP'),
    fecha: payload.fecha,
    caja_id: cajaDetails.caja_id,
    caja: cajaDetails.caja,
    monto: payload.monto,
  };

  await repo.append(SHEET_NAME, record, HEADERS);
  await audit.log('create', 'retiro_no_pagado', getAuthLabel(caller), record);

  return { ...record, overwritten: false, warnings: [] };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const retirosNoPagados = await getAll();
  const filtered = filterRetirosNoPagados(retirosNoPagados, filters);
  return paginateItems(sortRetirosNoPagadosForList(filtered), limit, offset);
}

async function getLatest() {
  const all = await getAll();
  const latest = new Map();

  for (const row of all) {
    const key = normalizeText(row.caja_id);
    if (!key) {
      continue;
    }

    const current = latest.get(key);
    if (!current) {
      latest.set(key, row);
      continue;
    }

    const fechaCompare = String(row.fecha ?? '').localeCompare(String(current.fecha ?? ''));
    if (fechaCompare > 0) {
      latest.set(key, row);
      continue;
    }

    if (fechaCompare === 0 && String(row.id ?? '').localeCompare(String(current.id ?? '')) > 0) {
      latest.set(key, row);
    }
  }

  return sortRetirosNoPagadosForList([...latest.values()]);
}

module.exports = {
  upsert,
  getAll,
  getPagedAndFiltered,
  getLatest,
};
