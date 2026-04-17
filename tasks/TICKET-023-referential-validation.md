# TICKET-023: Validación de integridad referencial en pagos

> **Estado**: ✅ COMPLETADO
> **Sprint**: 3 — Hardening
> **Esfuerzo**: ~2h  
> **Prioridad**: P1

---

## Objetivo
Validar que los valores FK de los pagos (caja, banco, tipo) existan en las tablas de configuración antes de crear el registro. Warning no bloqueante si no existen.

## Acciones
1. En `pagos.service.js`, antes de crear, verificar contra config:
   - ¿El banco existe en `config_bancos`?
   - ¿La caja existe en `config_cajas`?
   - ¿El tipo de pago existe en `config_tipos_pago`?
2. Si alguno no existe, incluir warning en la respuesta (no bloquear)
3. Repetir para ingresos (agente, banco) y gastos (categoría, banco)
4. Registrar warnings en auditoría

## Archivos probables
- `backend/services/pagos.service.js`
- `backend/services/ingresos.service.js`
- `backend/services/gastos.service.js`
- `backend/services/config.service.js` — helper para verificar existencia

## Dependencias
- TICKET-011

## Criterios de Aceptación
- [ ] Pagos con banco/caja/tipo no existente generan warning (no error)
- [ ] Warning se incluye en la respuesta JSON
- [ ] Frontend muestra warning al operador
- [ ] El registro se crea igualmente (no bloqueante)

## Definición de Terminado
- Datos inconsistentes se detectan y alertan, sin bloquear
