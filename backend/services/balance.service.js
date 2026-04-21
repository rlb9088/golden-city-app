const ingresosService = require('./ingresos.service');
const pagosService = require('./pagos.service');
const gastosService = require('./gastos.service');
const bancosService = require('./bancos.service');
const { getTable, getAdminBankIds, getAgentBankIds, getSetting } = require('./config.service');
const { todayLima } = require('../config/timezone');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLookup(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeDateOnly(value) {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }

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

function subtractOneDay(dateStr) {
  const normalized = normalizeDateOnly(dateStr);
  if (!normalized) {
    return '';
  }

  const parsed = new Date(`${normalized}T00:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  parsed.setDate(parsed.getDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function parseAmount(value) {
  const amount = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(amount) ? amount : 0;
}

function isActivo(record) {
  return normalizeLookup(record?.estado) !== 'anulado';
}

function getRecordDate(record, fieldName) {
  return normalizeDateOnly(record?.[fieldName]);
}

function matchesOrBeforeDate(recordDate, targetDate) {
  if (!recordDate) {
    return false;
  }

  return recordDate <= targetDate;
}

function groupAmountByKey(records, getKey, getLabel) {
  const grouped = new Map();

  for (const record of records) {
    const key = normalizeLookup(getKey(record));
    if (!key) {
      continue;
    }

    const entry = grouped.get(key) || {
      key,
      label: normalizeText(getLabel(record)) || normalizeText(getKey(record)),
      amount: 0,
    };

    entry.amount += parseAmount(record.monto);
    grouped.set(key, entry);
  }

  return grouped;
}

function sortByLabel(a, b) {
  return String(a.label ?? '').localeCompare(String(b.label ?? ''), 'es', { sensitivity: 'base' })
    || String(a.key ?? '').localeCompare(String(b.key ?? ''), 'es', { sensitivity: 'base' });
}

function sortByCategory(a, b) {
  return String(a.categoria ?? '').localeCompare(String(b.categoria ?? ''), 'es', { sensitivity: 'base' })
    || String(a.subcategoria ?? '').localeCompare(String(b.subcategoria ?? ''), 'es', { sensitivity: 'base' });
}

function findLatestSnapshot(rows, bancoId, targetDate) {
  const targetKey = normalizeLookup(bancoId);
  let latest = null;

  for (const row of rows) {
    if (normalizeLookup(row?.banco_id) !== targetKey) {
      continue;
    }

    const rowDate = getRecordDate(row, 'fecha');
    if (!matchesOrBeforeDate(rowDate, targetDate)) {
      continue;
    }

    const rowIndex = Number(row?._rowIndex ?? 0);
    if (
      !latest
      || rowDate > latest.rowDate
      || (rowDate === latest.rowDate && rowIndex > latest.rowIndex)
    ) {
      latest = {
        row,
        rowDate,
        rowIndex,
      };
    }
  }

  return latest?.row || null;
}

function hasExactSnapshot(rows, bancoId, exactDate) {
  const targetKey = normalizeLookup(bancoId);
  return rows.some((row) => (
    normalizeLookup(row?.banco_id) === targetKey
    && getRecordDate(row, 'fecha') === exactDate
  ));
}

function getBankNameById(bankRows, bancoId, fallbackName = '') {
  const targetKey = normalizeLookup(bancoId);
  const bank = bankRows.find((row) => normalizeLookup(row?.id) === targetKey);
  return normalizeText(bank?.nombre) || normalizeText(fallbackName) || normalizeText(bancoId);
}

function isAllowedBankId(bankId, allowedBankIds) {
  if (!allowedBankIds || allowedBankIds.size === 0) {
    return true;
  }

  return allowedBankIds.has(normalizeLookup(bankId));
}

function aggregateIngresosByBank(rows, targetDate, { exactDate = false, allowedBankIds = null } = {}) {
  return rows.filter((row) => isActivo(row) && getRecordDate(row, 'fecha_movimiento') && (
    isAllowedBankId(row.banco_id, allowedBankIds)
      && (
      exactDate
        ? getRecordDate(row, 'fecha_movimiento') === targetDate
        : getRecordDate(row, 'fecha_movimiento') <= targetDate
      )
  ));
}

function aggregatePagosByBank(rows, targetDate, { exactDate = false, allowedBankIds = null } = {}) {
  return rows.filter((row) => isActivo(row) && getRecordDate(row, 'fecha_comprobante') && (
    isAllowedBankId(row.banco_id, allowedBankIds)
      && (
      exactDate
        ? getRecordDate(row, 'fecha_comprobante') === targetDate
        : getRecordDate(row, 'fecha_comprobante') <= targetDate
      )
  ));
}

function aggregateGastos(rows, targetDate, { exactDate = false } = {}) {
  return rows.filter((row) => isActivo(row) && getRecordDate(row, 'fecha_gasto') && (
    exactDate
      ? getRecordDate(row, 'fecha_gasto') === targetDate
      : getRecordDate(row, 'fecha_gasto') <= targetDate
  ));
}

function buildCajasDetalle(ingresos, pagos) {
  const agentMap = new Map();

  function getAgentEntry(agentLabel) {
    const key = normalizeLookup(agentLabel);
    if (!key) {
      return null;
    }

    if (!agentMap.has(key)) {
      agentMap.set(key, {
        agente: normalizeText(agentLabel),
        bancosMap: new Map(),
      });
    }

    return agentMap.get(key);
  }

  for (const ingreso of ingresos) {
    const agent = getAgentEntry(ingreso.agente);
    if (!agent) {
      continue;
    }

    const bankKey = normalizeLookup(ingreso.banco_id || ingreso.banco);
    if (!bankKey) {
      continue;
    }

    const entry = agent.bancosMap.get(bankKey) || {
      banco_id: normalizeText(ingreso.banco_id),
      banco: normalizeText(ingreso.banco) || normalizeText(ingreso.banco_id),
      saldo: 0,
    };

    entry.saldo += parseAmount(ingreso.monto);
    agent.bancosMap.set(bankKey, entry);
  }

  for (const pago of pagos) {
    const agent = getAgentEntry(pago.agente);
    if (!agent) {
      continue;
    }

    const bankKey = normalizeLookup(pago.banco_id || pago.banco);
    if (!bankKey) {
      continue;
    }

    const entry = agent.bancosMap.get(bankKey) || {
      banco_id: normalizeText(pago.banco_id),
      banco: normalizeText(pago.banco) || normalizeText(pago.banco_id),
      saldo: 0,
    };

    entry.saldo -= parseAmount(pago.monto);
    agent.bancosMap.set(bankKey, entry);
  }

  const detalle = [...agentMap.values()]
    .map((agent) => {
      const bancos = [...agent.bancosMap.values()]
        .sort((a, b) => String(a.banco ?? '').localeCompare(String(b.banco ?? ''), 'es', { sensitivity: 'base' })
          || String(a.banco_id ?? '').localeCompare(String(b.banco_id ?? ''), 'es', { sensitivity: 'base' }));

      const total = bancos.reduce((sum, item) => sum + parseAmount(item.saldo), 0);
      return {
        agente: agent.agente,
        bancos,
        total,
      };
    })
    .sort((a, b) => String(a.agente ?? '').localeCompare(String(b.agente ?? ''), 'es', { sensitivity: 'base' }));

  const total = detalle.reduce((sum, item) => sum + parseAmount(item.total), 0);

  return { total, detalle };
}

function buildGastosDetalle(rows) {
  const grouped = new Map();

  for (const gasto of rows) {
    const categoria = normalizeText(gasto.categoria);
    const subcategoria = normalizeText(gasto.subcategoria);
    if (!categoria) {
      continue;
    }

    const key = `${normalizeLookup(categoria)}::${normalizeLookup(subcategoria)}`;
    const entry = grouped.get(key) || {
      categoria,
      subcategoria,
      monto: 0,
    };

    entry.monto += parseAmount(gasto.monto);
    grouped.set(key, entry);
  }

  const detalle = [...grouped.values()].sort(sortByCategory);
  const total = detalle.reduce((sum, item) => sum + parseAmount(item.monto), 0);

  return { total, detalle };
}

function resolveAgentRecord(agente, agentes = []) {
  const normalizedAgent = normalizeLookup(agente);

  return agentes.find((row) => {
    const id = normalizeLookup(row?.id);
    const nombre = normalizeLookup(row?.nombre);
    const username = normalizeLookup(row?.username);

    return id === normalizedAgent || nombre === normalizedAgent || username === normalizedAgent;
  }) || null;
}

function resolveAgentLookupCandidates(agente, agentes = []) {
  const candidates = new Set();
  const normalizedAgent = normalizeLookup(agente);

  if (normalizedAgent) {
    candidates.add(normalizedAgent);
  }

  const matchedAgent = resolveAgentRecord(agente, agentes);

  if (matchedAgent) {
    const id = normalizeLookup(matchedAgent.id);
    const nombre = normalizeLookup(matchedAgent.nombre);
    const username = normalizeLookup(matchedAgent.username);

    if (id) candidates.add(id);
    if (nombre) candidates.add(nombre);
    if (username) candidates.add(username);
  }

  return candidates;
}

function getAgentOwnedBanks(configBanks, agente, agentes = []) {
  const candidates = resolveAgentLookupCandidates(agente, agentes);

  return configBanks.filter((row) => {
    const ownerId = normalizeLookup(row?.propietario_id);
    const ownerName = normalizeLookup(row?.propietario);
    return candidates.has(ownerId) || candidates.has(ownerName);
  });
}

async function loadBalanceContext() {
  const [ingresos, pagos, gastos, bancos, bancosSnapshots, agentes, adminBankIds, agentBankIds, cajaInicioMesSetting] = await Promise.all([
    ingresosService.getAll(),
    pagosService.getAll(),
    gastosService.getAll(),
    getTable('bancos'),
    bancosService.getAll(),
    getTable('agentes'),
    getAdminBankIds(),
    getAgentBankIds(),
    getSetting('caja_inicio_mes').catch(() => ({ value: 0 })),
  ]);

  return {
    ingresos,
    pagos,
    gastos,
    bancos,
    bancosSnapshots,
    agentes,
    adminBankIds: new Set([...adminBankIds].map((value) => normalizeLookup(value))),
    agentBankIds: new Set([...agentBankIds].map((value) => normalizeLookup(value))),
    todayDate: todayLima(),
    cajaInicioMes: parseAmount(cajaInicioMesSetting?.value),
  };
}

function resolveRequestedDate(fecha, todayDate) {
  const normalized = normalizeDateOnly(fecha);
  return {
    requestedDate: normalized || null,
    targetDate: normalized || todayDate,
    isNowMode: !normalized,
  };
}

async function getBancosAdminAt(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate, requestedDate, isNowMode } = resolveRequestedDate(fecha, ctx.todayDate);
  const adminBankRows = ctx.bancos.filter((row) => ctx.adminBankIds.has(normalizeLookup(row.id)));
  const isExplicitToday = requestedDate === ctx.todayDate && !isNowMode;

  const detalle = adminBankRows
    .map((bank) => {
      const exactSnapshot = findLatestSnapshot(ctx.bancosSnapshots || [], bank.id, targetDate);
      const hasTodaySnapshot = hasExactSnapshot(ctx.bancosSnapshots || [], bank.id, targetDate);
      const snapshot = exactSnapshot;
      const bankName = getBankNameById(adminBankRows, bank.id, bank.nombre);
      let saldo = parseAmount(snapshot?.saldo);

      if (isNowMode && targetDate === ctx.todayDate && !hasTodaySnapshot) {
        const ingresosHoy = ctx.ingresos.filter((row) => isActivo(row)
          && normalizeLookup(row.banco_id) === normalizeLookup(bank.id)
          && getRecordDate(row, 'fecha_movimiento') === targetDate);
        const gastosHoy = ctx.gastos.filter((row) => isActivo(row)
          && normalizeLookup(row.banco_id) === normalizeLookup(bank.id)
          && getRecordDate(row, 'fecha_gasto') === targetDate);

        saldo += ingresosHoy.reduce((sum, row) => sum + parseAmount(row.monto), 0);
        saldo -= gastosHoy.reduce((sum, row) => sum + parseAmount(row.monto), 0);
      }

      if (!snapshot && !isNowMode && !isExplicitToday) {
        saldo = 0;
      }

      return {
        banco_id: bank.id,
        banco: bankName,
        saldo,
      };
    })
    .sort((a, b) => String(a.banco ?? '').localeCompare(String(b.banco ?? ''), 'es', { sensitivity: 'base' })
      || String(a.banco_id ?? '').localeCompare(String(b.banco_id ?? ''), 'es', { sensitivity: 'base' }));

  const total = detalle.reduce((sum, item) => sum + parseAmount(item.saldo), 0);

  return { total, detalle };
}

async function getCajasAgentesAt(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);

  const ingresos = aggregateIngresosByBank(ctx.ingresos, targetDate, { allowedBankIds: ctx.agentBankIds });
  const pagos = aggregatePagosByBank(ctx.pagos, targetDate, { allowedBankIds: ctx.agentBankIds });
  return buildCajasDetalle(ingresos, pagos);
}

async function getAgentCajaAt({ agente, fecha = null } = {}, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate, requestedDate, isNowMode } = resolveRequestedDate(fecha, ctx.todayDate);
  const agentBanks = getAgentOwnedBanks(ctx.bancos, agente, ctx.agentes);
  const allowedBankIds = new Set(agentBanks.map((bank) => normalizeLookup(bank.id)).filter(Boolean));
  const agentRecord = resolveAgentRecord(agente, ctx.agentes);
  const agentLabel = normalizeText(agentRecord?.nombre || agente);

  if (allowedBankIds.size === 0) {
    return {
      fecha: isNowMode ? null : requestedDate,
      agente: agentLabel,
      total: 0,
      movimiento: {
        montoInicial: 0,
        pagosDia: 0,
        saldoTotal: 0,
      },
      bancos: [],
    };
  }

  const ingresosUpToDate = aggregateIngresosByBank(ctx.ingresos, targetDate, { allowedBankIds });
  const pagosUpToDate = aggregatePagosByBank(ctx.pagos, targetDate, { allowedBankIds });
  const cajas = buildCajasDetalle(ingresosUpToDate, pagosUpToDate);
  const agentDetalle = cajas.detalle.find((item) => normalizeLookup(item.agente) === normalizeLookup(agente));
  const previousDate = subtractOneDay(targetDate);
  const previousIngresos = aggregateIngresosByBank(ctx.ingresos, previousDate, { allowedBankIds });
  const previousPagos = aggregatePagosByBank(ctx.pagos, previousDate, { allowedBankIds });
  const montoInicial = buildCajasDetalle(previousIngresos, previousPagos).total;
  const pagosDia = aggregatePagosByBank(ctx.pagos, targetDate, {
    exactDate: true,
    allowedBankIds,
  }).reduce((sum, row) => sum + parseAmount(row.monto), 0);
  const bancos = (agentDetalle?.bancos || []).map((item) => ({
    banco_id: item.banco_id,
    banco: item.banco,
    saldo: parseAmount(item.saldo),
  }));

  return {
    fecha: isNowMode ? null : requestedDate,
    agente: agentLabel,
    total: cajas.total,
    movimiento: {
      montoInicial,
      pagosDia,
      saldoTotal: montoInicial - pagosDia,
    },
    bancos,
  };
}

async function getTotalGastosAt(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  const gastos = aggregateGastos(ctx.gastos, targetDate);
  return buildGastosDetalle(gastos);
}

async function getGastosDelDia(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  const gastos = aggregateGastos(ctx.gastos, targetDate, { exactDate: true });
  return buildGastosDetalle(gastos);
}

function buildSnapshotForDate(targetDate, ctx, { nowMode = false } = {}) {
  const bancosSnapshots = ctx.bancosSnapshots || [];
  const adminBankRows = ctx.bancos.filter((row) => ctx.adminBankIds.has(normalizeLookup(row.id)));
  const ingresosUpToDate = aggregateIngresosByBank(ctx.ingresos, targetDate, {
    exactDate: false,
    allowedBankIds: ctx.agentBankIds,
  });
  const pagosUpToDate = aggregatePagosByBank(ctx.pagos, targetDate, {
    exactDate: false,
    allowedBankIds: ctx.agentBankIds,
  });
  const gastosUpToDate = aggregateGastos(ctx.gastos, targetDate, { exactDate: false });
  const gastosHoy = aggregateGastos(ctx.gastos, targetDate, { exactDate: true });
  const adminIngresosHoy = aggregateIngresosByBank(ctx.ingresos, targetDate, { exactDate: true });
  const adminGastosHoy = aggregateGastos(ctx.gastos, targetDate, { exactDate: true });

  const bancosAdmin = adminBankRows
    .map((bank) => {
      const exactSnapshot = hasExactSnapshot(bancosSnapshots, bank.id, targetDate)
        ? findLatestSnapshot(bancosSnapshots, bank.id, targetDate)
        : findLatestSnapshot(bancosSnapshots, bank.id, targetDate);
      let saldo = parseAmount(exactSnapshot?.saldo);

      if (nowMode && targetDate === ctx.todayDate && !hasExactSnapshot(bancosSnapshots, bank.id, targetDate)) {
        saldo += adminIngresosHoy
          .filter((row) => normalizeLookup(row.banco_id) === normalizeLookup(bank.id))
          .reduce((sum, row) => sum + parseAmount(row.monto), 0);

        saldo -= adminGastosHoy
          .filter((row) => normalizeLookup(row.banco_id) === normalizeLookup(bank.id))
          .reduce((sum, row) => sum + parseAmount(row.monto), 0);
      }

      return {
        banco_id: bank.id,
        banco: getBankNameById(ctx.bancos, bank.id, bank.nombre),
        saldo,
      };
    })
    .sort((a, b) => String(a.banco ?? '').localeCompare(String(b.banco ?? ''), 'es', { sensitivity: 'base' })
      || String(a.banco_id ?? '').localeCompare(String(b.banco_id ?? ''), 'es', { sensitivity: 'base' }));

  const cajasAgentes = buildCajasDetalle(ingresosUpToDate, pagosUpToDate);
  const totalGastos = buildGastosDetalle(gastosUpToDate);
  const gastosDelDia = buildGastosDetalle(gastosHoy);

  const bancosAdminTotal = bancosAdmin.reduce((sum, item) => sum + parseAmount(item.saldo), 0);
  const cajasAgentesTotal = cajasAgentes.total;
  const activosTotales = bancosAdminTotal + cajasAgentesTotal;
  const previousDate = subtractOneDay(targetDate);

  const previousBancosAdmin = adminBankRows
    .map((bank) => {
      const snapshot = findLatestSnapshot(bancosSnapshots, bank.id, previousDate);
      return parseAmount(snapshot?.saldo);
    })
    .reduce((sum, value) => sum + value, 0);

  const previousIngresos = aggregateIngresosByBank(ctx.ingresos, previousDate, {
    exactDate: false,
    allowedBankIds: ctx.agentBankIds,
  });
  const previousPagos = aggregatePagosByBank(ctx.pagos, previousDate, {
    exactDate: false,
    allowedBankIds: ctx.agentBankIds,
  });
  const previousCajas = buildCajasDetalle(previousIngresos, previousPagos).total;
  const previousAssets = previousBancosAdmin + previousCajas;

  const balanceDia = activosTotales - previousAssets - gastosDelDia.total;
  const balanceAcumulado = activosTotales - totalGastos.total - ctx.cajaInicioMes;

  return {
    fecha: nowMode ? null : targetDate,
    bancosAdmin: {
      total: bancosAdminTotal,
      detalle: bancosAdmin,
    },
    cajasAgentes: {
      total: cajasAgentesTotal,
      detalle: cajasAgentes.detalle.map((item) => ({
        agente: item.agente,
        bancos: item.bancos,
      })),
    },
    totalGastos,
    balanceDia,
    balanceAcumulado,
    cajaInicioMes: ctx.cajaInicioMes,
  };
}

async function getBalanceAt({ fecha = null } = {}) {
  const context = await loadBalanceContext();
  const { targetDate, isNowMode } = resolveRequestedDate(fecha, context.todayDate);

  return buildSnapshotForDate(targetDate, context, { nowMode: isNowMode });
}

/**
 * Calcula el balance de un agente especifico.
 * Formula: sum(ingresos) - sum(pagos)
 * Siempre recalcula desde la fuente de verdad.
 */
async function getAgentBalance(agente) {
  const [ingresos, pagos] = await Promise.all([
    ingresosService.getByAgent(agente),
    pagosService.getByAgent(agente),
  ]);

  const totalIngresos = ingresos.filter(isActivo).reduce((sum, i) => sum + parseAmount(i.monto), 0);
  const totalPagos = pagos.filter(isActivo).reduce((sum, p) => sum + parseAmount(p.monto), 0);

  return {
    agente,
    ingresos: totalIngresos,
    pagos: totalPagos,
    balance: totalIngresos - totalPagos,
  };
}

async function getGlobalBalance() {
  return getBalanceAt({ fecha: null });
}

module.exports = {
  getBalanceAt,
  getBancosAdminAt,
  getCajasAgentesAt,
  getTotalGastosAt,
  getGastosDelDia,
  getAgentCajaAt,
  getAgentBalance,
  getGlobalBalance,
};
