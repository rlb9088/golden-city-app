const { z } = require('zod');

const gastoSchema = z.object({
  concepto: z.string().min(1, 'Concepto es requerido'),
  categoria: z.string().min(1, 'Categoría es requerida'),
  subcategoria: z.string().optional().default(''),
  banco_id: z.string().min(1, 'Banco es requerido'),
  banco: z.string().optional().default(''),
  monto: z.number().positive('Monto debe ser mayor a 0'),
  fecha_gasto: z.string().min(1, 'Fecha del gasto es requerida'),
});

const gastoUpdateSchema = z.object({
  concepto: z.string().min(1, 'Concepto es requerido').optional(),
  categoria: z.string().min(1, 'Categoría es requerida').optional(),
  subcategoria: z.string().optional(),
  banco_id: z.string().min(1, 'Banco es requerido'),
  banco: z.string().optional().default(''),
  monto: z.number().positive('Monto debe ser mayor a 0').optional(),
  fecha_gasto: z.string().min(1, 'Fecha del gasto es requerida').optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Debes enviar al menos un campo para actualizar.',
});

const gastoCancelSchema = z.object({
  motivo: z.string().min(1, 'El motivo de anulación es requerido'),
});

module.exports = { gastoSchema, gastoUpdateSchema, gastoCancelSchema };
