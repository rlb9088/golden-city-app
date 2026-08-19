const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const ExcelJS = require('exceljs');
const { nowLima, todayLima } = require('../config/timezone');
const { paginateItems } = require('../utils/pagination');
const { createPrefixedId } = require('../utils/id');
const { BadRequestError, NotFoundError } = require('../utils/appError');

const SHEET_NAME = 'clientes';
const HISTORY_SHEET_NAME = 'clientes_historial';

const HEADERS = [
  'id',
  'estado',
  'nombre',
  'player_id',
  'fecha_alta',
  'origen',
  'dni',
  'fecha_nacimiento',
  'edad',
  'correos_json',
  'telefonos_json',
  'ips_json',
  'ciudad',
  'ciudad_ip',
  'ip_city_status',
  'accesos_json',
  'calidad_json',
  'raw_json',
  'creado_en',
  'actualizado_en',
  'actualizado_por',
];

const HISTORY_HEADERS = ['id', 'cliente_id', 'action', 'user', 'timestamp', 'before_json', 'after_json', 'source'];
const EXCEL_HEADER_MAP = {
  Nombre: 'nombre',
  player_id: 'player_id',
  Fecha_alta: 'fecha_alta',
  Origen: 'origen',
  DNI: 'dni',
  Fecha_nacimiento: 'fecha_nacimiento',
  Edad: 'edad',
  IP: 'ips',
  Ciudad: 'ciudad',
};

function repairMojibake(value) {
  return String(value ?? '')
    .replace(/Ã([\u0080-\u00BF])/g, (_, suffix) => Buffer.from([0xC3, suffix.charCodeAt(0)]).toString('utf8'))
    .replace(/Â([\u0080-\u00BF])/g, (_, suffix) => Buffer.from([0xC2, suffix.charCodeAt(0)]).toString('utf8'))
    .replace(/â€™/g, "'")
    .replace(/â€“|â€”/g, '-');
}

function normalizeText(value) {
  return repairMojibake(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function normalizeLookup(value) {
  return normalizeText(value).toLowerCase();
}

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function compactUnique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flat()) {
    const text = normalizeText(value);
    if (!text) continue;
    const key = normalizeLookup(text);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getNumberedValues(input, prefix, maximum = 4) {
  const values = [];
  for (const [key, value] of Object.entries(input || {})) {
    const normalizedKey = normalizeHeader(key);
    for (let index = 1; index <= maximum; index += 1) {
      if (normalizedKey === `${prefix}${index}`) values.push(value);
    }
  }
  return values;
}

function collectEmails(input) {
  return compactUnique(compactUnique([
    input.correos || [],
    input.Correo_1,
    input.Correo_2,
    input.Correo_3,
    input.correo_1,
    input.correo_2,
    input.correo_3,
    getNumberedValues(input, 'correo', 6),
  ]).map(normalizeEmail).filter(Boolean));
}

function normalizePhone(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 9) return `+51${digits}`;
  if (digits.length === 11 && digits.startsWith('51')) return `+${digits}`;
  if (digits.length > 9 && digits.startsWith('51')) return `+${digits}`;
  if (text.startsWith('+')) return `+${digits}`;
  return digits;
}

function collectPhones(input) {
  return compactUnique(compactUnique([
    input.telefonos || [],
    input['Teléfono_1'],
    input['Teléfono_2'],
    input['Teléfono_3'],
    input['Teléfono_4'],
    input.Telefono_1,
    input.Telefono_2,
    input.Telefono_3,
    input.Telefono_4,
    getNumberedValues(input, 'telefono', 8),
  ]).map(normalizePhone).filter(Boolean));
}

function collectIps(input) {
  const rawIps = Array.isArray(input.ips) ? input.ips : [input.ips, input.IP, input.ip];
  return compactUnique(rawIps.flatMap((value) => normalizeText(value).split(/[;,\s]+/)))
    .filter((value) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value))
    .filter((value) => value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255));
}

function normalizeDateOnly(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^\d{4,5}(?:\.0+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 1 && serial <= 100000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    }
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (local) return `${local[3]}-${local[2]}-${local[1]}`;
  return text;
}

function calculateAge(dateOfBirth, asOfDate = todayLima()) {
  const birth = normalizeDateOnly(dateOfBirth);
  const today = normalizeDateOnly(asOfDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return '';
  const [birthYear, birthMonth, birthDay] = birth.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  let age = todayYear - birthYear;
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) age -= 1;
  return age >= 0 && age <= 130 ? age : '';
}

