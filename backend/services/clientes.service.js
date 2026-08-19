const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const { nowLima } = require('../config/timezone');
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

function normalizeText(value) {
  return String(value ?? '').trim();
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

function collectEmails(input) {
  return compactUnique([
    input.correos || [],
    input.Correo_1,
    input.Correo_2,
    input.Correo_3,
    input.correo_1,
    input.correo_2,
    input.correo_3,
  ]).map(normalizeEmail).filter(Boolean);
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
  return compactUnique([
    input.telefonos || [],
    input['Teléfono_1'],
    input['Teléfono_2'],
    input['Teléfono_3'],
    input['Teléfono_4'],
    input.Telefono_1,
    input.Telefono_2,
    input.Telefono_3,
    input.Telefono_4,
  ]).map(normalizePhone).filter(Boolean);
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
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (local) return `${local[3]}-${local[2]}-${local[1]}`;
  return text;
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
    raw: parseJson(row.raw_json, {}),
  };
}

function normalizeForRead(row) {
  return parseReadableCliente(row);
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
  const text = Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toExportRows(rows) {
  const columns = ['id', 'estado', 'nombre', 'player_id', 'fecha_alta', 'origen', 'dni', 'fecha_nacimiento', 'edad', 'correos', 'telefonos', 'ips', 'ciudad', 'ciudad_ip', 'ip_city_status', 'accesos', 'actualizado_en'];
  const readable = rows.map(normalizeForRead);
  return {
    columns,
    readable,
    csv: [
      `\uFEFF${columns.map(escapeCsvCell).join(';')}`,
      ...readable.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(';')),
    ].join('\r\n'),
  };
}

async function exportData(format = 'csv') {
  const rows = await repo.getAll(SHEET_NAME);
  const { columns, readable, csv } = toExportRows(rows);
  if (format === 'xls') {
    const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
    const body = readable.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(Array.isArray(row[column]) || typeof row[column] === 'object' ? JSON.stringify(row[column]) : row[column])}</td>`).join('')}</tr>`).join('');
    return {
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      filename: 'clientes.xls',
      body: `\uFEFF<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`,
    };
  }
  return { contentType: 'text/csv; charset=utf-8', filename: 'clientes.csv', body: csv };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  HEADERS,
  HISTORY_HEADERS,
  normalizePhone,
  collectIps,
  normalizeClienteInput,
  getPagedAndFiltered,
  getById,
  create,
  update,
  importBatch,
  getHistory,
  exportData,
};
