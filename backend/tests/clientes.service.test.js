const test = require('node:test');
const assert = require('node:assert/strict');

function loadClientesService({ rows = [], historyRows = [], append, appendBatch, update, auditLog }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const servicePath = require.resolve('../services/clientes.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll: async (sheetName) => (sheetName === 'clientes_historial' ? historyRows : rows),
      findById: async (sheetName, id) => rows.find((row) => sheetName === 'clientes' && row.id === id) || null,
      append: append || (async () => ({})),
      appendBatch: appendBatch || (async () => ({})),
      update: update || (async () => ({})),
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: auditLog || (async () => ({})),
    },
  };

  return require('../services/clientes.service');
}

test('normaliza telefonos peruanos e IPs desde datos informales del Excel', () => {
  const service = loadClientesService({});
  const record = service.normalizeClienteInput({
    Nombre: ' Ana ',
    player_id: 'P1',
    'Teléfono_1': '+51 959 199 901',
    Telefono_2: '51931712702',
    IP: ';179.6.6.158 ; 999.1.1.1 ; 190.232.110.94',
    Ciudad: 'Lima',
  }, null, 'tester');

  assert.deepStrictEqual(JSON.parse(record.telefonos_json), ['+51959199901', '+51931712702']);
  assert.deepStrictEqual(JSON.parse(record.ips_json), ['179.6.6.158', '190.232.110.94']);
  assert.equal(record.ciudad_ip, 'Lima');
  assert.equal(record.ip_city_status, 'from_existing_city');
});

test('create guarda cliente, historial y auditoria', async () => {
  const appended = [];
  const audits = [];
  const service = loadClientesService({
    append: async (sheetName, data) => {
      appended.push({ sheetName, data });
      return { status: 'success' };
    },
    auditLog: async (...args) => {
      audits.push(args);
      return { id: 'AUD-1' };
    },
  });

  const result = await service.create({
    nombre: 'Ana',
    player_id: 'P1',
    telefonos: ['959 199 901'],
  }, 'admin');

  assert.equal(result.nombre, 'Ana');
  assert.deepStrictEqual(result.telefonos, ['+51959199901']);
  assert.equal(appended[0].sheetName, 'clientes');
  assert.equal(appended[1].sheetName, 'clientes_historial');
  assert.equal(audits[0][0], 'create');
  assert.equal(audits[0][1], 'clientes');
});

test('importBatch actualiza existentes por player_id y crea nuevos', async () => {
  const rows = [
    {
      _rowIndex: 2,
      id: 'CLI-1',
      estado: 'activo',
      nombre: 'Ana',
      player_id: 'P1',
      dni: '',
      correos_json: '[]',
      telefonos_json: '[]',
      ips_json: '[]',
      accesos_json: '{}',
      raw_json: '{}',
      creado_en: '2026-01-01T00:00:00',
      actualizado_en: '2026-01-01T00:00:00',
    },
  ];
  const appended = [];
  const updated = [];
  const service = loadClientesService({
    rows,
    append: async (sheetName, data) => {
      appended.push({ sheetName, data });
      return { status: 'success' };
    },
    appendBatch: async (sheetName, data) => {
      data.forEach((row) => appended.push({ sheetName, data: row }));
      return { status: 'success' };
    },
    update: async (sheetName, rowIndex, data) => {
      updated.push({ sheetName, rowIndex, data });
      return { status: 'success' };
    },
  });

  const result = await service.importBatch([
    { Nombre: 'Ana Maria', player_id: 'P1', DNI: '123' },
    { Nombre: 'Luis', player_id: 'P2' },
  ], 'admin', 'xlsx');

  assert.equal(result.updated.length, 1);
  assert.equal(result.created.length, 1);
  assert.equal(updated[0].sheetName, 'clientes');
  assert.equal(updated[0].rowIndex, 2);
  assert.equal(appended.some((call) => call.sheetName === 'clientes'), true);
  assert.equal(appended.filter((call) => call.sheetName === 'clientes_historial').length, 2);
});
