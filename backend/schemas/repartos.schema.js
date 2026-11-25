const { z } = require('zod');

const repartoSchema = z.object({
  concepto: z.string().min(1, 'Concepto es requerido'),
  categoria: z.string().min(1, 'Categoría es requerida'),
  subcategoria: z.string().optional().default(''),
  proveedor: z.string().trim().min(1, 'Proveedor es requerido'),
  nota: z.string().optional().default(''),
  banco_id: z.string().min(1, 'Banco es requerido'),
  monto: z.number().positive('Monto debe ser mayor a 0'),
  fecha_movimiento: z.string().min(1, 'Fecha es requerida'),
});

const repartoUpdateSchema = z.object({
  concepto: z.string().min(1, 'Concepto es requerido').optional(),
  categoria: z.string().min(1, 'Categoría es requerida').optional(),
  subcategoria: z.string().optional(),
  proveedor: z.string().trim().min(1, 'Proveedor es requerido').optional(),
  nota: z.string().optional(),
  banco_id: z.string().min(1, 'Banco es requerido'),
  monto: z.number().positive('Monto debe ser mayor a 0').optional(),
  fecha_movimiento: z.string().min(1, 'Fecha es requerida').optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Debes enviar al menos un campo para actualizar.',
});

module.exports = { repartoSchema, repartoUpdateSchema };
