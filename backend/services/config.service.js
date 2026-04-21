const bcrypt = require('bcrypt');
const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const authService = require('./auth.service');
const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
const { nowLima, todayLima } = require('../config/timezone');
const { BadRequestError, NotFoundError } = require('../utils/appError');
const logger = require('../lib/logger');
const { createPrefixedId } = require('../utils/id');

/**
 * Servicio de configuracion - CRUD sobre tablas de config.
 * Cada tabla tiene su propia hoja en Google Sheets (o store in-memory).
 */

const TABLES = {
  agentes: { sheet: 'config_agentes', headers: ['id', 'nombre', 'username', 'password_hash', 'role', 'activo'] },
  categorias: { sheet: 'config_categorias', headers: ['id', 'categoria', 'subcategoria'] },
  bancos: { sheet: 'config_bancos', headers: ['id', 'nombre', 'propietario', 'propietario_id'] },
  cajas: { sheet: 'config_cajas', headers: ['id', 'nombre'] },
  usuarios: { sheet: 'config_usuarios', headers: ['id', 'nombre'] },
  tipos_pago: { sheet: 'config_tipos_pago', headers: ['id', 'nombre'] },
};

const SETTINGS_SHEET = 'config_settings';
const SETTINGS_HEADERS = ['key', 'value', 'fecha_efectiva', 'actualizado_por', 'actualizado_en'];
const SETTINGS_SEED_KEY = 'caja_inicio_mes';
const SETTINGS_KEY_REGEX = /^caja_inicio_mes(?::banco:[a-z0-9_-]+)?$/i;
const BANK_CLASSIFICATION_TTL_MS = 30_000;

// Default seed data (used when tables are empty)
const SEED_DATA = {
  agentes: [
    { id: 'AG-1', nombre: 'Agente 1', username: 'agente1', password_hash: '', role: 'agent', activo: true },
    { id: 'AG-2', nombre: 'Agente 2', username: 'agente2', password_hash: '', role: 'agent', activo: true },
    { id: 'AG-3', nombre: 'Agente 3', username: 'agente3', password_hash: '', role: 'agent', activo: true },
  ],
  categorias: [
    { id: 'CAT-1', categoria: 'Operativo', subcategoria: 'Material oficina' },
    { id: 'CAT-2', categoria: 'Operativo', subcategoria: 'Limpieza' },
    { id: 'CAT-3', categoria: 'Operativo', subcategoria: 'Mantenimiento' },
    { id: 'CAT-4', categoria: 'Personal', subcategoria: 'Nóminas' },
    { id: 'CAT-5', categoria: 'Personal', subcategoria: 'Bonus' },
    { id: 'CAT-6', categoria: 'Servicios', subcategoria: 'Luz' },
    { id: 'CAT-7', categoria: 'Servicios', subcategoria: 'Agua' },
    { id: 'CAT-8', categoria: 'Servicios', subcategoria: 'Internet' },
    { id: 'CAT-9', categoria: 'Otros', subcategoria: 'Varios' },
  ],
  bancos: [
    { id: 'BK-1', nombre: 'BCP', propietario_id: 'AG-1' },
    { id: 'BK-2', nombre: 'Interbank', propietario_id: 'AG-1' },
    { id: 'BK-3', nombre: 'BBVA', propietario_id: 'AG-2' },
    { id: 'BK-4', nombre: 'Scotiabank', propietario_id: 'AG-2' },
    { id: 'BK-5', nombre: 'Yape', propietario_id: 'AG-3' },
  ],
  cajas: [
    { id: 'CJ-1', nombre: 'Caja 1' },
    { id: 'CJ-2', nombre: 'Caja 2' },
    { id: 'CJ-3', nombre: 'Caja 3' },
  ],
  usuarios: [],
  tipos_pago: [
    { id: 'TIP-1', nombre: 'Transferencia' },
    { id: 'TIP-2', nombre: 'Efectivo' },
    { id: 'TIP-3', nombre: 'Yape' },
    { id: 'TIP-4', nombre: 'Plin' },
    { id: 'TIP-5', nombre: 'Tarjeta' },
  ],
};

