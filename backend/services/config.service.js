const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { NotFoundError } = require('../utils/appError');
const logger = require('../lib/logger');

/**
 * Servicio de configuración — CRUD sobre tablas de config.
 * Cada tabla tiene su propia hoja en Google Sheets (o store in-memory).
 */

const TABLES = {
  agentes: { sheet: 'config_agentes', headers: ['id', 'nombre'] },
  categorias: { sheet: 'config_categorias', headers: ['id', 'categoria', 'subcategoria'] },
  bancos: { sheet: 'config_bancos', headers: ['id', 'nombre', 'propietario'] },
  cajas: { sheet: 'config_cajas', headers: ['id', 'nombre'] },
  usuarios: { sheet: 'config_usuarios', headers: ['id', 'nombre'] },
  tipos_pago: { sheet: 'config_tipos_pago', headers: ['id', 'nombre'] },
};

// Default seed data (used when tables are empty)
const SEED_DATA = {
  agentes: [
    { id: 'AG-1', nombre: 'Agente 1' },
    { id: 'AG-2', nombre: 'Agente 2' },
    { id: 'AG-3', nombre: 'Agente 3' },
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
    { id: 'BK-1', nombre: 'BCP', propietario: 'Negocio' },
    { id: 'BK-2', nombre: 'Interbank', propietario: 'Negocio' },
    { id: 'BK-3', nombre: 'BBVA', propietario: 'Negocio' },
    { id: 'BK-4', nombre: 'Scotiabank', propietario: 'Agente 1' },
    { id: 'BK-5', nombre: 'Yape', propietario: 'Agente 2' },
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

let counters = { agentes: 100, categorias: 100, bancos: 100, cajas: 100, usuarios: 100, tipos_pago: 100 };

function normalizeLookup(value) {
  return String(value ?? '').trim().toLowerCase();
}

function assertTable(tableName) {
  if (!TABLES[tableName]) {
    throw new NotFoundError(`La tabla ${tableName} no existe.`, {
      context: { tableName },
    });
  }
}

async function getTable(tableName) {
  assertTable(tableName);
  const data = await repo.getAll(TABLES[tableName].sheet);
  if (data.length === 0 && SEED_DATA[tableName]?.length > 0) {
    return SEED_DATA[tableName];
  }
  return data;
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
  return `El ${label} "${value}" no existe en ${tableLabel}. Se registró igualmente para no bloquear la operación.`;
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
  const id = `${tableName.toUpperCase().slice(0, 3)}-${Date.now()}-${counters[tableName]++}`;
  const record = { id, ...item };
  await repo.append(sheet, record, headers);
  await audit.log('create', `config_${tableName}`, user, record);
  return record;
}

async function removeFromTable(tableName, id, user = 'system') {
  assertTable(tableName);

  const { sheet } = TABLES[tableName];
  const realRows = await repo.getAll(sheet);
  const realRecord = realRows.find((item) => item.id === id);

  if (realRecord) {
    await repo.deleteRow(sheet, realRecord._rowIndex);

    removeFromSeedData(tableName, id);

    const { _rowIndex, ...deletedRecord } = realRecord;
    await audit.log('delete', `config_${tableName}`, user, deletedRecord);
    return { status: 'removed', id };
  }

  const seedRecord = removeFromSeedData(tableName, id);
  if (seedRecord) {
    await audit.log('delete', `config_${tableName}`, user, seedRecord);
    return { status: 'removed', id };
  }

  throw new NotFoundError(`No se encontró el registro ${id} en la tabla ${tableName}.`, {
    context: {
      tableName,
      id,
    },
  });
}

async function importBatch(tableName, items, user = 'system') {
  assertTable(tableName);
  const { sheet, headers } = TABLES[tableName];
  const results = [];

  for (const item of items) {
    const id = `${tableName.toUpperCase().slice(0, 3)}-${Date.now()}-${counters[tableName]++}`;
    const record = { id, ...item };
    await repo.append(sheet, record, headers);
    await audit.log('create', `config_${tableName}`, user, record);
    results.push(record);

    // Also add to seed data for in-memory mode
    if (SEED_DATA[tableName]) {
      SEED_DATA[tableName].push(record);
    }
  }

  return results;
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
    agentes: agentes.map((a) => a.nombre),
    agentes_full: agentes,
    categorias: categoriasMap,
    categorias_full: categorias,
    bancos: bancos.map((b) => b.nombre),
    bancos_full: bancos,
    cajas: cajas.map((c) => c.nombre),
    cajas_full: cajas,
    usuarios: usuarios.map((u) => u.nombre),
    usuarios_full: usuarios,
    tipos_pago: tiposPago.map((t) => t.nombre),
    tipos_pago_full: tiposPago,
    timezone: 'America/Lima',
  };
}

module.exports = {
  getTable,
  addToTable,
  removeFromTable,
  importBatch,
  getFullConfig,
  existsInTable,
  validateReferences,
};
