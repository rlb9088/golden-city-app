const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');

const SHEET_NAME = 'bancos';
const HEADERS = ['id', 'fecha', 'banco', 'saldo'];

let bancoCounter = 1;

/**
 * Upsert: si ya existe un registro con misma fecha+banco, lo sobreescribe.
 * Si no existe, crea uno nuevo.
 */
async function upsert(data, adminUser) {
  const all = await repo.getAll(SHEET_NAME);
  const existing = all.find((r) => r.fecha === data.fecha && r.banco === data.banco);

  if (existing) {
    // Overwrite existing
    const updated = {
      ...existing,
      saldo: data.saldo,
    };
    await repo.update(SHEET_NAME, existing._rowIndex, updated, HEADERS);
    await audit.log('update', 'banco', adminUser, {
      action: 'upsert_overwrite',
      fecha: data.fecha,
      banco: data.banco,
      saldo_anterior: existing.saldo,
      saldo_nuevo: data.saldo,
    });
    return { ...updated, overwritten: true };
  }

  // Create new
  const banco = {
    id: `BAN-${Date.now()}-${bancoCounter++}`,
    fecha: data.fecha,
    banco: data.banco,
    saldo: data.saldo,
  };

  await repo.append(SHEET_NAME, banco, HEADERS);
  await audit.log('create', 'banco', adminUser, banco);

  return { ...banco, overwritten: false };
}

async function getAll() {
  return repo.getAll(SHEET_NAME);
}

/**
 * Retorna el último saldo (fecha más reciente) por cada banco.
 */
async function getLatest() {
  const all = await repo.getAll(SHEET_NAME);
  const latest = {};
  all.forEach((row) => {
    if (!latest[row.banco] || row.fecha > latest[row.banco].fecha) {
      latest[row.banco] = row;
    }
  });
  return Object.values(latest);
}

module.exports = { upsert, getAll, getLatest };
