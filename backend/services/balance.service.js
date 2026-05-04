const ingresosService = require('./ingresos.service');
const pagosService = require('./pagos.service');
const gastosService = require('./gastos.service');
const bancosService = require('./bancos.service');
const depositosTotalesService = require('./depositos-totales.service');
const retirosTotalesService = require('./retiros-totales.service');
const bonosTotalesService = require('./bonos-totales.service');
const retirosNoPagadosService = require('./retiros-no-pagados.service');
const { getTable, getAdminBankIds, getAgentBankIds, getSetting, getCajaInicioMesByBanco } = require('./config.service');
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

const previousDay = subtractOneDay;

function nextDay(dateStr) {
  const normalized = normalizeDateOnly(dateStr);
  if (!normalized) {
    return '';
  }

  const parsed = new Date(`${normalized}T00:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function parseAmount(value) {
  const amount = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(amount) ? amount : 0;
}

function getContextCache(context) {
  if (!context || typeof context !== 'object') {
    return null;
  }

  if (!context.__balanceCache) {
    Object.defineProperty(context, '__balanceCache', {
      value: new Map(),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  return context.__balanceCache;
}

async function memoizeContext(context, key, factory) {
  const cache = getContextCache(context);
  if (!cache) {
    return factory();
  }

  if (cache.has(key)) {
    return cache.get(key);
  }

  const promise = Promise.resolve()
    .then(factory)
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, promise);
  return promise;
}

async function getCachedSheetRows(context, key, loader) {
  const ctx = context || await loadBalanceContext();
  return memoizeContext(ctx, `sheet_rows:${key}`, loader);
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

function findLatestSnapshot(rows, targetValue, targetDate, fieldName = 'banco_id') {
  const targetKey = normalizeLookup(targetValue);
  let latest = null;

  for (const row of rows) {
    if (normalizeLookup(row?.[fieldName]) !== targetKey) {
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

function hasExactSnapshot(rows, targetValue, exactDate, fieldName = 'banco_id') {
  const targetKey = normalizeLookup(targetValue);
  return rows.some((row) => (
    normalizeLookup(row?.[fieldName]) === targetKey
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

function buildLatestTotalsByCaja(rows, targetDate, { exactDate = false } = {}) {
  const latestByCaja = new Map();

  for (const row of rows) {
    if (!isActivo(row)) {
      continue;
    }

    const rowDate = getRecordDate(row, 'fecha');
    if (!rowDate) {
      continue;
    }

    if (exactDate ? rowDate !== targetDate : rowDate > targetDate) {
      continue;
    }

    const cajaId = normalizeLookup(row.caja_id);
    if (!cajaId) {
      continue;
    }

    const current = latestByCaja.get(cajaId);
    const rowIndex = Number(row?._rowIndex ?? 0);

    if (
      !current
      || rowDate > current.rowDate
      || (rowDate === current.rowDate && rowIndex > current.rowIndex)
    ) {
      latestByCaja.set(cajaId, {
        row,
        rowDate,
        rowIndex,
      });
    }
  }

  const detalle = [...latestByCaja.values()]
    .map(({ row }) => ({
      caja_id: normalizeText(row.caja_id),
      caja: normalizeText(row.caja) || normalizeText(row.caja_id),
      monto: parseAmount(row.monto),
    }))
    .sort((a, b) => String(a.caja ?? '').localeCompare(String(b.caja ?? ''), 'es', { sensitivity: 'base' })
      || String(a.caja_id ?? '').localeCompare(String(b.caja_id ?? ''), 'es', { sensitivity: 'base' }));

  const total = detalle.reduce((sum, item) => sum + parseAmount(item.monto), 0);

  return { total, detalle };
}

function buildRawCajaTotals(details = []) {
  const totals = new Map();

  for (const detail of details || []) {
    const cajaId = normalizeLookup(detail?.caja_id);
    if (!cajaId) {
      continue;
    }

    const current = totals.get(cajaId) || {
      caja_id: normalizeText(detail.caja_id),
      caja: normalizeText(detail.caja) || normalizeText(detail.caja_id),
      monto: 0,
    };

    current.monto += parseAmount(detail.monto);
    if (!current.caja) {
      current.caja = normalizeText(detail.caja) || normalizeText(detail.caja_id);
    }

    totals.set(cajaId, current);
  }

  return totals;
}

function buildBalancePorCaja({
  depositos = [],
  retiros = [],
  bonos = [],
  retirosNoPagados = [],
  cajasConfig = [],
} = {}) {
  const depositosByCaja = buildRawCajaTotals(depositos);
  const retirosByCaja = buildRawCajaTotals(retiros);
  const bonosByCaja = buildRawCajaTotals(bonos);
  const retirosNoPagadosByCaja = buildRawCajaTotals(retirosNoPagados);
  const configByCaja = new Map();
  const configuredCajas = [];

  for (const caja of cajasConfig || []) {
    const cajaId = normalizeLookup(caja?.id ?? caja?.caja_id);
    if (!cajaId || configByCaja.has(cajaId)) {
      continue;
    }

    const configEntry = {
      caja_id: normalizeText(caja.id) || normalizeText(caja.caja_id),
      caja: normalizeText(caja.nombre) || normalizeText(caja.caja) || normalizeText(caja.id) || normalizeText(caja.caja_id),
    };

    configByCaja.set(cajaId, configEntry);
    configuredCajas.push(configEntry);
  }

  const allCajaIds = new Set([
    ...depositosByCaja.keys(),
    ...retirosByCaja.keys(),
    ...bonosByCaja.keys(),
    ...retirosNoPagadosByCaja.keys(),
  ]);

  const orphanCajas = [...allCajaIds]
    .filter((cajaId) => !configByCaja.has(cajaId))
    .map((cajaId) => {
      const source = depositosByCaja.get(cajaId)
        || retirosByCaja.get(cajaId)
        || bonosByCaja.get(cajaId)
        || retirosNoPagadosByCaja.get(cajaId);

      return {
        caja_id: normalizeText(source?.caja_id) || normalizeText(cajaId),
        caja: normalizeText(source?.caja) || normalizeText(source?.caja_id) || normalizeText(cajaId),
        _orphan: true,
      };
    })
    .sort((a, b) => String(a.caja ?? '').localeCompare(String(b.caja ?? ''), 'es', { sensitivity: 'base' })
      || String(a.caja_id ?? '').localeCompare(String(b.caja_id ?? ''), 'es', { sensitivity: 'base' }));

  return [...configuredCajas, ...orphanCajas].map((caja) => {
    const cajaKey = normalizeLookup(caja.caja_id);
    const deposito = parseAmount(depositosByCaja.get(cajaKey)?.monto);
    const retiro = parseAmount(retirosByCaja.get(cajaKey)?.monto);
    const bono = parseAmount(bonosByCaja.get(cajaKey)?.monto);
    const retiroNoPagado = parseAmount(retirosNoPagadosByCaja.get(cajaKey)?.monto);
    const depositoReal = deposito - bono;
    const retiroReal = retiro - retiroNoPagado;

    return {
      caja_id: caja.caja_id,
      caja: caja.caja,
      depositoReal,
      retiroReal,
      balance: depositoReal - retiroReal,
      ...(caja._orphan ? { _orphan: true } : {}),
    };
  });
}

async function getDepositosTotalesAt(fecha, { exactDate = false, context = null } = {}) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `depositos_totales:${targetDate}:${exactDate}`, async () => {
    const rows = await getCachedSheetRows(ctx, 'depositos_totales', () => depositosTotalesService.getAll());
    return buildLatestTotalsByCaja(rows, targetDate, { exactDate });
  });
}

async function getRetirosTotalesAt(fecha, { exactDate = false, context = null } = {}) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `retiros_totales:${targetDate}:${exactDate}`, async () => {
    const rows = await getCachedSheetRows(ctx, 'retiros_totales', () => retirosTotalesService.getAll());
    return buildLatestTotalsByCaja(rows, targetDate, { exactDate });
  });
}

async function getBonosTotalesAt(fecha, { exactDate = false, context = null } = {}) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `bonos_totales:${targetDate}:${exactDate}`, async () => {
    const rows = await getCachedSheetRows(ctx, 'bonos_totales', () => bonosTotalesService.getAll());
    return buildLatestTotalsByCaja(rows, targetDate, { exactDate });
  });
}

async function getRetirosNoPagadosAt(fecha, { exactDate = false, context = null } = {}) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `retiros_no_pagados:${targetDate}:${exactDate}`, async () => {
    const rows = await getCachedSheetRows(ctx, 'retiros_no_pagados', () => retirosNoPagadosService.getAll());
    return buildLatestTotalsByCaja(rows, targetDate, { exactDate });
  });
}

async function getFirstDataDate(context = null) {
  const ctx = context || await loadBalanceContext();
  return memoizeContext(ctx, 'first_data_date', async () => {
    const [depositos, retiros, bonos, retirosNoPagados] = await Promise.all([
      getCachedSheetRows(ctx, 'depositos_totales', () => depositosTotalesService.getAll()),
      getCachedSheetRows(ctx, 'retiros_totales', () => retirosTotalesService.getAll()),
      getCachedSheetRows(ctx, 'bonos_totales', () => bonosTotalesService.getAll()),
      getCachedSheetRows(ctx, 'retiros_no_pagados', () => retirosNoPagadosService.getAll()),
    ]);

    const dates = [];
    const pushDate = (value) => {
      const normalized = normalizeDateOnly(value);
      if (normalized) {
        dates.push(normalized);
      }
    };

    for (const row of ctx.ingresos || []) pushDate(row?.fecha_movimiento);
    for (const row of ctx.pagos || []) pushDate(row?.fecha_comprobante);
    for (const row of ctx.gastos || []) pushDate(row?.fecha_gasto);
    for (const row of ctx.bancosSnapshots || []) pushDate(row?.fecha);
    for (const row of depositos) pushDate(row?.fecha);
    for (const row of retiros) pushDate(row?.fecha);
    for (const row of bonos) pushDate(row?.fecha);
    for (const row of retirosNoPagados) pushDate(row?.fecha);

    if (dates.length === 0) {
      return null;
    }

    dates.sort();
    return dates[0];
  });
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

function sumBankMovements(rows, bankId, targetDate, { exactDate = false, dateField = 'fecha_movimiento' } = {}) {
  const bankKey = normalizeLookup(bankId);

  return rows
    .filter((row) => isActivo(row)
      && normalizeLookup(row.banco_id) === bankKey
      && getRecordDate(row, dateField)
      && (
        exactDate
          ? getRecordDate(row, dateField) === targetDate
          : getRecordDate(row, dateField) <= targetDate
      ))
    .reduce((sum, row) => sum + parseAmount(row.monto), 0);
}

function getEffectiveInitialAmount(setting, targetDate) {
  if (!setting?.fecha_efectiva) {
    return 0;
  }

  return setting.fecha_efectiva <= targetDate ? parseAmount(setting.value) : 0;
}

async function loadBalanceContext() {
  const [
    ingresos,
    pagos,
    gastos,
    bancos,
    bancosSnapshots,
    agentes,
    adminBankIds,
    agentBankIds,
    cajaInicioMesSetting,
    cajasConfig,
  ] = await Promise.all([
    ingresosService.getAll(),
    pagosService.getAll(),
    gastosService.getAll(),
    getTable('bancos'),
    bancosService.getAll(),
    getTable('agentes'),
    getAdminBankIds(),
    getAgentBankIds(),
    getSetting('caja_inicio_mes').catch(() => ({ value: 0 })),
    getTable('cajas'),
  ]);

  return {
    ingresos,
    pagos,
    gastos,
    bancos,
    bancosSnapshots,
    agentes,
    cajasConfig,
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
  return memoizeContext(ctx, `bancos_admin:${targetDate}:${isNowMode}`, async () => {
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
  });
}

async function getCajasAgentesAt(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `cajas_agentes:${targetDate}`, async () => {
    const ingresos = aggregateIngresosByBank(ctx.ingresos, targetDate, { allowedBankIds: ctx.agentBankIds });
    const pagos = aggregatePagosByBank(ctx.pagos, targetDate, { allowedBankIds: ctx.agentBankIds });
    return buildCajasDetalle(ingresos, pagos);
  });
}

async function getAgentCajaAt({ agente, fecha = null } = {}, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate, requestedDate, isNowMode } = resolveRequestedDate(fecha, ctx.todayDate);
  const agentBanks = getAgentOwnedBanks(ctx.bancos, agente, ctx.agentes);
  const agentRecord = resolveAgentRecord(agente, ctx.agentes);
  const agentLabel = normalizeText(agentRecord?.nombre || agente);

  if (agentBanks.length === 0) {
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

  const bankSettings = await Promise.all(agentBanks.map(async (bank) => ({
    bank,
    setting: await getCajaInicioMesByBanco(bank.id),
  })));
  const previousDate = subtractOneDay(targetDate);
  const bancos = bankSettings
    .map(({ bank, setting }) => {
      const initialAmount = getEffectiveInitialAmount(setting, targetDate);
      const saldoMovimientos = sumBankMovements(ctx.ingresos, bank.id, targetDate, {
        dateField: 'fecha_movimiento',
      }) - sumBankMovements(ctx.pagos, bank.id, targetDate, {
        dateField: 'fecha_comprobante',
      });
      const saldoInicial = sumBankMovements(ctx.ingresos, bank.id, previousDate, {
        dateField: 'fecha_movimiento',
      }) - sumBankMovements(ctx.pagos, bank.id, previousDate, {
        dateField: 'fecha_comprobante',
      }) + initialAmount;

      return {
        banco_id: bank.id,
        banco: normalizeText(bank.nombre) || normalizeText(bank.id),
        saldo: saldoMovimientos + initialAmount,
        saldoInicial,
      };
    })
    .sort((a, b) => String(a.banco ?? '').localeCompare(String(b.banco ?? ''), 'es', { sensitivity: 'base' })
      || String(a.banco_id ?? '').localeCompare(String(b.banco_id ?? ''), 'es', { sensitivity: 'base' }));

  const montoInicial = bancos.reduce((sum, bank) => sum + parseAmount(bank.saldoInicial), 0);
  const pagosDia = bankSettings.reduce((sum, { bank }) => (
    sum + sumBankMovements(ctx.pagos, bank.id, targetDate, {
      exactDate: true,
      dateField: 'fecha_comprobante',
    })
  ), 0);
  const total = bancos.reduce((sum, bank) => sum + parseAmount(bank.saldo), 0);

  return {
    fecha: isNowMode ? null : requestedDate,
    agente: agentLabel,
    total,
    movimiento: {
      montoInicial,
      pagosDia,
      saldoTotal: montoInicial - pagosDia,
    },
    bancos: bancos.map((bank) => ({
      banco_id: bank.banco_id,
      banco: bank.banco,
      saldo: parseAmount(bank.saldo),
    })),
  };
}

async function getTotalGastosAt(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `gastos_acum:${targetDate}`, async () => {
    const gastos = aggregateGastos(ctx.gastos, targetDate);
    return buildGastosDetalle(gastos);
  });
}

async function getGastosDelDia(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  return memoizeContext(ctx, `gastos_dia:${targetDate}`, async () => {
    const gastos = aggregateGastos(ctx.gastos, targetDate, { exactDate: true });
    return buildGastosDetalle(gastos);
  });
}

async function getVariacionCajaDia(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  const fechaPrev = previousDay(targetDate);

  const [bancosF, bancosPrev, cajasF, cajasPrev, depositosF, retirosF, bonosF, rnpF, gastosF] = await Promise.all([
    getBancosAdminAt(targetDate, ctx),
    fechaPrev ? getBancosAdminAt(fechaPrev, ctx) : Promise.resolve({ total: 0, detalle: [] }),
    getCajasAgentesAt(targetDate, ctx),
    fechaPrev ? getCajasAgentesAt(fechaPrev, ctx) : Promise.resolve({ total: 0, detalle: [] }),
    getDepositosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getRetirosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getBonosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getRetirosNoPagadosAt(targetDate, { exactDate: true, context: ctx }),
    getGastosDelDia(targetDate, ctx),
  ]);

  const depositosRealesDia = depositosF.total - bonosF.total;
  const retirosRealesDia = retirosF.total - rnpF.total;

  return (
    (bancosF.total - bancosPrev.total)
    + (cajasF.total - cajasPrev.total)
    - ((depositosRealesDia - retirosRealesDia) - gastosF.total)
  );
}

async function getVariacionCajaAcumulada(fecha, context = null) {
  const ctx = context || await loadBalanceContext();
  const { targetDate } = resolveRequestedDate(fecha, ctx.todayDate);
  const fechaInicio = await getFirstDataDate(ctx);

  if (!fechaInicio || targetDate < fechaInicio) {
    return 0;
  }

  let total = 0;
  for (let currentDate = fechaInicio; currentDate && currentDate <= targetDate; currentDate = nextDay(currentDate)) {
    total += await getVariacionCajaDia(currentDate, ctx);
  }

  return total;
}

async function buildSnapshotForDate(targetDate, ctx, { nowMode = false } = {}) {
  const [
    bancosAdmin,
    cajasAgentes,
    totalGastos,
    depositosDia,
    retirosDia,
    bonosDia,
    retirosNoPagadosDia,
    depositosAcum,
    retirosAcum,
    bonosAcum,
    retirosNoPagadosAcum,
    variacionCajaDia,
    variacionCajaAcumulada,
  ] = await Promise.all([
    getBancosAdminAt(nowMode ? null : targetDate, ctx),
    getCajasAgentesAt(targetDate, ctx),
    getTotalGastosAt(targetDate, ctx),
    getDepositosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getRetirosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getBonosTotalesAt(targetDate, { exactDate: true, context: ctx }),
    getRetirosNoPagadosAt(targetDate, { exactDate: true, context: ctx }),
    getDepositosTotalesAt(targetDate, { exactDate: false, context: ctx }),
    getRetirosTotalesAt(targetDate, { exactDate: false, context: ctx }),
    getBonosTotalesAt(targetDate, { exactDate: false, context: ctx }),
    getRetirosNoPagadosAt(targetDate, { exactDate: false, context: ctx }),
    getVariacionCajaDia(targetDate, ctx),
    getVariacionCajaAcumulada(targetDate, ctx),
  ]);

  const depositosRealesDia = depositosDia.total - bonosDia.total;
  const retirosRealesDia = retirosDia.total - retirosNoPagadosDia.total;
  const balanceIngresosDia = depositosRealesDia - retirosRealesDia;

  const depositosRealesAcumulado = depositosAcum.total - bonosAcum.total;
  const retirosRealesAcumulado = retirosAcum.total - retirosNoPagadosAcum.total;
  const balanceIngresosAcumulado = depositosRealesAcumulado - retirosRealesAcumulado;
  const balanceIngresosDiaPorCaja = buildBalancePorCaja({
    depositos: depositosDia.detalle,
    retiros: retirosDia.detalle,
    bonos: bonosDia.detalle,
    retirosNoPagados: retirosNoPagadosDia.detalle,
    cajasConfig: ctx.cajasConfig || [],
  });
  const balanceIngresosAcumuladoPorCaja = buildBalancePorCaja({
    depositos: depositosAcum.detalle,
    retiros: retirosAcum.detalle,
    bonos: bonosAcum.detalle,
    retirosNoPagados: retirosNoPagadosAcum.detalle,
    cajasConfig: ctx.cajasConfig || [],
  });

  const bancosAdminTotal = bancosAdmin.total;
  const cajasAgentesTotal = cajasAgentes.total;
  const cajaDisponible = bancosAdminTotal + cajasAgentesTotal - ctx.cajaInicioMes;
  const balanceAcumulado = bancosAdminTotal + cajasAgentesTotal + totalGastos.total - ctx.cajaInicioMes;

  const snapshot = {
    fecha: nowMode ? null : targetDate,
    bancosAdmin,
    cajasAgentes: {
      total: cajasAgentesTotal,
      detalle: cajasAgentes.detalle.map((item) => ({
        agente: item.agente,
        bancos: item.bancos,
      })),
    },
    totalGastos,
    depositosDia,
    retirosDia,
    bonosDia,
    retirosNoPagadosDia,
    depositosAcum,
    retirosAcum,
    bonosAcum,
    retirosNoPagadosAcum,
    depositosRealesDia,
    retirosRealesDia,
    balanceIngresosDia,
    depositosRealesAcumulado,
    retirosRealesAcumulado,
    balanceIngresosAcumulado,
    variacionCajaDia,
    variacionCajaAcumulada,
    cajaDisponible,
    balanceAcumulado,
    cajaInicioMes: ctx.cajaInicioMes,
  };

  const nonEnumerableFields = {
    depositosDia,
    retirosDia,
    bonosDia,
    retirosNoPagadosDia,
    depositosAcum,
    retirosAcum,
    bonosAcum,
    retirosNoPagadosAcum,
    depositosRealesDia,
    retirosRealesDia,
    balanceIngresosDia,
    depositosRealesAcumulado,
    retirosRealesAcumulado,
    balanceIngresosAcumulado,
    balanceIngresosDiaPorCaja,
    balanceIngresosAcumuladoPorCaja,
    variacionCajaDia,
    variacionCajaAcumulada,
  };

  Object.entries(nonEnumerableFields).forEach(([key, value]) => {
    Object.defineProperty(snapshot, key, {
      value,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  });

  Object.defineProperty(snapshot, 'toJSON', {
    enumerable: false,
    configurable: true,
    writable: false,
    value: function toJSON() {
      return {
        ...snapshot,
        ...nonEnumerableFields,
      };
    },
  });

  return snapshot;
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
  getDepositosTotalesAt,
  getRetirosTotalesAt,
  getBonosTotalesAt,
  getRetirosNoPagadosAt,
  getVariacionCajaDia,
  getVariacionCajaAcumulada,
  getTotalGastosAt,
  getGastosDelDia,
  getAgentCajaAt,
  getAgentBalance,
  getGlobalBalance,
  getFirstDataDate,
};
