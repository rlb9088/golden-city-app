const { z } = require('zod');

const pagoSchema = z.object({
  usuario: z.string().min(1, 'Usuario es requerido'),
  caja: z.string().min(1, 'Caja es requerida'),
  banco_id: z.string().min(1, 'Banco es requerido'),
  agente_id: z.string().optional(),
  banco: z.string().optional().default(''),
  monto: z.number().positive('Monto debe ser mayor a 0'),
  tipo: z.string().min(1, 'Tipo de pago es requerido'),
  comprobante_url: z.string().optional().default(''),
  comprobante_base64: z.string().optional(),
  fecha_comprobante: z.string().optional().default(''),
});

const pagoUpdateSchema = z.object({
  usuario: z.string().min(1, 'Usuario es requerido').optional(),
  caja: z.string().min(1, 'Caja es requerida').optional(),
  banco_id: z.string().min(1, 'Banco es requerido'),
  banco: z.string().optional().default(''),
  monto: z.number().positive('Monto debe ser mayor a 0').optional(),
  tipo: z.string().min(1, 'Tipo de pago es requerido').optional(),
  comprobante_url: z.string().optional(),
  comprobante_file_id: z.string().optional(),
  fecha_comprobante: z.string().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Debes enviar al menos un campo para actualizar.',
});

const pagoCancelSchema = z.object({
  motivo: z.string().min(1, 'El motivo de anulación es requerido'),
});

module.exports = { pagoSchema, pagoUpdateSchema, pagoCancelSchema };