function normalizeAccesses(input) {
  const provided = input.accesos && typeof input.accesos === 'object' ? input.accesos : {};
  return {
    ...provided,
    slots: {
      usuario: normalizeText(input['Usuario slots'] ?? input.usuario_slots ?? provided.slots?.usuario),
      id: normalizeText(input['ID slots'] ?? input.id_slots ?? provided.slots?.id),
      clave: normalizeText(input['Clave slots'] ?? input.clave_slots ?? provided.slots?.clave),
    },
    apueston: {
      usuario: normalizeText(input['Usuario apueston'] ?? input.usuario_apueston ?? provided.apueston?.usuario),
      id: normalizeText(input['ID apueston'] ?? input.id_apueston ?? provided.apueston?.id),
      clave: normalizeText(input['Clave apueston'] ?? input.clave_apueston ?? provided.apueston?.clave),
      link_auth: normalizeText(input['Link auth apueston'] ?? input.link_auth_apueston ?? provided.apueston?.link_auth),
    },
  };
}

function resolveMappedField(input, field) {
  if (Object.prototype.hasOwnProperty.call(input, field)) return input[field];
  const excelHeader = Object.entries(EXCEL_HEADER_MAP).find(([, mapped]) => mapped === field)?.[0];
  return excelHeader ? input[excelHeader] : undefined;
}

function inferIpCity(input, ips) {
  const explicit = normalizeText(input.ciudad_ip);
  if (explicit) return { ciudad_ip: explicit, ip_city_status: 'manual' };
  const ciudad = normalizeText(input.ciudad ?? input.Ciudad);
  if (ciudad && ips.length > 0) return { ciudad_ip: ciudad, ip_city_status: 'from_existing_city' };
  if (ips.length > 0) return { ciudad_ip: '', ip_city_status: 'pending_geoip' };
  return { ciudad_ip: '', ip_city_status: 'no_ip' };
}

function normalizeClienteInput(input = {}, existing = null, user = 'system') {
  const source = input && typeof input === 'object' ? input : {};
  const ips = collectIps(source);
  const existingReadable = parseReadableCliente(existing);
  const effectiveIps = ips.length > 0 ? ips : existingReadable.ips || [];
  const ipCity = ips.length > 0 || !existing ? inferIpCity(source, effectiveIps) : {
    ciudad_ip: normalizeText(existing?.ciudad_ip),
    ip_city_status: normalizeText(existing?.ip_city_status),
  };
  const now = nowLima();
  const createdAt = existing?.creado_en || now;

  const record = {
    id: existing?.id || createPrefixedId('CLI'),
    estado: normalizeText(source.estado ?? existing?.estado) || 'activo',
    nombre: normalizeText(resolveMappedField(source, 'nombre') ?? existing?.nombre),
    player_id: normalizeText(resolveMappedField(source, 'player_id') ?? existing?.player_id),
    fecha_alta: normalizeDateOnly(resolveMappedField(source, 'fecha_alta') ?? existing?.fecha_alta),
    origen: normalizeText(resolveMappedField(source, 'origen') ?? existing?.origen),
    dni: normalizeText(resolveMappedField(source, 'dni') ?? existing?.dni),
    fecha_nacimiento: normalizeDateOnly(resolveMappedField(source, 'fecha_nacimiento') ?? existing?.fecha_nacimiento),
    edad: normalizeText(resolveMappedField(source, 'edad') ?? existing?.edad),
    correos_json: JSON.stringify(collectEmails({ ...existingReadable, ...source })),
    telefonos_json: JSON.stringify(collectPhones({ ...existingReadable, ...source })),
    ips_json: JSON.stringify(effectiveIps),
    ciudad: normalizeText(resolveMappedField(source, 'ciudad') ?? existing?.ciudad),
    ciudad_ip: ipCity.ciudad_ip || normalizeText(existing?.ciudad_ip),
    ip_city_status: ipCity.ip_city_status || normalizeText(existing?.ip_city_status),
    accesos_json: JSON.stringify(normalizeAccesses({ ...existingReadable, ...source })),
    calidad_json: existing?.calidad_json || JSON.stringify({ status: 'pending_review' }),
    raw_json: JSON.stringify(source.raw || source),
    creado_en: createdAt,
    actualizado_en: now,
    actualizado_por: normalizeText(user) || 'system',
  };

  if (!record.nombre && !record.player_id && !record.dni) {
    throw new BadRequestError('El cliente necesita nombre, player_id o DNI.', {
      context: { entity: 'clientes' },
    });
  }

  return record;
}

