const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const r2Service = require('./r2.service');
const authService = require('./auth.service');
const { nowLima } = require('../config/timezone');
const { validateReferences, getConfigBancoById } = require('./config.service');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/appError');
const { paginateItems } = require('../utils/pagination');

const SHEET_NAME = 'pagos';
const HEADERS = [
  'id', 'estado', 'usuario', 'caja', 'banco_id', 'banco', 'monto', 'tipo',
  'comprobante_url', 'comprobante_file_id', 'fecha_comprobante', 'fecha_registro', 'agente'
];

let pagoCounter = 1;

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

function buildLegacyAgent(reference) {
  const id = normalizeId(reference) || 'legacy-agent';
  return {
    id,
    nombre: String(reference ?? '').trim() || id,
    username: id.toLowerCase(),
    role: 'agent',
    activo: true,
  };
}

async function resolvePaymentAgent(caller = {}, requestedAgentId = '') {
  if (typeof caller === 'string') {
    const referenceAgent = await resolveAgentByReference(caller);
    return referenceAgent || buildLegacyAgent(caller);
  }

  const callerUserId = normalizeId(caller?.userId);
  const callerRole = normalizeText(caller?.role);

  if (!callerUserId) {
    throw new ForbiddenError('No se pudo resolver el usuario autenticado.', {
      context: { component: 'pagos.owner-check' },
    });
  }

  if (callerRole === 'agent') {
    const agent = await authService.getAuthUserById(callerUserId);
    if (!agent) {
      throw new ForbiddenError('No se pudo resolver el agente autenticado.', {
        context: { userId: callerUserId },
      });
    }
    return agent;
  }

  const targetId = normalizeId(requestedAgentId) || callerUserId;
  const agent = await authService.getAuthUserById(targetId);

  if (!agent) {
    throw new BadRequestError('El agente seleccionado no existe.', {
      context: {
        agentId: targetId,
      },
    });
  }

  if (agent.activo === false) {
    throw new ForbiddenError('El agente seleccionado esta inactivo.', {
      context: {
        agentId: targetId,
      },
    });
  }

  return agent;
}

async function assertBancoOwnership(bancoId, ownerAgentId, { allowMissingOwner = false } = {}) {
  const bancoDetails = await resolveBancoDetails(bancoId);
  const bancoOwnerId = normalizeId(bancoDetails.propietario_id);
  const requestedOwnerId = normalizeId(ownerAgentId);

  if (!bancoOwnerId && allowMissingOwner) {
    return bancoDetails;
  }

  if (!bancoOwnerId || bancoOwnerId !== requestedOwnerId) {
    throw new ForbiddenError('El banco no pertenece al agente objetivo del pago.', {
      context: {
        banco_id: bancoDetails.banco_id,
        banco_owner_id: bancoOwnerId,
        owner_agent_id: requestedOwnerId,
      },
    });
  }

  return bancoDetails;
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

function buildReceiptAuditContext(baseRecord, receiptWarning = null) {
  const context = {
    comprobante_url: baseRecord.comprobante_url,
    comprobante_file_id: baseRecord.comprobante_file_id,
  };

  if (receiptWarning) {
    context.receipt_warning = receiptWarning;
  }

  return context;
}

function parseReceiptBase64(base64Image) {
  const rawImage = String(base64Image ?? '').trim();
  if (!rawImage) {
    return null;
  }

  const match = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    if (!/^[a-z0-9+/=\s]+$/i.test(match[2])) {
      return null;
    }

    return {
      mimeType: match[1],
      base64: match[2],
    };
  }

  if (!/^[a-z0-9+/=\s]+$/i.test(rawImage)) {
    return null;
  }

  return {
    mimeType: 'image/jpeg',
    base64: rawImage,
  };
}

function buildReceiptFilename(meta = {}, mimeType = 'image/jpeg') {
  const pagoId = String(meta.pagoId ?? 'pago').trim() || 'pago';
  const fecha = String(meta.fecha ?? '').trim().replace(/[:\s]/g, '-');
  const safeDate = fecha || new Date().toISOString().slice(0, 10);
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  };
  const extension = mimeToExt[mimeType] || 'jpg';
  return `comprobante-${pagoId}-${safeDate}.${extension}`;
}

function getReceiptUploadWarning(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not configured')) {
    return 'No se pudo guardar el comprobante en R2 porque la configuracion no esta disponible. El pago se registro sin enlace persistente.';
  }

  return 'No se pudo guardar el comprobante en R2. El pago se registro sin enlace persistente.';
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

