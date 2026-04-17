# TICKET-028: Anulación / edición de registros

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 4 — Funcionalidad  
> **Esfuerzo**: ~4h  
> **Prioridad**: P2  
> **Completado en**: 2026-04-16

---

## Objetivo
Permitir que el admin pueda anular o editar pagos, ingresos y gastos existentes, con registro completo en auditoría.

## Acciones
### Backend
1. Agregar campo `estado` a pagos/ingresos/gastos (activo/anulado)
2. PUT `/api/pagos/:id` — editar pago (admin only)
3. DELETE `/api/pagos/:id` — anular pago (cambiar estado, no borrar fila)
4. Registrar en auditoría: datos anteriores vs nuevos
5. El balance debe excluir registros anulados

### Frontend
1. Agregar botón de "Anular" en cada fila de la tabla de pagos
2. Modal de confirmación con motivo de anulación
3. Indicador visual de registros anulados (tachado, gris)
4. Opcionalmente: botón de "Editar" con formulario inline

## Archivos probables
- `backend/services/pagos.service.js` — update(), cancel()
- `backend/services/balance.service.js` — excluir anulados
- `backend/schemas/pagos.schema.js` — schema de update
- `frontend/src/app/pagos/page.tsx` — botones de acción por fila
- `frontend/src/lib/api.ts` — updatePago(), cancelPago()

## Dependencias
- TICKET-006, TICKET-010

## Criterios de Aceptación
- [ ] Admin puede anular un pago (cambia estado, no borra)
- [ ] Pagos anulados no se incluyen en el cálculo de balance
- [ ] Auditoría registra el cambio de estado con motivo
- [ ] Registros anulados se muestran visualmente diferentes
- [ ] Solo admin puede anular (agentes no)

## Definición de Terminado
- Se puede corregir errores sin perder trazabilidad
