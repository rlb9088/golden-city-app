const { z } = require('zod');

const bancoSchema = z.object({
  banco_id: z.string().min(1, 'Banco es requerido'),
  banco: z.string().optional().default(''),
  saldo: z.number().min(0, 'Saldo no puede ser negativo'),
  fecha: z.string().min(1, 'Fecha es requerida'),
});

module.exports = { bancoSchema };
