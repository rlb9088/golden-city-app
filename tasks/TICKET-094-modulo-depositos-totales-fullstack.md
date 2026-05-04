# TICKET-094 — Módulo "Depósitos Totales" (full-stack)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~5h
> **Dependencias**: TICKET-093 (schema y hojas creadas)

---

## Contexto

Implementar el módulo "Depósitos Totales" siguiendo exactamente el patrón del módulo Bancos pero registrando un dato único por **fecha + caja** (en lugar de fecha + banco). UPSERT: si para una fecha y caja ya existe registro, el nuevo monto reemplaza al anterior. Solo accesible a usuarios con rol **admin** (POST y GET).

Este ticket es el primero de la familia (094-097). Dado que los 4 módulos son funcionalmente idénticos, **TICKET-094 establece el patrón de implementación** que los tickets 095, 096 y 097 replicarán con renombres mecánicos.

## Alcance

### 1. Backend

#### Schema — [backend/schemas/depositos-totales.schema.js](../backend/schemas/) (nuevo)

```js
const { z } = require('zod');

const depositoTotalSchema = z.object({
  caja_id: z.string().min(1, 'caja_id es requerido'),
  caja: z.string().optional(),
  monto: z.number().min(0, 'monto debe ser ≥ 0'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD'),
});

module.exports = { depositoTotalSchema };
```

#### Service — [backend/services/depositos-totales.service.js](../backend/services/) (nuevo)

Replicar la estructura de `backend/services/bancos.service.js` con sustituciones:

- `banco_id` → `caja_id`
- `banco` → `caja`
- `saldo` → `monto`
- `config_bancos` → `config_cajas`
- Sheet name: `'depositos_totales'`
- Validación: `caja_id` debe existir en `config_cajas` (usar `config.service.getTable('cajas')` o helper equivalente).
- **No hay clasificación admin/agente para cajas** (todas las cajas son administrativas), por lo que no hay `getScopedDepositos` equivalente a `getScopedBancos`.

Funciones a exportar:
- `upsert(data, caller)` — busca por `(fecha + caja_id)`, actualiza si existe (`overwritten: true`) o crea. Registra en `audit.service`.
- `getPagedAndFiltered({ caja, limit, offset })` — listado paginado, ordenado por `fecha DESC, caja ASC`.
- `getLatest()` — último monto por caja.

#### Controller — [backend/controllers/depositos-totales.controller.js](../backend/controllers/) (nuevo)

2 endpoints:
- `create(req, res)` → valida con `depositoTotalSchema`, llama `service.upsert(data, req.user)`.
- `getPagedAndFiltered(req, res)` → lee query `{ caja, limit, offset }` y responde con `{ items, pagination }`.

#### Routes — [backend/routes/depositos-totales.routes.js](../backend/routes/) (nuevo)

```
POST   /api/depositos-totales      → create        (verifyToken + requireAdmin)
GET    /api/depositos-totales      → getPagedAndFiltered (verifyToken + requireAdmin)
```

#### Registro en index — [backend/index.js](../backend/index.js)

Importar y montar el router en `/api/depositos-totales`.

#### Tests — [backend/tests/depositos-totales.service.test.js](../backend/tests/) (nuevo)

Cubrir:
- Crear registro nuevo (`overwritten: false`).
- Upsert sobre el mismo (fecha, caja_id) — devuelve `overwritten: true` y reemplaza monto.
- `caja_id` inexistente → error 4xx.
- `monto` negativo → error 4xx.
- Listado paginado (verificar orden y `pagination`).

### 2. Frontend

#### Cliente API — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

Agregar tipos e interfaces:

```ts
export interface DepositoTotalRecord {
  id: string;
  fecha: string;
  caja_id: string;
  caja: string;
  monto: string | number;
}

export interface DepositosTotalesFilters {
  caja?: string;
  limit?: number;
  offset?: number;
}
```

Agregar funciones:
- `createDepositoTotal(data: { caja_id, monto, fecha })` → `POST /api/depositos-totales`. Retorna `{ status, data: DepositoTotalRecord & { overwritten, warnings } }`.
- `getDepositosTotales(filters?)` → `GET /api/depositos-totales?caja=&limit=&offset=`. Retorna `{ status, data: { items, pagination } }`.

