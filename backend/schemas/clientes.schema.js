const { z } = require('zod');

const flexibleString = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();
const stringList = z.array(z.union([z.string(), z.number()])).optional();

const clienteBaseSchema = z.object({
  nombre: flexibleString,
  player_id: flexibleString,
  fecha_alta: flexibleString,
  origen: flexibleString,
  dni: flexibleString,
  fecha_nacimiento: flexibleString,
  edad: flexibleString,
  correos: stringList,
  telefonos: stringList,
  ips: stringList,
  ciudad: flexibleString,
  ciudad_ip: flexibleString,
  ip_city_status: flexibleString,
  accesos: z.record(z.string(), z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const clienteCreateSchema = clienteBaseSchema.refine((data) => {
  return Boolean(String(data.nombre ?? '').trim() || String(data.player_id ?? '').trim() || String(data.dni ?? '').trim());
}, {
  message: 'Debes enviar al menos nombre, player_id o DNI.',
});

const clienteUpdateSchema = clienteBaseSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar.',
});

const clienteImportSchema = z.object({
  items: z.array(clienteBaseSchema.passthrough()).min(1, 'Se requiere al menos un cliente.'),
  source: z.string().trim().optional().default('bulk_import'),
});

module.exports = { clienteCreateSchema, clienteUpdateSchema, clienteImportSchema };
