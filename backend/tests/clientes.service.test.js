const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

function loadClientesService({ rows = [], historyRows = [], append, appendBatch, update, updateBatch, auditLog }) {
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
      updateBatch: updateBatch || (async () => ({})),
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

test('repara texto mal codificado, fechas seriales de Excel y calcula edad dinamica', () => {
  const service = loadClientesService({});
  const readable = service.normalizeForRead({
    nombre: 'IsaÃ\u00adas SebastiÃ¡n Arellano Camacho',
    fecha_alta: '45369',
    fecha_nacimiento: '38162',
    correos_json: '[]',
    telefonos_json: '[]',
    ips_json: '[]',
    accesos_json: '{}',
    calidad_json: '{}',
    raw_json: JSON.stringify({ 'TelÃ©fono_1': '+51 959 199 901' }),
  });

  assert.equal(readable.nombre, 'Isaías Sebastián Arellano Camacho');
  assert.equal(readable.fecha_alta, '2024-03-18');
  assert.equal(readable.fecha_nacimiento, '2004-06-24');
  assert.deepStrictEqual(readable.telefonos, ['+51959199901']);
  assert.equal(service.calculateAge('2000-08-20', '2026-08-19'), 25);
  assert.equal(service.calculateAge('2000-08-19', '2026-08-19'), 26);
});

test('reparacion de clientes actualiza solo campos derivados y deja historial auditable', async () => {
  const updates = [];
  const histories = [];
  const audits = [];
  const service = loadClientesService({
    rows: [{
      _rowIndex: 2,
      id: 'CLI-1',
      nombre: 'IsaÃ\u00adas',
      fecha_alta: '45369',
      fecha_nacimiento: '38162',
      correos_json: '[]',
      telefonos_json: '[]',
      ips_json: '[]',
      ciudad: '',
      accesos_json: '{}',
      calidad_json: '{}',
      raw_json: JSON.stringify({ 'TelÃ©fono_1': '+51 959 199 901' }),
    }],
    updateBatch: async (sheetName, data) => updates.push({ sheetName, data }),
    appendBatch: async (sheetName, data) => histories.push({ sheetName, data }),
    auditLog: async (...args) => audits.push(args),
  });

  const preview = await service.repairImportedData('repair', { dryRun: true });
  assert.deepStrictEqual(preview, { reviewed: 1, updated: 1, dryRun: true });
  assert.equal(updates.length, 0);

  const result = await service.repairImportedData('repair');
  assert.deepStrictEqual(result, { reviewed: 1, updated: 1, dryRun: false });
  assert.equal(updates[0].sheetName, 'clientes');
  assert.equal(JSON.parse(updates[0].data[0].data.telefonos_json)[0], '+51959199901');
  assert.equal(histories[0].data[0].action, 'data_repair');
  assert.equal(audits[0][1], 'clientes_data_repair');
});

test('exporta un XLSX real con contactos y accesos en columnas legibles', async () => {
  const service = loadClientesService({
    rows: [{
      id: 'CLI-1',
      estado: 'activo',
      nombre: 'IsaÃ\u00adas',
      fecha_alta: '45369',
      fecha_nacimiento: '38162',
      correos_json: '["uno@example.com"]',
      telefonos_json: '[]',
      ips_json: '["179.6.6.158"]',
      ciudad: 'Lima',
      ciudad_ip: 'Lima',
      accesos_json: '{}',
      calidad_json: '{}',
      raw_json: JSON.stringify({
        'TelÃ©fono_1': '+51 959 199 901',
        'Usuario apueston': 'isa01',
        'ID apueston': '2048001',
      }),
    }],
  });

  const output = await service.exportData('xls');
  assert.equal(output.filename, 'clientes.xlsx');
  assert.equal(Buffer.from(output.body).subarray(0, 2).toString(), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(output.body);
  const sheet = workbook.getWorksheet('Clientes');
  assert.equal(sheet.getRow(1).getCell(10).value, 'Correo 1');
  assert.equal(sheet.getRow(2).getCell(3).value, 'Isaías');
  assert.equal(sheet.getRow(2).getCell(13).value, '+51 959 199 901');
  assert.equal(sheet.getRow(2).getCell(24).value, 'isa01');
  assert.equal(sheet.getRow(2).getCell(9).value.formula, 'IF(H2="","",DATEDIF(H2,TODAY(),"Y"))');
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
