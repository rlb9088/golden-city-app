# Skill: Registro de Pagos

## Descripción
Guía para implementar o modificar el flujo de registro de pagos.

## Pasos Requeridos
1. **Frontend**:
   - Crear formulario con validación (Monto, Concepto, Método).
   - Enviar a `POST /api/pagos`.
2. **Backend**:
   - Validar schema con Zod.
   - Guardar en Google Sheets (Hoja "pagos").
   - Actualizar balance si aplica.
3. **Validación**:
   - Verificar que el registro aparezca en la hoja de cálculo.
   - Confirmar respuesta exitosa al frontend.

## Reglas Críticas
- No permitir montos negativos sin validación de Admin.
- Todo pago debe tener un "Agente" asociado.
