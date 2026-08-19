const SHEETS_SCHEMA = [
  {
    name: 'pagos',
    headers: ['id', 'estado', 'usuario', 'caja', 'banco_id', 'banco', 'monto', 'tipo', 'comprobante_url', 'comprobante_file_id', 'fecha_comprobante', 'fecha_registro', 'agente'],
  },
  {
    name: 'ingresos',
    headers: ['id', 'estado', 'agente', 'banco_id', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'],
  },
  {
    name: 'gastos',
    headers: ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco_id', 'banco', 'monto'],
  },
  {
    name: 'bancos',
    headers: ['id', 'fecha', 'banco_id', 'banco', 'saldo'],
  },
  {
    name: 'depositos_totales',
    headers: ['id', 'fecha', 'caja_id', 'caja', 'monto'],
  },
  {
    name: 'retiros_totales',
    headers: ['id', 'fecha', 'caja_id', 'caja', 'monto'],
  },
  {
    name: 'bonos_totales',
    headers: ['id', 'fecha', 'caja_id', 'caja', 'monto'],
  },
  {
    name: 'retiros_no_pagados',
    headers: ['id', 'fecha', 'caja_id', 'caja', 'monto'],
  },
  {
    name: 'audit',
    headers: ['id', 'action', 'entity', 'user', 'timestamp', 'changes'],
  },
  {
    name: 'clientes',
    headers: [
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
    ],
  },
  {
    name: 'clientes_historial',
    headers: ['id', 'cliente_id', 'action', 'user', 'timestamp', 'before_json', 'after_json', 'source'],
  },
  {
    name: 'config_agentes',
    headers: ['id', 'nombre', 'username', 'password_hash', 'role', 'activo'],
  },
  {
    name: 'config_categorias',
    headers: ['id', 'categoria', 'subcategoria'],
  },
  {
    name: 'config_bancos',
    headers: ['id', 'nombre', 'propietario', 'propietario_id'],
  },
  {
    name: 'config_settings',
    headers: ['key', 'value', 'fecha_efectiva', 'actualizado_por', 'actualizado_en'],
  },
  {
    name: 'config_cajas',
    headers: ['id', 'nombre'],
  },
  {
    name: 'config_tipos_pago',
    headers: ['id', 'nombre'],
  },
  {
    name: 'config_usuarios',
    headers: ['id', 'nombre'],
  },
];

const TOTALES_POR_CAJA_HEADERS = ['id', 'fecha', 'caja_id', 'caja', 'monto'];

const DEPRECATED_SHEETS_SCHEMA = [
  {
    name: 'config_auth_users',
    headers: ['id', 'username', 'password_hash', 'role', 'nombre'],
  },
];

const SHEETS_SCHEMA_MAP = Object.fromEntries(
  SHEETS_SCHEMA.map((sheet) => [sheet.name, sheet.headers]),
);

const DEPRECATED_SHEETS_SCHEMA_MAP = Object.fromEntries(
  DEPRECATED_SHEETS_SCHEMA.map((sheet) => [sheet.name, sheet.headers]),
);

module.exports = {
  DEPRECATED_SHEETS_SCHEMA,
  DEPRECATED_SHEETS_SCHEMA_MAP,
  SHEETS_SCHEMA,
  SHEETS_SCHEMA_MAP,
  TOTALES_POR_CAJA_HEADERS,
};
