const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const authService = require('./auth.service');
const { nowLima } = require('../config/timezone');
const { validateReferences, getConfigBancoById } = require('./config.service');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');
const { createPrefixedId } = require('../utils/id');

const SHEET_NAME = 'ingresos';
const HEADERS = ['id', 'estado', 'agente', 'banco_id', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'];

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

async function resolveAgentByReference(reference) {
  const needle = normalizeId(reference).toLowerCase();
  if (!needle) {
    return null;
  }

  const agents = await authService.getAuthUsers();
  return agents.find((agent) => (
    normalizeId(agent.id).toLowerCase() === needle
    || normalizeText(agent.nombre) === needle
    || normalizeText(agent.username) === needle
  )) || null;
}

async function resolveIngresoAgent(caller = {}, requestedAgentReference = '', fallbackAgentReference = '') {
  if (typeof caller === 'string') {
    const directMatch = await resolveAgentByReference(requestedAgentReference || fallbackAgentReference);
    if (directMatch) {
      return directMatch;
    }

    return resolveAgentByReference(caller);
  }

  const callerUserId = normalizeId(caller?.userId);
  const callerRole = normalizeText(caller?.role);

  if (!callerUserId) {
    throw new ForbiddenError('No se pudo resolver el usuario autenticado.', {
      context: { component: 'ingresos.owner-check' },
    });
  }

  if (callerRole === 'agent') {
    const agent = await resolveAgentByReference(callerUserId);
    if (!agent) {
      throw new ForbiddenError('No se pudo resolver el agente autenticado.', {
        context: { userId: callerUserId },
      });
    }
    return agent;
  }

  const targetReference = requestedAgentReference || fallbackAgentReference || callerUserId;
  const agent = await resolveAgentByReference(targetReference);

  if (!agent) {
    throw new BadRequestError('El agente seleccionado no existe.', {
      context: { agentReference: targetReference },
    });
  }

  if (agent.activo === false) {
    throw new ForbiddenError('El agente seleccionado esta inactivo.', {
      context: { agentId: agent.id },
    });
  }

  return agent;
}

async function assertBancoOwnershipForAgent(bancoId, agentId) {
  const bancoDetails = await resolveBancoDetails(bancoId);
  const bancoOwnerId = normalizeId(bancoDetails.propietario_id);
  const targetAgentId = normalizeId(agentId);

  if (!bancoOwnerId || bancoOwnerId !== targetAgentId) {
    throw new ForbiddenError('El banco no pertenece al agente objetivo del ingreso.', {
      context: {
        banco_id: bancoDetails.banco_id,
        banco_owner_id: bancoOwnerId,
        owner_agent_id: targetAgentId,
      },
    });
  }

  return bancoDetails;
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
  const agente = normalizeText(filters.agente);
  const banco = normalizeText(filters.banco);
  const usuario = normalizeText(filters.usuario);

  if (desde && hasta && desde > hasta) {
    return {
      agente,
      banco,
      usuario,
      desde: hasta,
      hasta: desde,
    };
  }

  return {
    agente,
    banco,
    usuario,
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

function matchesUserFilter(record, filterValue) {
  if (!filterValue) return true;
  const userValue = record.usuario || record.agente;
  return normalizeText(userValue).includes(filterValue);
}

function filterIngresos(ingresos, filters = {}) {
  const normalized = normalizeFilters(filters);

  return ingresos.filter((ingreso) => {
    const rowDate = normalizeDateOnly(ingreso.fecha_movimiento || ingreso.fecha_registro);

    return matchesDateRange(rowDate, normalized.desde, normalized.hasta)
      && matchesExactField(ingreso.agente, normalized.agente)
      && matchesExactField(ingreso.banco, normalized.banco)
      && matchesUserFilter(ingreso, normalized.usuario);
  });
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

function isActivo(record) {
  return normalizeEstado(record.estado) !== 'anulado';
}

async function create(data, caller) {
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
      field: 'id',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco_id,
    },
  ], getAuthLabel(caller), 'ingreso');

  const targetAgent = await resolveIngresoAgent(caller, data.agente);
  const bancoDetails = await assertBancoOwnershipForAgent(data.banco_id, targetAgent.id);

  const ingreso = {
    id: createPrefixedId('ING'),
    estado: 'activo',
    agente: targetAgent.nombre || data.agente,
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
    monto: data.monto,
    fecha_movimiento: data.fecha_movimiento,
    fecha_registro: nowLima(),
  };

  await repo.append(SHEET_NAME, ingreso, HEADERS);
  await audit.log('create', 'ingreso', getAuthLabel(caller), ingreso);

  return { record: ingreso, warnings };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

function sortIngresosForList(ingresos) {
  return [...ingresos].reverse();
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const ingresos = await getAll();
  const filtered = filterIngresos(ingresos, filters);
  return paginateItems(sortIngresosForList(filtered), limit, offset);
}

async function getPaged(limit, offset, filters = {}) {
  return getPagedAndFiltered(filters, limit, offset);
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

async function update(id, updates, caller) {
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

  const nextAgentReference = Object.prototype.hasOwnProperty.call(updates, 'agente')
    ? updates.agente
    : existing.agente;
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
    ], getAuthLabel(caller), 'ingreso');
  }

  const targetAgent = await resolveIngresoAgent(caller, nextAgentReference, existing.agente);
  const bancoDetails = await assertBancoOwnershipForAgent(nextBancoReference, targetAgent.id);

  let nextRecord = buildUpdatedIngreso(existing, updates);
  nextRecord = {
    ...nextRecord,
    agente: targetAgent.nombre || nextRecord.agente,
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
  };

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'ingreso', getAuthLabel(caller), {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: Object.prototype.hasOwnProperty.call(updates, 'banco_id')
      ? { ...updates, banco: nextRecord.banco }
      : updates,
  });

  return nextRecord;
}

async function cancel(id, motivo, caller) {
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
  await audit.log('delete', 'ingreso', getAuthLabel(caller), {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    motivo,
  });

  return nextRecord;
}

module.exports = {
  create,
  getAll,
  getPaged,
  getPagedAndFiltered,
  getByAgent,
  update,
  cancel,
};