async function create(data, caller) {
  const warnings = await validateReferences([
    {
      tableName: 'bancos',
      field: 'id',
      label: 'banco',
      tableLabel: 'config_bancos',
      value: data.banco_id,
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
  ], getAuthLabel(caller), 'pago');

  const targetAgent = await resolvePaymentAgent(caller, data.agente_id);
  const bancoDetails = await assertBancoOwnership(data.banco_id, targetAgent.id, {
    allowMissingOwner: typeof caller === 'string',
  });

  const pagoId = `PAG-${Date.now()}-${pagoCounter++}`;
  const basePago = {
    id: pagoId,
    estado: 'activo',
    usuario: data.usuario,
    caja: data.caja,
    banco_id: bancoDetails.banco_id,
    banco: bancoDetails.banco,
    monto: data.monto,
    tipo: data.tipo,
    comprobante_url: data.comprobante_url || '',
    comprobante_file_id: data.comprobante_file_id || '',
    fecha_comprobante: data.fecha_comprobante || '',
    fecha_registro: nowLima(),
    agente: targetAgent.nombre || targetAgent.username || targetAgent.id,
  };

  let receiptWarning = null;

  if (data.comprobante_base64) {
    const receiptImage = parseReceiptBase64(data.comprobante_base64);

    if (!receiptImage) {
      receiptWarning = 'No se pudo interpretar el comprobante recibido. El pago se registro sin enlace persistente.';
    } else {
      const fileName = buildReceiptFilename({
        pagoId,
        fecha: data.fecha_comprobante || basePago.fecha_registro,
      }, receiptImage.mimeType);

      try {
        const uploadedReceipt = await r2Service.uploadReceipt(
          Buffer.from(receiptImage.base64, 'base64'),
          fileName,
          receiptImage.mimeType,
        );

        if (uploadedReceipt?.url && uploadedReceipt?.key) {
          basePago.comprobante_url = uploadedReceipt.url;
          basePago.comprobante_file_id = uploadedReceipt.key;
        } else {
          receiptWarning = 'No se pudo guardar el comprobante en R2. El pago se registro sin enlace persistente.';
          basePago.comprobante_url = '';
          basePago.comprobante_file_id = '';
        }
      } catch (error) {
        receiptWarning = getReceiptUploadWarning(error);
        basePago.comprobante_url = '';
        basePago.comprobante_file_id = '';
      }
    }
  }

  const pago = basePago;

  await repo.append(SHEET_NAME, pago, HEADERS);
  await audit.log('create', 'pago', getAuthLabel(caller), {
    ...pago,
    ...buildReceiptAuditContext(pago, receiptWarning),
    ...(receiptWarning ? { receipt_warning: receiptWarning } : {}),
  });

  return { record: pago, warnings: receiptWarning ? [...warnings, receiptWarning] : warnings };
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

async function update(id, updates, caller) {
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

  const existingAgent = await resolveAgentByReference(existing.agente) || buildLegacyAgent(existing.agente);
  if (!existingAgent) {
    throw new ForbiddenError('No se pudo resolver el agente propietario del pago.', {
      context: {
        pago_id: id,
        agente: existing.agente,
      },
    });
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'banco_id')) {
    await validateReferences([
      {
        tableName: 'bancos',
        field: 'id',
        label: 'banco',
        tableLabel: 'config_bancos',
        value: updates.banco_id,
      },
    ], getAuthLabel(caller), 'pago');
  }

  let nextRecord = buildUpdatedPago(existing, updates);
  if (Object.prototype.hasOwnProperty.call(updates, 'banco_id')) {
    const bancoDetails = await assertBancoOwnership(updates.banco_id, existingAgent.id, {
      allowMissingOwner: typeof caller === 'string',
    });
    nextRecord = {
      ...nextRecord,
      ...bancoDetails,
    };
  }

  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  await audit.log('update', 'pago', getAuthLabel(caller), {
    before: stripInternalFields(existing),
    after: stripInternalFields(nextRecord),
    changes: Object.prototype.hasOwnProperty.call(updates, 'banco_id')
      ? { ...updates, banco: nextRecord.banco }
      : updates,
  });

  return nextRecord;
}

async function cancel(id, motivo, caller) {
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
  await audit.log('delete', 'pago', getAuthLabel(caller), {
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
