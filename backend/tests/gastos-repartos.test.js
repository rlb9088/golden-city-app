const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CATALOGS = {
  conceptos_gasto: ['Railway', 'ITF'],
  proveedores_gasto: ['Railway', 'Sin proveedor'],
  conceptos_reparto: ['Pago Socio 1'],
  proveedores_reparto: ['Rodrigo'],
};

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

function loadServices({ gastosRows = [], repartosRows = [] } = {}) {
  for (const mod of ['../services/gastos.service', '../services/repartos.service', '../services/config.service']) {
    delete require.cache[require.resolve(mod)];
  }

  const store = {
    gastos: gastosRows.map((r, i) => ({ ...r, _rowIndex: i + 2 })),
    repartos: repartosRows.map((r, i) => ({ ...r, _rowIndex: i + 2 })),
  };
  const appended = [];

  mockModule('../repositories/sheetsRepository', {
    getAll: async (sheet) => store[sheet] || [],
    findById: async (sheet, id) => (store[sheet] || []).find((r) => r.id === id) || null,
    append: async (sheet, data, headers) => { appended.push({ sheet, data, headers }); },
    update: async () => ({}),
    deleteRow: async () => ({}),
    delete: async () => ({}),
  });
  mockModule('../services/audit.service', { log: async () => ({}) });

  const catalogTables = {
    categorias_reparto: [
      { dominio: 'Inversión', categoria: 'Inversión en Publicidad', subcategoria: 'Inversión en Meta Ads' },
      { dominio: 'Reparto socios', categoria: 'Reparto Beneficios', subcategoria: 'Socio 1' },
    ],
  };
  for (const [name, values] of Object.entries(CATALOGS)) {
    catalogTables[name] = values.map((nombre) => ({ nombre }));
  }

  const { BadRequestError } = require('../utils/appError');
  mockModule('../services/config.service', {
    validateReferences: async () => [],
    getConfigBancoById: async (id) => ({ id, nombre: 'BCP', propietario_id: 'AD-1' }),
    getTable: async (name) => catalogTables[name] || [],
    assertCatalogValue: async (table, label, value) => {
      const match = (catalogTables[table] || []).find((r) => r.nombre.toLowerCase() === String(value).trim().toLowerCase());
      if (!match) throw new BadRequestError(`${label} "${value}" no esta en la lista oficial.`);
      return match.nombre;
    },
  });

  return {
    gastos: require('../services/gastos.service'),
    repartos: require('../services/repartos.service'),
    appended,
  };
}

const admin = { userId: 'AD-1', user: 'admin' };

const gastoBase = {
  concepto: 'railway',
  categoria: 'Gastos Administrativos',
  subcategoria: 'Hostings, Dominios.',
  banco_id: 'BK-1',
  monto: 10,
  fecha_gasto: '2026-11-25',
  proveedor: 'Railway',
  nota: ' mensual ',
};

test('gasto: guarda dominio fijo, proveedor y nota con nombres canonicos', async () => {
  const { gastos, appended } = loadServices();
  const { record } = await gastos.create(gastoBase, admin);

  assert.equal(record.dominio, 'Gasto (OPEX)');
  assert.equal(record.concepto, 'Railway');
  assert.equal(record.proveedor, 'Railway');
  assert.equal(record.nota, 'mensual');
  assert.deepEqual(appended[0].headers.slice(-3), ['dominio', 'proveedor', 'nota']);
});

test('gasto: rechaza concepto o proveedor fuera de la lista oficial', async () => {
  const { gastos } = loadServices();
  await assert.rejects(() => gastos.create({ ...gastoBase, concepto: 'Inventado' }, admin), /lista oficial/);
  await assert.rejects(() => gastos.create({ ...gastoBase, proveedor: 'Nadie' }, admin), /lista oficial/);
});

test('gasto historico sin proveedor se lista con dominio por defecto y se edita sin exigir lista', async () => {
  const legacy = { id: 'GAS-1', estado: 'activo', fecha_gasto: '2026-01-01', concepto: 'Texto libre viejo', categoria: 'Operativo', banco_id: 'BK-1', monto: 5 };
  const { gastos } = loadServices({ gastosRows: [legacy] });

  const page = await gastos.getPagedAndFiltered({}, 50, 0);
  assert.equal(page.items[0].dominio, 'Gasto (OPEX)');

  const updated = await gastos.update('GAS-1', { monto: 7, concepto: 'Texto libre viejo', banco_id: 'BK-1' }, admin);
  assert.equal(updated.monto, 7);
  assert.equal(updated.concepto, 'Texto libre viejo');
});

const repartoBase = {
  concepto: 'Pago Socio 1',
  categoria: 'Reparto Beneficios',
  subcategoria: 'Socio 1',
  proveedor: 'Rodrigo',
  nota: '',
  banco_id: 'BK-1',
  monto: 100,
  fecha_movimiento: '2026-11-25',
};

test('reparto: deriva el dominio desde la categoria', async () => {
  const { repartos, appended } = loadServices();
  const { record } = await repartos.create(repartoBase, admin);
  assert.equal(record.dominio, 'Reparto socios');
  assert.equal(appended[0].sheet, 'repartos');

  const inv = await repartos.create({ ...repartoBase, categoria: 'Inversión en Publicidad', subcategoria: 'Inversión en Meta Ads' }, admin);
  assert.equal(inv.record.dominio, 'Inversión');
});

test('reparto: rechaza subcategoria ajena, concepto y proveedor fuera de lista', async () => {
  const { repartos } = loadServices();
  await assert.rejects(() => repartos.create({ ...repartoBase, subcategoria: 'Inversión en Meta Ads' }, admin), /no pertenece/);
  await assert.rejects(() => repartos.create({ ...repartoBase, concepto: 'X' }, admin), /lista oficial/);
  await assert.rejects(() => repartos.create({ ...repartoBase, proveedor: 'X' }, admin), /lista oficial/);
  await assert.rejects(() => repartos.create({ ...repartoBase, categoria: 'Otra' }, admin), /no existe/);
});

test('repartos es informativo: balance y servicios de caja no lo consumen', () => {
  const servicesDir = path.resolve(__dirname, '../services');
  for (const file of fs.readdirSync(servicesDir)) {
    if (file === 'repartos.service.js' || file === 'gastosRepartosMigration.service.js') continue;
    const source = fs.readFileSync(path.join(servicesDir, file), 'utf8');
    assert.ok(!/repartos\.service|'repartos'/.test(source), `${file} no debe usar repartos`);
  }
});

test('migracion: planes aditivos y detecta categorias fuera de catalogo', () => {
  const { planNameCatalog, planCategorias } = require('../services/gastosRepartosMigration.service');
  assert.deepEqual(planNameCatalog([{ nombre: ' railway ' }], ['Railway', 'Upstash']), ['Upstash']);

  const plan = planCategorias(
    [{ categoria: 'Operativo', subcategoria: 'Limpieza', _rowIndex: 2 }, { categoria: 'Gastos de Personal', subcategoria: 'Agentes', _rowIndex: 3 }],
    [{ categoria: 'Gastos de Personal', subcategoria: 'Agentes' }, { categoria: 'Gastos de Personal', subcategoria: 'Gerencia' }],
  );
  assert.equal(plan.toAdd.length, 1);
  assert.equal(plan.toAdd[0].subcategoria, 'Gerencia');
  assert.equal(plan.obsolete.length, 1);
  assert.equal(plan.obsolete[0].categoria, 'Operativo');
});
