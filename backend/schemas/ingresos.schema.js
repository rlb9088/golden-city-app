const { z } = require('zod');

const ingresoSchema = z.object({
  agente: z.string().min(1, 'Agente es requerido'),
  banco: z.string().min(1, 'Banco es requerido'),
  monto: z.number().positive('Monto debe ser mayor a 0'),
  fecha_movimiento: z.string().min(1, 'Fecha del movimiento es requerida'),
});

const ingresoUpdateSchema = z.object({
  agente: z.string().min(1, 'Agente es requerido').optional(),
  banco: z.string().min(1, 'Banco es requerido').optional(),
  monto: z.number().positive('Monto debe ser mayor a 0').optional(),
  fecha_movimiento: z.string().min(1, 'Fecha del movimiento es requerida').optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Debes enviar al menos un campo para actualizar.',
});

const ingresoCancelSchema = z.object({
  motivo: z.string().min(1, 'El motivo de anulación es requerido'),
});

module.exports = { ingresoSchema, ingresoUpdateSchema, ingresoCancelSchema };
