const { z } = require('zod');

const configSettingKeySchema = z.string().trim().regex(
  /^caja_inicio_mes(?::banco:[a-z0-9_-]+)?$/i,
  'La clave de configuracion no tiene un formato valido',
);

const configSettingUpsertSchema = z.object({
  value: z.union([
    z.number(),
    z.string().trim().min(1, 'El valor es requerido'),
  ]),
  fecha_efectiva: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha efectiva debe tener formato YYYY-MM-DD'),
});

module.exports = { configSettingKeySchema, configSettingUpsertSchema };