(Reutilizar `getConfigCajas()` ya existente para llenar el `<select>` del formulario.)

#### Página — [frontend/src/app/depositos-totales/page.tsx](../frontend/src/app/depositos-totales/) (nuevo)

Replicar `frontend/src/app/bancos/page.tsx` con cambios:
- Selector de **caja** (no de banco), poblado con `getConfigCajas()`.
- Campo monetario etiquetado "Monto del día" en lugar de "Saldo".
- Título: "Depósitos Totales".
- Subtítulo: "Registra el total de depósitos del cierre del día por caja."
- UPSERT con alerta "Actualizar Monto" cuando ya existe `(fecha + caja)`.
- Tabla paginada con columnas: Fecha | Caja | Monto.

#### CSS — [frontend/src/app/depositos-totales/depositos-totales.css](../frontend/src/app/depositos-totales/) (nuevo)

Reutilizar el patrón de `frontend/src/app/bancos/bancos.css` (mismo layout, copiado).

#### Sidebar — [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx)

Agregar item después de "🏦 Bancos":
```ts
{ href: '/depositos-totales', label: 'Depósitos Totales', icon: '💵', adminOnly: true }
```

## Archivos a crear

- [backend/schemas/depositos-totales.schema.js](../backend/schemas/)
- [backend/services/depositos-totales.service.js](../backend/services/)
- [backend/controllers/depositos-totales.controller.js](../backend/controllers/)
- [backend/routes/depositos-totales.routes.js](../backend/routes/)
- [backend/tests/depositos-totales.service.test.js](../backend/tests/)
- [frontend/src/app/depositos-totales/page.tsx](../frontend/src/app/depositos-totales/)
- [frontend/src/app/depositos-totales/depositos-totales.css](../frontend/src/app/depositos-totales/)

## Archivos a modificar

- [backend/index.js](../backend/index.js) — registrar router.
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — tipos y funciones API.
- [frontend/src/components/Sidebar.tsx](../frontend/src/components/Sidebar.tsx) — entrada en sidebar.

## Criterios de aceptación

- [ ] `POST /api/depositos-totales` con admin crea o actualiza registro y devuelve `overwritten` correcto.
- [ ] `POST /api/depositos-totales` con usuario no-admin responde 403.
- [ ] `GET /api/depositos-totales` con admin devuelve `{ items, pagination }`.
- [ ] `GET /api/depositos-totales` con usuario no-admin responde 403.
- [ ] `caja_id` inexistente en `config_cajas` rechaza el POST.
- [ ] Audit log registra `create` y `upsert_overwrite` con la entidad `'deposito_total'`.
- [ ] Frontend `/depositos-totales` carga y muestra la página solo para admins.
- [ ] Formulario muestra alerta "Actualizar Monto" cuando ya existe `(fecha + caja)`.
- [ ] Tabla paginada (50 por página) con `PaginationControls`.
- [ ] Tests backend pasan: `cd backend && npm test`.
- [ ] `cd frontend && npm run typecheck && npm run lint` pasan.

## Definición de Terminado

Un admin puede registrar y consultar depósitos totales por caja, con UPSERT funcional y validación referencial. La página está integrada en el sidebar admin. Tests cubren los 3 caminos principales (crear, upsert, validación).

## Resultado de implementación

- Se agregó el módulo `depositos-totales` completo en backend y frontend.
- El backend valida `caja_id` contra `config_cajas`, aplica UPSERT por `(fecha, caja_id)` y audita `create` / `upsert_overwrite`.
- El frontend expone `/depositos-totales` solo para admins, con selector de caja, alerta de actualización y tabla paginada.

## Notas

- **Nomenclatura URL**: usar guiones (`/depositos-totales`) — patrón vigente del proyecto.
- **Reutilización**: copiar `bancos/page.tsx` y aplicar replace global de `banco→caja`, `saldo→monto`, `Banco→Caja`, `Saldo→Monto`. Revisar después que los textos visibles tengan sentido.
- **Permisos**: a diferencia de Bancos (que permite GET con auth), aquí GET requiere `requireAdmin` también.
- **Si se separa un helper genérico** para los 4 módulos, dejarlo documentado para que los tickets 095-097 lo reusen. Si no, copy-paste explícito está OK.