function parseReadableCliente(row = {}) {
  if (!row) return {};
  const { _rowIndex, ...rest } = row;
  return {
    ...rest,
    correos: parseJson(row.correos_json, []),
    telefonos: parseJson(row.telefonos_json, []),
    ips: parseJson(row.ips_json, []),
    accesos: parseJson(row.accesos_json, {}),
    calidad: parseJson(row.calidad_json, {}),
    raw: parseJson(row.raw_json, {}),
  };
}

function normalizeForRead(row) {
  const readable = parseReadableCliente(row);
  const raw = readable.raw && typeof readable.raw === 'object' ? readable.raw : {};
  const source = { ...raw, ...readable };
  const fechaNacimiento = normalizeDateOnly(readable.fecha_nacimiento || raw.Fecha_nacimiento);

  return {
    ...readable,
    nombre: normalizeText(readable.nombre || raw.Nombre),
    fecha_alta: normalizeDateOnly(readable.fecha_alta || raw.Fecha_alta),
    fecha_nacimiento: fechaNacimiento,
    edad: calculateAge(fechaNacimiento),
    correos: collectEmails(source),
    telefonos: collectPhones(source),
    ips: collectIps(source),
    ciudad: normalizeText(readable.ciudad || raw.Ciudad),
    ciudad_ip: normalizeText(readable.ciudad_ip),
    accesos: normalizeAccesses(source),
  };
}

function findDuplicate(rows, candidate, currentId = null) {
  const playerId = normalizeLookup(candidate.player_id);
  const dni = normalizeLookup(candidate.dni);
  return rows.find((row) => row.id !== currentId && (
    (playerId && normalizeLookup(row.player_id) === playerId)
    || (dni && normalizeLookup(row.dni) === dni)
  )) || null;
}

