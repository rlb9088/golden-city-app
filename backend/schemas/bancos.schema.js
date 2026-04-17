const { z } = require('zod');

const bancoSchema = z.object({
  banco: z.string().min(1, 'Banco es requerido'),
  saldo: z.number().min(0, 'Saldo no puede ser negativo'),
  fecha: z.string().min(1, 'Fecha es requerida'),
});

module.exports = { bancoSchema };
