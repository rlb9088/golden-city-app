const { z } = require('zod');

const balanceQuerySchema = z.object({
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD').optional(),
});

module.exports = { balanceQuerySchema };
