# TICKET-095 — Módulo "Retiros Totales" (full-stack)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~3h
> **Dependencias**: TICKET-094 (patrón establecido)

---

## Contexto

Réplica funcional **idéntica** al módulo "Depósitos Totales" (TICKET-094) pero para registrar el total de **retiros** del día por caja. Mismo modelo: UPSERT por `(fecha + caja_id)`, admin-only en POST y GET, validación referencial contra `config_cajas`.

Como TICKET-094 ya estableció el patrón, este ticket es prácticamente un copy-paste con renombres mecánicos.

## Alcance

### 1. Backend

- [backend/schemas/retiros-totales.schema.js](../backend/schemas/) — `retiroTotalSchema` con `{ caja_id, caja?, monto, fecha }`.
- [backend/services/retiros-totales.service.js](../backend/services/) — `upsert`, `getPagedAndFiltered`, `getLatest`. Sheet name: `'retiros_totales'`.
- [backend/controllers/retiros-totales.controller.js](../backend/controllers/) — `create`, `getPagedAndFiltered`.
- [backend/routes/retiros-totales.routes.js](../backend/routes/) — `POST` y `GET` ambos con `verifyToken + requireAdmin`.
- [backend/index.js](../backend/index.js) — registrar router en `/api/retiros-totales`.
- [backend/tests/retiros-totales.service.test.js](../backend/tests/) — replicar cobertura del ticket 094.

Audit log: usar entidad `'retiro_total'`.

### 2. Frontend

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — `RetiroTotalRecord`, `createRetiroTotal`, `getRetirosTotales`.
- [frontend/src/app/retiros-totales/page.tsx](../frontend/src/app/retiros-totales/) — replicar página de TICKET-094 con título "Retiros Totales" y subtítulo "Registra el total de retiros del cierre del día por caja."
- [frontend/src/app/retiros-totales/retiros-totales.css](../frontend/src/app/retiros-totales/).
- [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx) — agregar después de Depósitos Totales:
  ```ts
  { href: '/retiros-totales', label: 'Retiros Totales', icon: '💸', adminOnly: true }
  ```

## Archivos a crear / modificar

Idéntico listado que TICKET-094 con "depositos-totales" → "retiros-totales".

## Criterios de aceptación

- [ ] POST/GET `/api/retiros-totales` funcionan con UPSERT y validación referencial.
- [ ] Acceso restringido a admin (403 para no-admin).
- [ ] Audit log registra entidad `'retiro_total'`.
- [ ] Frontend `/retiros-totales` operativa con UPSERT + paginación.
- [ ] Sidebar muestra item solo para admin.
- [ ] Tests backend pasan.
- [ ] `npm run typecheck` y `npm run lint` (frontend) pasan.

## Definición de Terminado

Módulo "Retiros Totales" funcional end-to-end con la misma calidad que "Depósitos Totales".

## Resultado de implementación

- Se agregó el módulo `retiros-totales` completo en backend y frontend.
- El backend valida `caja_id` contra `config_cajas`, aplica UPSERT por `(fecha, caja_id)` y audita `create` / `upsert_overwrite` con la entidad `'retiro_total'`.
- El frontend expone `/retiros-totales` solo para admins, con selector de caja, alerta de actualización y tabla paginada.
- La navegación lateral ya incluye el acceso a `Retiros Totales` para administradores.
- Se incorporaron tests de servicio para crear, sobreescribir, validar caja inexistente, validar monto negativo y paginación/orden.
- Se actualizó el lint/test del backend para incluir los archivos nuevos del módulo.

## Notas

- Para acelerar, ejecutar este ticket inmediatamente después de TICKET-094, en la misma sesión, copiando los archivos y aplicando replace global.
- Las hojas de Sheets ya están creadas por TICKET-093.