function matchesText(row, query) {
  const needle = normalizeLookup(query);
  if (!needle) return true;
  const readable = normalizeForRead(row);
  const haystack = [
    readable.id,
    readable.nombre,
    readable.player_id,
    readable.dni,
    readable.ciudad,
    readable.ciudad_ip,
    ...(readable.correos || []),
    ...(readable.telefonos || []),
    ...(readable.ips || []),
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

function filterRows(rows, filters = {}) {
  return rows.filter((row) => matchesText(row, filters.q)
    && (!filters.estado || normalizeLookup(row.estado) === normalizeLookup(filters.estado))
    && (!filters.ciudad || normalizeLookup(row.ciudad).includes(normalizeLookup(filters.ciudad))));
}

function buildHistoryEntry(action, clienteId, user, before, after, source = 'app') {
  return {
    id: createPrefixedId('CLH'),
    cliente_id: clienteId,
    action,
    user: user || 'system',
    timestamp: nowLima(),
    before_json: before ? JSON.stringify(before) : '',
    after_json: after ? JSON.stringify(after) : '',
    source,
  };
}

async function logHistory(action, clienteId, user, before, after, source = 'app') {
  const entry = buildHistoryEntry(action, clienteId, user, before, after, source);
  await repo.append(HISTORY_SHEET_NAME, entry, HISTORY_HEADERS);
  return entry;
}

async function getPagedAndFiltered(filters = {}, limit, offset) {
  const rows = await repo.getAll(SHEET_NAME);
  const filtered = filterRows(rows, filters)
    .sort((left, right) => String(right.actualizado_en || '').localeCompare(String(left.actualizado_en || '')))
    .map(normalizeForRead);
  return paginateItems(filtered, limit, offset);
}

async function getById(id) {
  const row = await repo.findById(SHEET_NAME, id);
  return row ? normalizeForRead(row) : null;
}

async function create(input, user = 'system', source = 'app') {
  const rows = await repo.getAll(SHEET_NAME);
  const record = normalizeClienteInput(input, null, user);
  const duplicate = findDuplicate(rows, record);
  if (duplicate) {
    throw new BadRequestError('Ya existe un cliente con el mismo player_id o DNI.', {
      context: { entity: 'clientes', duplicateId: duplicate.id },
    });
  }
  await repo.append(SHEET_NAME, record, HEADERS);
  const readable = normalizeForRead(record);
  await logHistory('create', record.id, user, null, readable, source);
  await audit.log('create', 'clientes', user, readable);
  return readable;
}

async function update(id, patch, user = 'system') {
  const rows = await repo.getAll(SHEET_NAME);
  const existing = rows.find((row) => row.id === id);
  if (!existing) {
    throw new NotFoundError('No se encontro el cliente solicitado.', { context: { id } });
  }
  const nextRecord = normalizeClienteInput(patch, existing, user);
  const duplicate = findDuplicate(rows, nextRecord, id);
  if (duplicate) {
    throw new BadRequestError('Ya existe otro cliente con el mismo player_id o DNI.', {
      context: { entity: 'clientes', duplicateId: duplicate.id },
    });
  }
  await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
  const before = normalizeForRead(existing);
  const after = normalizeForRead(nextRecord);
  await logHistory('update', id, user, before, after, 'app');
  await audit.log('update', 'clientes', user, { before, after, changes: patch });
  return after;
}

async function importBatch(items, user = 'system', source = 'bulk_import') {
  const rows = await repo.getAll(SHEET_NAME);
  const existingByPlayerId = new Map(rows.filter((row) => normalizeText(row.player_id)).map((row) => [normalizeLookup(row.player_id), row]));
  const existingByDni = new Map(rows.filter((row) => normalizeText(row.dni)).map((row) => [normalizeLookup(row.dni), row]));
  const created = [];
  const updated = [];
  const createdRecords = [];
  const historyEntries = [];

  for (const item of items) {
    const probe = normalizeClienteInput(item, null, user);
    const existing = (probe.player_id && existingByPlayerId.get(normalizeLookup(probe.player_id)))
      || (probe.dni && existingByDni.get(normalizeLookup(probe.dni)))
      || null;

    if (existing) {
      const nextRecord = normalizeClienteInput(item, existing, user);
      if (!existing._rowIndex) {
        const createdIndex = createdRecords.findIndex((record) => record.id === existing.id);
        if (createdIndex >= 0) {
          createdRecords[createdIndex] = nextRecord;
          created[createdIndex] = normalizeForRead(nextRecord);
          const historyIndex = historyEntries.findIndex((entry) => entry.cliente_id === existing.id && entry.action === 'create');
          if (historyIndex >= 0) {
            historyEntries[historyIndex] = buildHistoryEntry('create', existing.id, user, null, created[createdIndex], source);
          }
        }
        existingByPlayerId.set(normalizeLookup(nextRecord.player_id), nextRecord);
        existingByDni.set(normalizeLookup(nextRecord.dni), nextRecord);
        continue;
      }
      await repo.update(SHEET_NAME, existing._rowIndex, nextRecord, HEADERS);
      const before = normalizeForRead(existing);
      const after = normalizeForRead(nextRecord);
      historyEntries.push(buildHistoryEntry('update', existing.id, user, before, after, source));
      updated.push(after);
      existingByPlayerId.set(normalizeLookup(nextRecord.player_id), nextRecord);
      existingByDni.set(normalizeLookup(nextRecord.dni), nextRecord);
      continue;
    }

    const readable = normalizeForRead(probe);
    createdRecords.push(probe);
    historyEntries.push(buildHistoryEntry('create', probe.id, user, null, readable, source));
    created.push(readable);
    existingByPlayerId.set(normalizeLookup(probe.player_id), probe);
    existingByDni.set(normalizeLookup(probe.dni), probe);
  }

  if (createdRecords.length > 0) {
    await repo.appendBatch(SHEET_NAME, createdRecords);
  }

  if (historyEntries.length > 0) {
    await repo.appendBatch(HISTORY_SHEET_NAME, historyEntries);
  }

  await audit.log('import', 'clientes', user, {
    source,
    created: created.length,
    updated: updated.length,
  });

  return { created, updated, count: created.length + updated.length };
}

async function getHistory(clienteId) {
  const rows = await repo.getAll(HISTORY_SHEET_NAME);
  return rows
    .filter((row) => row.cliente_id === clienteId)
    .sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || '')))
    .map((row) => ({
      id: row.id,
      cliente_id: row.cliente_id,
      action: row.action,
      user: row.user,
      timestamp: row.timestamp,
      before: parseJson(row.before_json, null),
      after: parseJson(row.after_json, null),
      source: row.source,
    }));
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const EXPORT_COLUMNS = [
  ['id', 'ID'],
  ['estado', 'Estado'],
  ['nombre', 'Nombre'],
  ['player_id', 'Player ID'],
  ['fecha_alta', 'Fecha de alta'],
  ['origen', 'Origen'],
  ['dni', 'DNI'],
  ['fecha_nacimiento', 'Fecha de nacimiento'],
  ['edad', 'Edad'],
  ['correo_1', 'Correo 1'],
  ['correo_2', 'Correo 2'],
  ['correo_3', 'Correo 3'],
  ['telefono_1', 'Telefono 1'],
  ['telefono_2', 'Telefono 2'],
  ['telefono_3', 'Telefono 3'],
  ['telefono_4', 'Telefono 4'],
  ['ips', 'IPs'],
  ['ciudad', 'Ciudad declarada'],
  ['ciudad_ip', 'Ciudad IP'],
  ['ip_city_status', 'Estado ciudad IP'],
  ['slots_usuario', 'Slots usuario'],
  ['slots_id', 'Slots ID'],
  ['slots_clave', 'Slots clave'],
  ['apueston_usuario', 'Apueston usuario'],
  ['apueston_id', 'Apueston ID'],
  ['apueston_clave', 'Apueston clave'],
  ['apueston_link_auth', 'Apueston link auth'],
  ['calidad', 'Calidad'],
  ['actualizado_en', 'Ultima actualizacion'],
];

