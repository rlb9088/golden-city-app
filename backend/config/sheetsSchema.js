const SHEETS_SCHEMA = [
  {
    name: 'pagos',
    headers: ['id', 'estado', 'usuario', 'caja', 'banco', 'monto', 'tipo', 'comprobante_url', 'fecha_comprobante', 'fecha_registro', 'agente'],
  },
  {
    name: 'ingresos',
    headers: ['id', 'estado', 'agente', 'banco', 'monto', 'fecha_movimiento', 'fecha_registro'],
  },
  {
    name: 'gastos',
    headers: ['id', 'estado', 'fecha_gasto', 'fecha_registro', 'concepto', 'categoria', 'subcategoria', 'banco', 'monto'],
  },
  {
    name: 'bancos',
    headers: ['id', 'fecha', 'banco', 'saldo'],
  },
  {
    name: 'audit',
    headers: ['id', 'action', 'entity', 'user', 'timestamp', 'changes'],
  },
  {
    name: 'config_auth_users',
    headers: ['id', 'username', 'password_hash', 'role', 'nombre'],
  },
  {
    name: 'config_agentes',
    headers: ['id', 'nombre'],
  },
  {
    name: 'config_categorias',
    headers: ['id', 'categoria', 'subcategoria'],
  },
  {
    name: 'config_bancos',
    headers: ['id', 'nombre', 'propietario'],
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

const SHEETS_SCHEMA_MAP = Object.fromEntries(
  SHEETS_SCHEMA.map((sheet) => [sheet.name, sheet.headers]),
);

module.exports = {
  SHEETS_SCHEMA,
  SHEETS_SCHEMA_MAP,
};
