# TICKET-096 — Módulo "Bonos Totales" (full-stack)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~3h
> **Dependencias**: TICKET-094 (patrón establecido)

---

## Contexto

Réplica funcional **idéntica** al módulo "Depósitos Totales" (TICKET-094) pero para registrar el total de **bonos** otorgados el día por caja. Mismo modelo: UPSERT por `(fecha + caja_id)`, admin-only en POST y GET, validación referencial contra `config_cajas`.

Los bonos representan promociones o incentivos otorgados a los jugadores y se restan de los depósitos para obtener "depósitos reales" en el módulo Balance (ver TICKET-098).

## Alcance

### 1. Backend

- [backend/schemas/bonos-totales.schema.js](../backend/schemas/) — `bonoTotalSchema` con `{ caja_id, caja?, monto, fecha }`.
- [backend/services/bonos-totales.service.js](../backend/services/) — `upsert`, `getPagedAndFiltered`, `getLatest`. Sheet name: `'bonos_totales'`.
- [backend/controllers/bonos-totales.controller.js](../backend/controllers/).
- [backend/routes/bonos-totales.routes.js](../backend/routes/) — `POST` y `GET` ambos con `verifyToken + requireAdmin`.
- [backend/index.js](../backend/index.js) — registrar router en `/api/bonos-totales`.
- [backend/tests/bonos-totales.service.test.js](../backend/tests/).

Audit log: entidad `'bono_total'`.

### 2. Frontend

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — `BonoTotalRecord`, `createBonoTotal`, `getBonosTotales`.
- [frontend/src/app/bonos-totales/page.tsx](../frontend/src/app/bonos-totales/) — título "Bonos Totales", subtítulo "Registra el total de bonos otorgados el día por caja."
- [frontend/src/app/bonos-totales/bonos-totales.css](../frontend/src/app/bonos-totales/).
- [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx):
  ```ts
  { href: '/bonos-totales', label: 'Bonos Totales', icon: '🎁', adminOnly: true }
  ```

## Archivos a crear / modificar

Idéntico listado que TICKET-094 con "depositos-totales" → "bonos-totales".

## Criterios de aceptación

- [ ] POST/GET `/api/bonos-totales` funcionan con UPSERT y validación referencial.
- [ ] Acceso restringido a admin.
- [ ] Audit log registra entidad `'bono_total'`.
- [ ] Frontend `/bonos-totales` operativa.
- [ ] Sidebar muestra item solo para admin.
- [ ] Tests backend pasan.
- [ ] `npm run typecheck` y `npm run lint` (frontend) pasan.

## Definición de Terminado

Módulo "Bonos Totales" funcional end-to-end con la misma calidad que "Depósitos Totales".

## Notas

- Las hojas ya fueron creadas por TICKET-093.

## Resultado de implementacion

- Se agrego el modulo `bonos-totales` completo en backend y frontend, replicando el patron de `depositos-totales` y `retiros-totales`.
- El backend valida `caja_id` contra `config_cajas`, aplica UPSERT por `(fecha, caja_id)` y audita `create` / `upsert_overwrite` con la entidad `'bono_total'`.
- El frontend expone `/bonos-totales` solo para admins, con selector de caja, alerta de actualizacion y tabla paginada.
- La navegacion lateral ya incluye el acceso a `Bonos Totales` para administradores.