function normalizeLookup(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeBankId(value) {
  return normalizeText(value);
}

function normalizeSettingKey(value) {
  return normalizeLookup(value);
}

function assertValidSettingKey(key) {
  const normalizedKey = normalizeSettingKey(key);
  if (!normalizedKey || !SETTINGS_KEY_REGEX.test(normalizedKey)) {
    throw new BadRequestError('La clave de configuracion no tiene un formato valido.', {
      context: { tableName: SETTINGS_SHEET, key: normalizedKey },
    });
  }

  return normalizedKey;
}

function normalizeSettingValue(value) {
  return normalizeText(value);
}

function parseSettingValue(value) {
  const normalized = normalizeSettingValue(value);
  if (!normalized) {
    return '';
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  return normalized;
}

function getFirstDayOfCurrentMonthLima() {
  const today = todayLima();
  return `${today.slice(0, 7)}-01`;
}

function buildSettingsSeedRecord() {
  return {
    key: SETTINGS_SEED_KEY,
    value: '0',
    fecha_efectiva: getFirstDayOfCurrentMonthLima(),
    actualizado_por: 'system',
    actualizado_en: nowLima(),
  };
}

function normalizeSettingRecord(record) {
  const { _rowIndex, ...rest } = record || {};
  return {
    ...rest,
    key: normalizeSettingKey(rest.key),
    value: normalizeSettingValue(rest.value),
    fecha_efectiva: normalizeText(rest.fecha_efectiva),
    actualizado_por: normalizeText(rest.actualizado_por),
    actualizado_en: normalizeText(rest.actualizado_en),
  };
}

function formatSettingForRead(record) {
  const normalized = normalizeSettingRecord(record);
  return {
    key: normalized.key,
    value: parseSettingValue(normalized.value),
    fecha_efectiva: normalized.fecha_efectiva || null,
  };
}

async function ensureSettingsSheetExists() {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSheetId();

  if (!sheets || !spreadsheetId) {
    return false;
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });

  const existingSheet = (metadata.data.sheets || []).find((sheet) => sheet.properties?.title === SETTINGS_SHEET);
  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SETTINGS_SHEET,
              },
            },
          },
        ],
      },
    });
  }

  const headersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SETTINGS_SHEET}!1:1`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const actualHeaders = headersResponse.data.values?.[0] || [];
  const shouldWriteHeaders =
    actualHeaders.length !== SETTINGS_HEADERS.length
    || !actualHeaders.every((header, index) => header === SETTINGS_HEADERS[index]);

  if (shouldWriteHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SETTINGS_SHEET}!A1:${String.fromCharCode(64 + SETTINGS_HEADERS.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SETTINGS_HEADERS] },
    });
  }

  return true;
}

function getUniqueLabels(rows, field) {
  const seen = new Set();
  const uniqueValues = [];

  for (const row of rows) {
    const value = normalizeText(row?.[field]);
    if (!value) {
      continue;
    }

    const lookup = normalizeLookup(value);
    if (seen.has(lookup)) {
      continue;
    }

    seen.add(lookup);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeLookup(value);
  if (!normalized) {
    return fallback;
  }

  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes';
}

function normalizeAgentRow(record) {
  return {
    ...record,
    id: normalizeText(record.id),
    nombre: normalizeText(record.nombre) || normalizeText(record.username),
    username: normalizeLookup(record.username),
    password_hash: normalizeText(record.password_hash),
    role: normalizeLookup(record.role) === 'admin' ? 'admin' : 'agent',
    activo: normalizeBool(record.activo, true),
  };
}

function sanitizeAgentRow(record) {
  const { password_hash, ...rest } = normalizeAgentRow(record);
  return rest;
}

function stripInternalFields(record) {
  const { _rowIndex, ...rest } = record;
  return rest;
}

let bankClassificationCache = null;

function clearBankClassificationCache() {
  bankClassificationCache = null;
}

function getBankRecordId(record) {
  return normalizeBankId(record?.id || record?.banco_id);
}

function getBankOwnerId(record) {
  return normalizeBankId(record?.propietario_id);
}

function getBankClassificationFromRecord(record, adminIds, agentIds) {
  const bankId = getBankRecordId(record);
  const ownerId = normalizeLookup(record?.propietario_id);

  if (!bankId || !ownerId) {
    return { bankId, classification: 'unknown' };
  }

  if (adminIds.has(ownerId)) {
    return { bankId, classification: 'admin' };
  }

  if (agentIds.has(ownerId)) {
    return { bankId, classification: 'agente' };
  }

  return { bankId, classification: 'unknown' };
}

async function buildBankClassificationSnapshot() {
  const [agentes, bancos] = await Promise.all([
    getTable('agentes'),
    getTable('bancos'),
  ]);

  const adminIds = new Set();
  const agentIds = new Set();

  agentes.forEach((agente) => {
    const agentId = normalizeLookup(agente?.id);
    const role = normalizeLookup(agente?.role);

    if (!agentId) {
      return;
    }

    if (role === 'admin') {
      adminIds.add(agentId);
      return;
    }

    if (role === 'agent') {
      agentIds.add(agentId);
    }
  });

  const adminBankIds = new Set();
  const agentBankIds = new Set();
  const bankClassifications = new Map();

  bancos.forEach((banco) => {
    const { bankId, classification } = getBankClassificationFromRecord(banco, adminIds, agentIds);

    if (!bankId) {
      return;
    }

    bankClassifications.set(normalizeLookup(bankId), classification);

    if (classification === 'admin') {
      adminBankIds.add(bankId);
      return;
    }

    if (classification === 'agente') {
      agentBankIds.add(bankId);
    }
  });

  return {
    adminBankIds,
    agentBankIds,
    bankClassifications,
    expiresAt: Date.now() + BANK_CLASSIFICATION_TTL_MS,
  };
}

async function getBankClassificationSnapshot() {
  if (bankClassificationCache && bankClassificationCache.expiresAt > Date.now()) {
    return bankClassificationCache;
  }

  bankClassificationCache = await buildBankClassificationSnapshot();
  return bankClassificationCache;
}

async function getAdminBankIds() {
  const snapshot = await getBankClassificationSnapshot();
  return new Set(snapshot.adminBankIds);
}

async function getAgentBankIds() {
  const snapshot = await getBankClassificationSnapshot();
  return new Set(snapshot.agentBankIds);
}

async function classifyBanco(bancoId) {
  const id = normalizeBankId(bancoId);
  if (!id) {
    return 'unknown';
  }

  const snapshot = await getBankClassificationSnapshot();
  return snapshot.bankClassifications.get(normalizeLookup(id)) || 'unknown';
}

function getWritableFields(tableName) {
  return TABLES[tableName].headers.filter((field) => field !== 'id');
}

function pickPatchFields(tableName, patch) {
  const allowedFields = new Set(getWritableFields(tableName));
  const sourcePatch = patch && typeof patch === 'object' ? patch : {};
  const nextPatch = {};

  if (tableName === 'agentes') {
    allowedFields.add('password');
    allowedFields.add('password_hash');
  }

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(sourcePatch, field)) {
      nextPatch[field] = sourcePatch[field] ?? '';
    }
  }

  return nextPatch;
}

function assertTable(tableName) {
  if (!TABLES[tableName]) {
    throw new NotFoundError(`La tabla ${tableName} no existe.`, {
      context: { tableName },
    });
  }
}

function isAgentTable(tableName) {
  return tableName === 'agentes';
}

function parseAgentRole(value, { required = false } = {}) {
  const role = normalizeLookup(value);
  if (!role) {
    if (required) {
      throw new BadRequestError('El rol es obligatorio para agentes.', {
        context: { tableName: 'agentes' },
      });
    }
    return '';
  }

  if (role !== 'admin' && role !== 'agent') {
    throw new BadRequestError('El rol debe ser admin o agent.', {
      context: { tableName: 'agentes', role },
    });
  }

  return role;
}

function parseAgentPassword(value) {
  return normalizeText(value);
}

function normalizeAgentWriteInput(input, existingRecord = null, { requirePassword = false } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const nextRecord = existingRecord ? { ...normalizeAgentRow(existingRecord) } : {};
  const hasRole = Object.prototype.hasOwnProperty.call(source, 'role');

  if (Object.prototype.hasOwnProperty.call(source, 'nombre')) {
    nextRecord.nombre = normalizeText(source.nombre);
  }

  if (Object.prototype.hasOwnProperty.call(source, 'username')) {
    nextRecord.username = normalizeLookup(source.username);
  }

  if (hasRole) {
    nextRecord.role = parseAgentRole(source.role, { required: true });
  }

  if (Object.prototype.hasOwnProperty.call(source, 'activo')) {
    nextRecord.activo = normalizeBool(source.activo, existingRecord ? normalizeBool(existingRecord.activo, true) : true);
  }

  const hasPassword = Object.prototype.hasOwnProperty.call(source, 'password');
  const passwordValue = hasPassword ? parseAgentPassword(source.password) : '';
  const hasPasswordHash = Object.prototype.hasOwnProperty.call(source, 'password_hash');
  const passwordHashValue = hasPasswordHash ? normalizeText(source.password_hash) : '';

  if (hasPassword) {
    if (!passwordValue) {
      throw new BadRequestError('La contrasena no puede estar vacia.', {
        context: { tableName: 'agentes' },
      });
    }

    nextRecord.password_hash = bcrypt.hashSync(passwordValue, 10);
  } else if (hasPasswordHash && passwordHashValue) {
    nextRecord.password_hash = passwordHashValue;
  } else if (existingRecord?.password_hash) {
    nextRecord.password_hash = normalizeText(existingRecord.password_hash);
  } else if (requirePassword) {
    throw new BadRequestError('La contrasena es obligatoria para agentes.', {
      context: { tableName: 'agentes' },
    });
  }

  if (!nextRecord.nombre) {
    throw new BadRequestError('El nombre es obligatorio para agentes.', {
      context: { tableName: 'agentes' },
    });
  }

  if (!nextRecord.username) {
    throw new BadRequestError('El username es obligatorio para agentes.', {
      context: { tableName: 'agentes' },
    });
  }

  if (!nextRecord.role) {
    if (!existingRecord && !hasRole) {
      throw new BadRequestError('El rol es obligatorio para agentes.', {
        context: { tableName: 'agentes' },
      });
    }

    nextRecord.role = existingRecord ? normalizeAgentRow(existingRecord).role : 'agent';
  }

  if (typeof nextRecord.activo !== 'boolean') {
    nextRecord.activo = existingRecord ? normalizeBool(existingRecord.activo, true) : true;
  }

  return nextRecord;
}

function buildUpdatedRecord(existing, patch, tableName) {
  const nextRecord = { ...existing };

  for (const [field, value] of Object.entries(pickPatchFields(tableName, patch))) {
    nextRecord[field] = value;
  }

  return nextRecord;
}

function normalizeActiveAgentCount(rows) {
  return rows.filter((row) => normalizeLookup(row.role) === 'admin' && normalizeBool(row.activo, true)).length;
}

function ensureUniqueAgentUsername(rows, candidate, currentId = null) {
  const username = normalizeLookup(candidate.username);
  if (!username) {
    throw new BadRequestError('El username es obligatorio para agentes.', {
      context: { tableName: 'agentes' },
    });
  }

  const duplicate = rows.find((row) => row.id !== currentId && normalizeLookup(row.username) === username);
  if (duplicate) {
    throw new BadRequestError('El username ya existe. Debe ser unico.', {
      context: {
        tableName: 'agentes',
        username,
        duplicateId: duplicate.id,
      },
    });
  }
}

function ensureAgentSafety(rows, currentId, candidate, operation) {
  const normalizedRows = rows.map(normalizeAgentRow);
  const existingActiveAdmins = normalizeActiveAgentCount(normalizedRows);

  if (operation === 'add') {
    ensureUniqueAgentUsername(normalizedRows, candidate);
    return;
  }

  if (operation === 'update') {
    ensureUniqueAgentUsername(normalizedRows, candidate, currentId);
  }

  const nextRows = operation === 'remove'
    ? normalizedRows.filter((row) => row.id !== currentId)
    : normalizedRows.map((row) => (row.id === currentId ? candidate : row));

  const nextActiveAdmins = normalizeActiveAgentCount(nextRows);

  if (existingActiveAdmins > 0 && nextActiveAdmins === 0) {
    throw new BadRequestError('No se puede dejar al sistema sin un admin activo.', {
      context: {
        tableName: 'agentes',
        id: currentId,
        operation,
      },
    });
  }
}

async function getStoredRows(tableName) {
  assertTable(tableName);
  const rows = await repo.getAll(TABLES[tableName].sheet);
  if (rows.length === 0 && SEED_DATA[tableName]?.length > 0) {
    return SEED_DATA[tableName];
  }

  return rows;
}

async function getTable(tableName) {
  assertTable(tableName);
  const rows = await getStoredRows(tableName);
  if (isAgentTable(tableName)) {
    return rows.map(sanitizeAgentRow);
  }
  if (tableName === 'bancos') {
    return Promise.all(rows.map((row) => hydrateBancoRecordForRead(row)));
  }
  return rows;
}

async function getConfigBancoById(bancoId) {
  const id = normalizeText(bancoId);
  if (!id) {
    return null;
  }

  const bancos = await getTable('bancos');
  return bancos.find((row) => normalizeLookup(row.id) === normalizeLookup(id)) || null;
}

async function getSetting(key) {
  const normalizedKey = assertValidSettingKey(key);

  let rows = [];
  try {
    rows = await repo.getAll(SETTINGS_SHEET);
  } catch (error) {
    if (normalizedKey === SETTINGS_SEED_KEY) {
      logger.warn('Using default config_settings seed because the sheet is not ready yet.', {
        context: { tableName: SETTINGS_SHEET, key: normalizedKey },
        error,
      });
      return formatSettingForRead(buildSettingsSeedRecord());
    }

    throw error;
  }

  const existingRecord = rows.find((row) => normalizeSettingKey(row.key) === normalizedKey);

  if (existingRecord) {
    return formatSettingForRead(existingRecord);
  }

  if (normalizedKey === SETTINGS_SEED_KEY) {
    return formatSettingForRead(buildSettingsSeedRecord());
  }

  throw new NotFoundError(`No se encontro la clave ${key} en la tabla config_settings.`, {
    context: {
      tableName: SETTINGS_SHEET,
      key: normalizedKey,
    },
  });
}

async function upsertSetting(key, item, user = 'system') {
  const normalizedKey = assertValidSettingKey(key);

  const source = item && typeof item === 'object' ? item : {};
  const value = normalizeSettingValue(source.value);
  const fechaEfectiva = normalizeText(source.fecha_efectiva);

  if (!value) {
    throw new BadRequestError('El valor de configuracion es obligatorio.', {
      context: {
        tableName: SETTINGS_SHEET,
        key: normalizedKey,
      },
    });
  }

  if (!fechaEfectiva) {
    throw new BadRequestError('La fecha efectiva es obligatoria.', {
      context: {
        tableName: SETTINGS_SHEET,
        key: normalizedKey,
      },
    });
  }

  await ensureSettingsSheetExists();

  const rows = await repo.getAll(SETTINGS_SHEET);
  const existingRecord = rows.find((row) => normalizeSettingKey(row.key) === normalizedKey);
  const nextRecord = {
    key: normalizedKey,
    value,
    fecha_efectiva: fechaEfectiva,
    actualizado_por: normalizeText(user) || 'system',
    actualizado_en: nowLima(),
  };

  if (existingRecord) {
    const storedNextRecord = { ...existingRecord, ...nextRecord };
    await repo.update(SETTINGS_SHEET, existingRecord._rowIndex, storedNextRecord, SETTINGS_HEADERS);
    await audit.log('update', 'config_settings', user, {
      before: formatSettingForRead(existingRecord),
      after: formatSettingForRead(storedNextRecord),
      changes: formatSettingForRead(nextRecord),
    });
    return formatSettingForRead(storedNextRecord);
  }

  await repo.append(SETTINGS_SHEET, nextRecord, SETTINGS_HEADERS);
  await audit.log('create', 'config_settings', user, formatSettingForRead(nextRecord));
  return formatSettingForRead(nextRecord);
}

async function getCajaInicioMesByBanco(bancoId) {
  const id = normalizeText(bancoId);
  if (!id) {
    throw new BadRequestError('El banco es obligatorio para consultar la caja de inicio de mes.', {
      context: {
        tableName: SETTINGS_SHEET,
      },
    });
  }

  try {
    const record = await getSetting(`caja_inicio_mes:banco:${id}`);
    return {
      value: Number(record.value),
      fecha_efectiva: record.fecha_efectiva || null,
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      return {
        value: 0,
        fecha_efectiva: null,
      };
    }

    throw error;
  }
}

async function existsInTable(tableName, value, field = 'nombre', matcher = null) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return true;
  }

  const rows = await getTable(tableName);
  if (typeof matcher === 'function') {
    return rows.some((row) => matcher(row, value));
  }

  const needle = normalizeLookup(value);
  return rows.some((row) => normalizeLookup(row[field]) === needle);
}

function formatReferenceWarning({ label, value, tableLabel }) {
  return `El ${label} "${value}" no existe en ${tableLabel}. Se registro igualmente para no bloquear la operacion.`;
}

function removeFromSeedData(tableName, id) {
  if (!SEED_DATA[tableName]) {
    return null;
  }

  const index = SEED_DATA[tableName].findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }

  const [removed] = SEED_DATA[tableName].splice(index, 1);
  return removed;
}

async function resolveBancoPropietario(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    throw new BadRequestError('El propietario_id es requerido para bancos.', {
      context: {
        tableName: 'bancos',
      },
    });
  }

  const agentes = await getStoredRows('agentes');
  const match = agentes.find((agente) => (
    normalizeLookup(agente.id) === normalizeLookup(value)
    || normalizeLookup(agente.nombre) === normalizeLookup(value)
  ));

  if (!match) {
    throw new BadRequestError('El agente especificado no existe en configuracion.', {
      context: {
        tableName: 'bancos',
        propietario_id: value,
      },
    });
  }

  return normalizeAgentRow(match);
}

async function normalizeBancoRecord(record, { requireOwner = false } = {}) {
  const nextRecord = { ...record };
  const hasPropietarioId = Object.prototype.hasOwnProperty.call(nextRecord, 'propietario_id');
  const hasPropietario = Object.prototype.hasOwnProperty.call(nextRecord, 'propietario');
  const rawOwner = hasPropietarioId ? nextRecord.propietario_id : nextRecord.propietario;

  if (rawOwner !== undefined && rawOwner !== null && String(rawOwner).trim() !== '') {
    const propietario = await resolveBancoPropietario(rawOwner);
    nextRecord.propietario_id = propietario.id;
    nextRecord.propietario = propietario.nombre;
    return nextRecord;
  }

  if (requireOwner) {
    throw new BadRequestError('El propietario_id es requerido para bancos.', {
      context: {
        tableName: 'bancos',
      },
    });
  }

  if (hasPropietarioId && String(nextRecord.propietario_id ?? '').trim() === '') {
    delete nextRecord.propietario_id;
  }

  if (hasPropietario && String(nextRecord.propietario ?? '').trim() === '') {
    delete nextRecord.propietario;
  }

  return nextRecord;
}

async function hydrateBancoRecordForRead(record) {
  try {
    return await normalizeBancoRecord(record);
  } catch {
    return {
      ...record,
      propietario: normalizeText(record?.propietario),
      propietario_id: normalizeText(record?.propietario_id),
    };
  }
}

function getImportLabel(tableName, record) {
  if (record?.nombre) {
    return record.nombre;
  }

  if (tableName === 'categorias') {
    const parts = [record?.categoria, record?.subcategoria].filter((value) => String(value ?? '').trim() !== '');
    if (parts.length > 0) {
      return parts.join(' / ');
    }
  }

  if (record?.categoria) {
    return record.categoria;
  }

  return record?.id || '';
}

function createConfigRecord(tableName, item) {
  const id = createPrefixedId(tableName.toUpperCase().slice(0, 3));
  return { id, ...item };
}

function updateSeedRecord(tableName, id, nextRecord) {
  if (!SEED_DATA[tableName]) {
    return false;
  }

  const index = SEED_DATA[tableName].findIndex((item) => item.id === id);
  if (index === -1) {
    return false;
  }

  SEED_DATA[tableName][index] = stripInternalFields(nextRecord);
  return true;
}

async function validateReferences(checks, user = 'system', entity = 'registro') {
  const warnings = [];
  const issues = [];
  const tableCache = new Map();

  async function getRows(tableName) {
    if (!tableCache.has(tableName)) {
      tableCache.set(tableName, getTable(tableName));
    }
    return tableCache.get(tableName);
  }

  for (const check of checks) {
    const value = String(check?.value ?? '').trim();
    if (!value) continue;

    const rows = await getRows(check.tableName);
    const exists = typeof check.matcher === 'function'
      ? rows.some((row) => check.matcher(row, value))
      : rows.some((row) => normalizeLookup(row[check.field || 'nombre']) === normalizeLookup(value));

    if (!exists) {
      const warning = check.message || formatReferenceWarning({
        label: check.label || check.field || check.tableName,
        value,
        tableLabel: check.tableLabel || check.tableName,
      });

      warnings.push(warning);
      issues.push({
        table: check.tableName,
        field: check.field || 'nombre',
        value,
        message: warning,
      });
    }
  }

  if (warnings.length > 0) {
    try {
      await audit.log('warning', `${entity}_validation`, user, {
        warnings,
        issues,
      });
    } catch (error) {
      logger.warn('Failed to persist validation warnings audit entry', {
        context: { entity, user },
        error,
      });
    }
  }

  return warnings;
}

async function addToTable(tableName, item, user = 'system') {
  assertTable(tableName);
  const { sheet, headers } = TABLES[tableName];
  const normalizedItem = tableName === 'bancos'
    ? await normalizeBancoRecord(item, { requireOwner: true })
    : item;

  if (isAgentTable(tableName)) {
    const currentRows = await getStoredRows('agentes');
    const record = createConfigRecord(tableName, normalizeAgentWriteInput(normalizedItem, null, { requirePassword: true }));
    ensureAgentSafety(currentRows, null, record, 'add');
    await repo.append(sheet, record, headers);
    authService.clearAuthUserCache();
    await audit.log('create', `config_${tableName}`, user, stripInternalFields(record));
    return sanitizeAgentRow(record);
  }

  const record = createConfigRecord(tableName, normalizedItem);
  await repo.append(sheet, record, headers);
  await audit.log('create', `config_${tableName}`, user, record);
  return record;
}

async function updateAgentPassword(id, password, user = 'system') {
  assertTable('agentes');

  const nextPassword = parseAgentPassword(password);
  if (!nextPassword) {
    throw new BadRequestError('La contrasena es obligatoria para el cambio de password.', {
      context: { tableName: 'agentes', id },
    });
  }

  const { sheet, headers } = TABLES.agentes;
  const realRows = await repo.getAll(sheet);
  const existingRecord = realRows.find((item) => item.id === id);
  const seedRecord = !existingRecord ? (SEED_DATA.agentes || []).find((item) => item.id === id) : null;
  const sourceRecord = existingRecord || seedRecord;

  if (!sourceRecord) {
    throw new NotFoundError(`No se encontro el registro ${id} en la tabla agentes.`, {
      context: {
        tableName: 'agentes',
        id,
      },
    });
  }

  const currentRows = await getStoredRows('agentes');
  const nextRecord = normalizeAgentWriteInput(
    { password: nextPassword },
    sourceRecord,
    { requirePassword: true },
  );

  ensureAgentSafety(currentRows, id, nextRecord, 'update');

  if (existingRecord) {
    const storedNextRecord = { ...existingRecord, password_hash: nextRecord.password_hash };
    await repo.update(sheet, existingRecord._rowIndex, storedNextRecord, headers);
    authService.clearAuthUserCache();
    clearBankClassificationCache();
    await audit.log('update_password', 'config_agentes', user, {
      id,
      username: normalizeLookup(sourceRecord.username),
    });
    return sanitizeAgentRow(storedNextRecord);
  }

  const storedNextRecord = { ...sourceRecord, password_hash: nextRecord.password_hash };
  updateSeedRecord('agentes', id, storedNextRecord);
  authService.clearAuthUserCache();
  clearBankClassificationCache();
  await audit.log('update_password', 'config_agentes', user, {
    id,
    username: normalizeLookup(sourceRecord.username),
  });
  return sanitizeAgentRow(storedNextRecord);
}

async function updateInTable(tableName, id, patch = {}, user = 'system') {
  assertTable(tableName);

  const { sheet, headers } = TABLES[tableName];

  if (isAgentTable(tableName)) {
    const realRows = await repo.getAll(sheet);
    const existingRecord = realRows.find((item) => item.id === id);
    const seedRecord = !existingRecord ? (SEED_DATA.agentes || []).find((item) => item.id === id) : null;
    const sourceRecord = existingRecord || seedRecord;

    if (!sourceRecord) {
      throw new NotFoundError(`No se encontro el registro ${id} en la tabla ${tableName}.`, {
        context: {
          tableName,
          id,
        },
      });
    }

    const currentRows = await getStoredRows(tableName);
    const nextRecord = normalizeAgentWriteInput(patch, sourceRecord);
    ensureAgentSafety(currentRows, id, nextRecord, 'update');

    if (existingRecord) {
      const storedNextRecord = { ...existingRecord, ...nextRecord };
      await repo.update(sheet, existingRecord._rowIndex, storedNextRecord, headers);
      authService.clearAuthUserCache();
      clearBankClassificationCache();
      await audit.log('update', `config_${tableName}`, user, {
        before: stripInternalFields(normalizeAgentRow(existingRecord)),
        after: sanitizeAgentRow(storedNextRecord),
        changes: pickPatchFields(tableName, patch),
      });
      return sanitizeAgentRow(storedNextRecord);
    }

    const storedNextRecord = { ...sourceRecord, ...nextRecord };
    updateSeedRecord(tableName, id, storedNextRecord);
    authService.clearAuthUserCache();
    clearBankClassificationCache();
    await audit.log('update', `config_${tableName}`, user, {
      before: sanitizeAgentRow(sourceRecord),
      after: sanitizeAgentRow(storedNextRecord),
      changes: pickPatchFields(tableName, patch),
    });
    return sanitizeAgentRow(storedNextRecord);
  }

  const realRows = await repo.getAll(sheet);
  const existingRecord = realRows.find((item) => item.id === id);
  const nextPatch = tableName === 'bancos'
    ? await normalizeBancoRecord(pickPatchFields(tableName, patch))
    : pickPatchFields(tableName, patch);

  if (existingRecord) {
    const nextRecord = buildUpdatedRecord(existingRecord, nextPatch, tableName);
    await repo.update(sheet, existingRecord._rowIndex, nextRecord, headers);
    if (tableName === 'bancos') {
      clearBankClassificationCache();
    }
    await audit.log('update', `config_${tableName}`, user, {
      before: stripInternalFields(existingRecord),
      after: stripInternalFields(nextRecord),
      changes: nextPatch,
    });
    return stripInternalFields(nextRecord);
  }

  const seedRows = SEED_DATA[tableName] || [];
  const seedRecord = seedRows.find((item) => item.id === id);

  if (seedRecord) {
    const nextRecord = buildUpdatedRecord(seedRecord, nextPatch, tableName);
    updateSeedRecord(tableName, id, nextRecord);
    if (tableName === 'bancos') {
      clearBankClassificationCache();
    }
    await audit.log('update', `config_${tableName}`, user, {
      before: stripInternalFields(seedRecord),
      after: stripInternalFields(nextRecord),
      changes: nextPatch,
    });
    return stripInternalFields(nextRecord);
  }

  throw new NotFoundError(`No se encontro el registro ${id} en la tabla ${tableName}.`, {
    context: {
      tableName,
      id,
    },
  });
}

async function removeFromTable(tableName, id, user = 'system') {
  assertTable(tableName);

  const { sheet } = TABLES[tableName];

  if (isAgentTable(tableName)) {
    const realRows = await repo.getAll(sheet);
    const realRecord = realRows.find((item) => item.id === id);
    const seedRecord = !realRecord ? (SEED_DATA.agentes || []).find((item) => item.id === id) : null;
    const sourceRecord = realRecord || seedRecord;

    if (!sourceRecord) {
      throw new NotFoundError(`No se encontro el registro ${id} en la tabla ${tableName}.`, {
        context: {
          tableName,
          id,
        },
      });
    }

    const currentRows = await getStoredRows(tableName);
    ensureAgentSafety(currentRows, id, null, 'remove');

    if (realRecord) {
      await repo.deleteRow(sheet, realRecord._rowIndex);
      removeFromSeedData(tableName, id);
      authService.clearAuthUserCache();
      clearBankClassificationCache();
      const { _rowIndex, ...deletedRecord } = realRecord;
      await audit.log('delete', `config_${tableName}`, user, sanitizeAgentRow(deletedRecord));
      return { status: 'removed', id };
    }

    const seedRemoved = removeFromSeedData(tableName, id);
    if (seedRemoved) {
      clearBankClassificationCache();
      await audit.log('delete', `config_${tableName}`, user, sanitizeAgentRow(seedRemoved));
      return { status: 'removed', id };
    }
  }

  const realRows = await repo.getAll(sheet);
  const realRecord = realRows.find((item) => item.id === id);

  if (realRecord) {
    await repo.deleteRow(sheet, realRecord._rowIndex);

    removeFromSeedData(tableName, id);
    authService.clearAuthUserCache();
    clearBankClassificationCache();

    const { _rowIndex, ...deletedRecord } = realRecord;
    await audit.log('delete', `config_${tableName}`, user, deletedRecord);
    return { status: 'removed', id };
  }

  const seedRecord = removeFromSeedData(tableName, id);
  if (seedRecord) {
    clearBankClassificationCache();
    await audit.log('delete', `config_${tableName}`, user, seedRecord);
    return { status: 'removed', id };
  }

  throw new NotFoundError(`No se encontro el registro ${id} en la tabla ${tableName}.`, {
    context: {
      tableName,
      id,
    },
  });
}

async function importBatch(tableName, items, user = 'system') {
  assertTable(tableName);
  const { sheet, headers } = TABLES[tableName];
  const records = [];

  for (const item of items) {
    let normalizedItem = item;
    if (tableName === 'bancos') {
      normalizedItem = await normalizeBancoRecord(item, { requireOwner: true });
    } else if (isAgentTable(tableName)) {
      normalizedItem = normalizeAgentWriteInput(item, null, { requirePassword: true });
    }
    records.push(createConfigRecord(tableName, normalizedItem));
  }

  await repo.appendBatch(sheet, records.map((record) => headers.map((header) => record[header] ?? '')));
  if (isAgentTable(tableName)) {
    authService.clearAuthUserCache();
    clearBankClassificationCache();
  }
  if (tableName === 'bancos') {
    clearBankClassificationCache();
  }
  await audit.log('import', `config_${tableName}`, user, {
    count: records.length,
    items: records.map((record) => getImportLabel(tableName, record)),
  });

  return isAgentTable(tableName) ? records.map(sanitizeAgentRow) : records;
}

/**
 * Returns the full config object for the app (replaces hardcoded /api/config).
 */
async function getFullConfig() {
  const [agentes, categorias, bancos, cajas, usuarios, tiposPago] = await Promise.all([
    getTable('agentes'),
    getTable('categorias'),
    getTable('bancos'),
    getTable('cajas'),
    getTable('usuarios'),
    getTable('tipos_pago'),
  ]);

  // Transform categorias into grouped format
  const categoriasMap = {};
  categorias.forEach((c) => {
    if (!categoriasMap[c.categoria]) categoriasMap[c.categoria] = [];
    if (c.subcategoria) categoriasMap[c.categoria].push(c.subcategoria);
  });

  return {
    agentes: getUniqueLabels(agentes, 'nombre'),
    agentes_full: agentes,
    categorias: categoriasMap,
    categorias_full: categorias,
    bancos: getUniqueLabels(bancos, 'nombre'),
    bancos_full: bancos,
    cajas: getUniqueLabels(cajas, 'nombre'),
    cajas_full: cajas,
    usuarios: getUniqueLabels(usuarios, 'nombre'),
    usuarios_full: usuarios,
    tipos_pago: getUniqueLabels(tiposPago, 'nombre'),
    tipos_pago_full: tiposPago,
    timezone: 'America/Lima',
  };
}

module.exports = {
  getTable,
  getConfigBancoById,
  getAdminBankIds,
  getAgentBankIds,
  classifyBanco,
  getBankClassificationFromRecord,
  getSetting,
  getCajaInicioMesByBanco,
  addToTable,
  updateInTable,
  updateAgentPassword,
  upsertSetting,
  removeFromTable,
  importBatch,
  getFullConfig,
  existsInTable,
  validateReferences,
};
