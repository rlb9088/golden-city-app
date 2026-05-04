# TICKET-097 — Módulo "Retiros No Pagados" (full-stack)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~3h
> **Dependencias**: TICKET-094 (patrón establecido)

---

## Contexto

Réplica funcional **idéntica** al módulo "Depósitos Totales" (TICKET-094) pero para registrar el total de **retiros que no se llegaron a pagar** ese día por caja. Mismo modelo: UPSERT por `(fecha + caja_id)`, admin-only en POST y GET.

Los retiros no pagados representan retiros solicitados que quedaron pendientes y se restan de los retiros totales para obtener "retiros reales" en el módulo Balance (ver TICKET-098).

## Alcance

### 1. Backend

- [backend/schemas/retiros-no-pagados.schema.js](../backend/schemas/) — `retiroNoPagadoSchema` con `{ caja_id, caja?, monto, fecha }`.
- [backend/services/retiros-no-pagados.service.js](../backend/services/) — `upsert`, `getPagedAndFiltered`, `getLatest`. Sheet name: `'retiros_no_pagados'`.
- [backend/controllers/retiros-no-pagados.controller.js](../backend/controllers/).
- [backend/routes/retiros-no-pagados.routes.js](../backend/routes/) — `POST` y `GET` ambos con `verifyToken + requireAdmin`.
- [backend/index.js](../backend/index.js) — registrar router en `/api/retiros-no-pagados`.
- [backend/tests/retiros-no-pagados.service.test.js](../backend/tests/).

Audit log: entidad `'retiro_no_pagado'`.

### 2. Frontend

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — `RetiroNoPagadoRecord`, `createRetiroNoPagado`, `getRetirosNoPagados`.
- [frontend/src/app/retiros-no-pagados/page.tsx](../frontend/src/app/retiros-no-pagados/) — título "Retiros No Pagados", subtítulo "Registra el total de retiros pendientes/no pagados del día por caja."
- [frontend/src/app/retiros-no-pagados/retiros-no-pagados.css](../frontend/src/app/retiros-no-pagados/).
- [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx):
  ```ts
  { href: '/retiros-no-pagados', label: 'Retiros No Pagados', icon: '⛔', adminOnly: true }
  ```

## Archivos a crear / modificar

Idéntico listado que TICKET-094 con "depositos-totales" → "retiros-no-pagados".

## Criterios de aceptación

- [ ] POST/GET `/api/retiros-no-pagados` funcionan con UPSERT y validación referencial.
- [ ] Acceso restringido a admin.
- [ ] Audit log registra entidad `'retiro_no_pagado'`.
- [ ] Frontend `/retiros-no-pagados` operativa.
- [ ] Sidebar muestra item solo para admin.
- [ ] Tests backend pasan.
- [ ] `npm run typecheck` y `npm run lint` (frontend) pasan.

## Definición de Terminado

Módulo "Retiros No Pagados" funcional end-to-end con la misma calidad que "Depósitos Totales".

## Resultado de implementación

- Se implementó el módulo `retiros-no-pagados` completo en backend y frontend.
- El backend valida `caja_id` contra `config_cajas`, aplica UPSERT por `(fecha, caja_id)` y audita `create` / `upsert_overwrite` con entidad `retiro_no_pagado`.
- El frontend expone `/retiros-no-pagados` solo para admins, con selector de caja, alerta de actualización y tabla paginada.
- El sidebar incluye el acceso admin-only a `Retiros No Pagados`.
- La validación de backend quedó incorporada en `npm run lint` y `npm test`.

## Notas

- Las hojas ya fueron creadas por TICKET-093.
- Tras este ticket, los 4 módulos de "totales por caja" están operativos y listos para alimentar los nuevos indicadores de Balance (TICKET-098 ss.).