function formatDateForExport(value) {
  const normalized = normalizeDateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function dateForWorkbook(value) {
  const normalized = normalizeDateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return new Date(`${normalized}T00:00:00Z`);
}

function formatPhoneForExport(value) {
  const normalized = normalizePhone(value);
  if (/^\+51\d{9}$/.test(normalized)) return `+51 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  return normalized;
}

function safeSpreadsheetText(value) {
  // XLSX stores regular string cells as text, so phone numbers and IDs keep
  // their exact value without Excel interpreting leading plus signs as formulas.
  return String(value ?? '');
}

function excelColumnName(index) {
  let value = index;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function buildExportRecord(row) {
  const correos = row.correos || [];
  const telefonos = row.telefonos || [];
  const accesos = row.accesos || {};
  const slots = accesos.slots || {};
  const apueston = accesos.apueston || {};
  const quality = row.calidad || {};

  return {
    id: row.id,
    estado: row.estado,
    nombre: row.nombre,
    player_id: row.player_id,
    fecha_alta: row.fecha_alta,
    origen: row.origen,
    dni: row.dni,
    fecha_nacimiento: row.fecha_nacimiento,
    edad: row.edad,
    correo_1: correos[0] || '',
    correo_2: correos[1] || '',
    correo_3: correos[2] || '',
    telefono_1: formatPhoneForExport(telefonos[0]),
    telefono_2: formatPhoneForExport(telefonos[1]),
    telefono_3: formatPhoneForExport(telefonos[2]),
    telefono_4: formatPhoneForExport(telefonos[3]),
    ips: (row.ips || []).join('; '),
    ciudad: row.ciudad,
    ciudad_ip: row.ciudad_ip,
    ip_city_status: row.ip_city_status,
    slots_usuario: slots.usuario || '',
    slots_id: slots.id || '',
    slots_clave: slots.clave || '',
    apueston_usuario: apueston.usuario || '',
    apueston_id: apueston.id || '',
    apueston_clave: apueston.clave || '',
    apueston_link_auth: apueston.link_auth || '',
    calidad: [quality.status, quality.score ? `${quality.score}/100` : '', ...(quality.issues || []), ...(quality.warnings || [])]
      .filter(Boolean)
      .join(' | '),
    actualizado_en: row.actualizado_en,
  };
}

function toExportRows(rows) {
  const columns = EXPORT_COLUMNS.map(([key]) => key);
  const readable = rows.map(normalizeForRead).map(buildExportRecord);
  return {
    columns,
    readable,
    csv: [
      `\uFEFF${EXPORT_COLUMNS.map(([, label]) => escapeCsvCell(label)).join(';')}`,
      ...readable.map((row) => columns.map((column) => escapeCsvCell(
        column === 'fecha_alta' || column === 'fecha_nacimiento'
          ? formatDateForExport(row[column])
          : row[column],
      )).join(';')),
    ].join('\r\n'),
  };
}

async function buildXlsxExport(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Golden City';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Clientes', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = EXPORT_COLUMNS.map(([key, header]) => ({ key, header, width: Math.min(Math.max(header.length + 2, 14), 32) }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B1D3A' } };
  sheet.autoFilter = { from: 'A1', to: `${excelColumnName(EXPORT_COLUMNS.length)}1` };

  rows.map(normalizeForRead).map(buildExportRecord).forEach((record, index) => {
    const row = sheet.addRow(EXPORT_COLUMNS.map(([key]) => {
      if (key === 'fecha_alta' || key === 'fecha_nacimiento') return dateForWorkbook(record[key]) || '';
      if (key === 'edad') return record.fecha_nacimiento ? { formula: `IF(H${index + 2}=\"\",\"\",DATEDIF(H${index + 2},TODAY(),\"Y\"))` } : '';
      return safeSpreadsheetText(record[key]);
    }));
    row.getCell(5).numFmt = 'dd/mm/yyyy';
    row.getCell(8).numFmt = 'dd/mm/yyyy';
  });

  sheet.getColumn(3).width = 34;
  sheet.getColumn(17).width = 44;
  sheet.getColumn(27).width = 54;
  sheet.getColumn(28).width = 30;
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });
  return workbook.xlsx.writeBuffer();
}

