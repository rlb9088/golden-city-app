const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfigService(rows) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const servicePath = require.resolve('../services/config.service');
  delete require.cache[servicePath];

  const appended = [];
  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll: async () => rows.map((r, i) => ({ ...r, _rowIndex: i + 2 })),
      append: async (sheet, data) => { appended.push({ sheet, data }); },
      update: async () => ({}),
    },
  };
  require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { log: async () => ({}) } };
  return { service: require('../services/config.service'), appended };
}

test('listas oficiales: agrega nuevo concepto y bloquea duplicados sin distinguir mayusculas', async () => {
  const { service, appended } = loadConfigService([{ id: 'CON-1', nombre: 'Railway' }]);

  const created = await service.addToTable('conceptos_gasto', { nombre: '  Nuevo concepto ' }, 'admin');
  assert.equal(created.nombre, 'Nuevo concepto');
  assert.equal(appended[0].sheet, 'config_conceptos_gasto');

  await assert.rejects(() => service.addToTable('proveedores_gasto', { nombre: 'railway' }, 'admin'), /ya existe/);
  await assert.rejects(() => service.updateInTable('conceptos_reparto', 'CON-2', { nombre: 'RAILWAY' }, 'admin'), /ya existe/);
});

test('getFullConfig expone las listas oficiales y dominios de reparto', async () => {
  const { service } = loadConfigService([{ id: 'X-1', nombre: 'Uno', dominio: 'Inversión', categoria: 'Cat', subcategoria: 'Sub' }]);
  const config = await service.getFullConfig();
  assert.deepEqual(config.conceptos_gasto, ['Uno']);
  assert.deepEqual(config.proveedores_reparto, ['Uno']);
  assert.deepEqual(config.categorias_reparto, { Cat: ['Sub'] });
  assert.equal(config.dominios_reparto.Cat, 'Inversión');
});
