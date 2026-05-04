const { z } = require('zod');

const depositoTotalSchema = z.object({
  caja_id: z.string().min(1, 'caja_id es requerido'),
  caja: z.string().optional(),
  monto: z.number().min(0, 'monto debe ser >= 0'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD'),
});

module.exports = { depositoTotalSchema };