async function exportData(format = 'csv') {
  const rows = await repo.getAll(SHEET_NAME);
  const { csv } = toExportRows(rows);
  if (format === 'xls') {
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'clientes.xlsx',
      body: await buildXlsxExport(rows),
    };
  }
  return { contentType: 'text/csv; charset=utf-8', filename: 'clientes.csv', body: csv };
}

function getRepairableFields(row) {
  return {
    nombre: row.nombre,
    fecha_alta: row.fecha_alta,
    fecha_nacimiento: row.fecha_nacimiento,
    correos_json: row.correos_json,
    telefonos_json: row.telefonos_json,
    ips_json: row.ips_json,
    ciudad: row.ciudad,
    accesos_json: row.accesos_json,
  };
}

async function repairImportedData(user = 'system_data_repair', options = {}) {
  const rows = await repo.getAll(SHEET_NAME);
  const updates = [];
  const historyEntries = [];

  for (const row of rows) {
    const readable = normalizeForRead(row);
    const next = {
      ...row,
      nombre: readable.nombre,
      fecha_alta: readable.fecha_alta,
      fecha_nacimiento: readable.fecha_nacimiento,
      correos_json: JSON.stringify(readable.correos || []),
      telefonos_json: JSON.stringify(readable.telefonos || []),
      ips_json: JSON.stringify(readable.ips || []),
      ciudad: readable.ciudad,
      accesos_json: JSON.stringify(readable.accesos || {}),
      actualizado_en: nowLima(),
      actualizado_por: user,
    };
    const before = getRepairableFields(row);
    const after = getRepairableFields(next);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    updates.push({ rowIndex: row._rowIndex, data: next });
    historyEntries.push(buildHistoryEntry('data_repair', row.id, user, before, after, 'clientes_data_repair'));
  }

  if (!options.dryRun && updates.length > 0) {
    await repo.updateBatch(SHEET_NAME, updates, HEADERS);
    await repo.appendBatch(HISTORY_SHEET_NAME, historyEntries);
    await audit.log('update', 'clientes_data_repair', user, {
      reviewed: rows.length,
      updated: updates.length,
      fields: ['nombre', 'fecha_alta', 'fecha_nacimiento', 'correos', 'telefonos', 'ips', 'ciudad', 'accesos'],
    });
  }

  return {
    reviewed: rows.length,
    updated: updates.length,
    dryRun: Boolean(options.dryRun),
  };
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
}

function getAccessValues(accesos = {}) {
  return Object.values(accesos)
    .filter((value) => value && typeof value === 'object')
    .flatMap((value) => Object.values(value));
}

