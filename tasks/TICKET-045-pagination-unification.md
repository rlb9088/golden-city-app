# TICKET-045: Unificación de paginación en todos los listados

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 8 - Deuda técnica post Sprint-6
> **Esfuerzo**: ~3h
> **Prioridad**: P2 — Deuda técnica: asimetría en nombres, filtros y shape de respuesta

---

## Problema

La paginación fue implementada en Sprint 6 (TICKET-036) pero de forma **inconsistente** entre los servicios:

| Servicio | Método | Filtros soportados | Shape de respuesta |
|----------|--------|-------------------|-------------------|
| Pagos | `getPagedAndFiltered()` | agente, banco, usuario, desde, hasta (5) | `{ items, pagination }` |
| Audit | `getPagedAndFiltered()` | entity, action, user, desde, hasta (5) | `{ items, pagination }` |
| Ingresos | `getPaged()` | solo agente (1) | a verificar |
| Gastos | `getPaged()` | ninguno (0) | a verificar |
| Bancos | `getAll()` | ninguno — **sin paginar** | array plano |

Consecuencias:
- El frontend debe manejar shapes distintos según el endpoint.
- Los filtros de ingresos y gastos no son equivalentes a pagos, limitando las búsquedas.
- Bancos devuelve todos los registros siempre (bajo impacto actual, pero inconsistente).
- Mantenimiento: dos nombres distintos para la misma operación.

---

## Causa Raíz

- TICKET-036 se implementó por módulo sin una spec unificada de naming y filtros.
- Ingresos/Gastos fueron implementados con un scope mínimo; los filtros avanzados quedaron pendientes.
- Bancos fue omitido (tabla pequeña).

Archivos relevantes:
- `backend/services/ingresos.service.js:73-80` — `getPaged()` con 1 filtro
- `backend/services/gastos.service.js:86-89` — `getPaged()` sin filtros
- `backend/controllers/bancos.controller.js:10-11` — `getAll()` sin paginación
- `backend/utils/pagination.js` — utilidad existente (`paginateItems`, `normalizePagination`)

---

## Acciones

### 1. Estandarizar naming

- Renombrar `getPaged()` → `getPagedAndFiltered()` en `ingresos.service.js` y `gastos.service.js`.
- Actualizar los controllers correspondientes.

### 2. Extender filtros

**Ingresos** — añadir filtros: `desde`, `hasta`, `banco`, `usuario` (paridad con pagos).

**Gastos** — añadir filtros: `desde`, `hasta`, `categoria` (relevante para reportes de gastos).

### 3. Paginar Bancos

- Añadir `getPagedAndFiltered(filters, pagination)` en `backend/services/bancos.service.js`.
- Filtros útiles: `agente` (para ver bancos de un agente específico, lo cual tiene valor operativo).
- Actualizar `backend/controllers/bancos.controller.js` para pasar `limit`, `offset`, `agente` desde query params.

### 4. Normalizar shape de respuesta

Todos los endpoints de lista deben retornar:
```json
{
  "status": "success",
  "data": {
    "items": [...],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 162,
      "hasMore": true
    }
  }
}
```
Verificar que ingresos y gastos ya retornan este shape; si no, corregir en sus controllers.

### 5. Frontend

- Verificar que las páginas de Ingresos, Gastos y Bancos consumen la paginación correctamente.
- Si alguna página espera un array plano, adaptarla para leer `data.items` y `data.pagination`.
- Añadir controles de paginación (siguiente/anterior, o lazy load) si no existen en esas páginas.

---

## Archivos

- `backend/services/ingresos.service.js` — renombrar `getPaged` → `getPagedAndFiltered`, añadir filtros
- `backend/services/gastos.service.js` — renombrar `getPaged` → `getPagedAndFiltered`, añadir filtros
- `backend/services/bancos.service.js` — añadir `getPagedAndFiltered`
- `backend/controllers/ingresos.controller.js` — actualizar llamada
- `backend/controllers/gastos.controller.js` — actualizar llamada
- `backend/controllers/bancos.controller.js` — reemplazar `getAll` por `getPagedAndFiltered`
- `frontend/src/app/ingresos/page.tsx` — adaptar si necesario
- `frontend/src/app/gastos/page.tsx` — adaptar si necesario
- `frontend/src/app/bancos/page.tsx` — adaptar si necesario

## Dependencias

- `backend/utils/pagination.js` ya existe y es reutilizable.
- No depende de otros tickets abiertos.

## Criterios de Aceptación

- [ ] Todos los listados usan el método `getPagedAndFiltered()`.
- [ ] Todos los endpoints de lista retornan el shape `{ items, pagination }`.
- [ ] Ingresos soporta filtros: agente, banco, usuario, desde, hasta.
- [ ] Gastos soporta filtros: desde, hasta, categoria.
- [ ] Bancos soporta paginación y filtro por agente.
- [ ] Tests de paginación existentes siguen pasando.
- [ ] Frontend de ingresos, gastos y bancos muestra los datos correctamente.

## Definición de Terminado

- Paginación uniforme en todos los módulos: mismo nombre de método, mismos filtros equivalentes, mismo shape de respuesta.
- Sin regresiones en los módulos ya funcionando (pagos, audit).