function buildQualityReport(readable, ipLookup = {}) {
  const issues = [];
  const warnings = [];
  const correos = readable.correos || [];
  const telefonos = readable.telefonos || [];
  const ips = readable.ips || [];
  const accesos = readable.accesos || {};

  if (!normalizeText(readable.nombre)) issues.push('missing_nombre');
  if (!normalizeText(readable.player_id) && !normalizeText(readable.dni)) issues.push('missing_player_id_and_dni');
  if (correos.length === 0 && telefonos.length === 0) issues.push('missing_contact');
  if (correos.some((email) => !isLikelyEmail(email))) warnings.push('unusual_email_format');
  if (telefonos.some((phone) => {
    const digits = normalizeText(phone).replace(/\D/g, '');
    return digits.length < 7 || digits.length > 15;
  })) warnings.push('unusual_phone_length');
  if (ips.length > 1) warnings.push('multiple_ips');
  if (ips.length > 0 && !normalizeText(readable.ciudad_ip)) warnings.push('missing_ip_city');
  if (!normalizeText(readable.ciudad)) warnings.push('missing_declared_city');
  if (getAccessValues(accesos).every((value) => !normalizeText(value))) warnings.push('missing_accesses');

  const geoCities = ips
    .map((ip) => ipLookup[ip]?.city)
    .map(normalizeText)
    .filter(Boolean);
  const cityCounts = new Map();
  geoCities.forEach((city) => cityCounts.set(city, (cityCounts.get(city) || 0) + 1));
  const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return {
    status: issues.length > 0 ? 'review' : warnings.length > 0 ? 'warning' : 'ok',
    score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 8)),
    issues,
    warnings,
    checked_at: nowLima(),
    geoip: {
      checked_ips: Object.keys(ipLookup).length,
      matched_cities: geoCities.length,
      top_city: topCity,
    },
  };
}

async function fetchIpCity(ip) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,ip,city,region,country,message`, {
      signal: controller.signal,
    });
    if (!response.ok) return { ip, status: 'http_error' };
    const data = await response.json();
    if (!data.success) return { ip, status: 'not_found', message: data.message || '' };
    return {
      ip,
      status: 'ok',
      city: normalizeText(data.city),
      region: normalizeText(data.region),
      country: normalizeText(data.country),
    };
  } catch (error) {
    return { ip, status: 'error', message: error?.message || 'geoip_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function runQualityReview(user = 'system', options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 300), 300));
  const rows = await repo.getAll(SHEET_NAME);
  const candidates = rows
    .filter((row) => {
      if (options.onlyPending === false) return true;
      const readable = normalizeForRead(row);
      return normalizeText(readable.ip_city_status) === 'pending_geoip'
        || !normalizeText(readable.calidad?.checked_at);
    })
    .slice(0, limit);

  const uniqueIps = compactUnique(candidates.flatMap((row) => normalizeForRead(row).ips || []));
  const ipResults = {};
  for (const ip of uniqueIps) {
    ipResults[ip] = await fetchIpCity(ip);
  }

  const updates = [];
  const historyEntries = [];
  for (const row of candidates) {
    const before = normalizeForRead(row);
    const ipLookup = Object.fromEntries((before.ips || []).map((ip) => [ip, ipResults[ip]]).filter(([, result]) => result));
    const quality = buildQualityReport(before, ipLookup);
    const geoCity = quality.geoip.top_city;
    const next = {
      ...row,
      ciudad_ip: normalizeText(row.ciudad_ip) || geoCity,
      ip_city_status: geoCity
        ? 'geoip'
        : (before.ips || []).length > 0 ? 'pending_geoip' : 'no_ip',
      calidad_json: JSON.stringify(quality),
      actualizado_en: nowLima(),
      actualizado_por: user || 'system',
    };
    updates.push({ rowIndex: row._rowIndex, data: next });
    const after = normalizeForRead(next);
    historyEntries.push(buildHistoryEntry('quality_review', row.id, user, before, after, 'quality_review'));
  }

  if (updates.length > 0) {
    await repo.updateBatch(SHEET_NAME, updates, HEADERS);
  }
  if (historyEntries.length > 0) {
    await repo.appendBatch(HISTORY_SHEET_NAME, historyEntries);
  }
  await audit.log('update', 'clientes_quality', user, {
    reviewed: updates.length,
    geoipChecked: uniqueIps.length,
  });

  return {
    reviewed: updates.length,
    geoipChecked: uniqueIps.length,
    resolvedCities: Object.values(ipResults).filter((result) => result?.city).length,
  };
}

module.exports = {
  HEADERS,
  HISTORY_HEADERS,
  normalizePhone,
  normalizeDateOnly,
  calculateAge,
  collectIps,
  normalizeClienteInput,
  normalizeForRead,
  getPagedAndFiltered,
  getById,
  create,
  update,
  importBatch,
  getHistory,
  exportData,
  repairImportedData,
  runQualityReview,
};
