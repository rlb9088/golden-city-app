# TICKET-085 — Backend: hard delete en Pagos, Ingresos y Gastos (eliminar reemplaza a anular)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~3h
> **Dependencias**: ninguna

---

## Contexto

Hoy `DELETE /api/pagos/:id`, `DELETE /api/ingresos/:id` y `DELETE /api/gastos/:id` ejecutan un **soft delete**: marcan el campo `estado` como `'anulado'` y persisten la fila vía `repo.update()`. El balance excluye estas filas con `isActivo()`. El negocio quiere que la acción "Anular" sea reemplazada por **Eliminar** (borrado físico de la fila en Sheets) en los tres módulos. Se mantiene el path `DELETE /api/<entidad>/:id` y se preserva la auditoría con un snapshot del registro antes de borrarlo.

`isActivo()` en el balance se mantiene para no romper el cálculo sobre filas históricas que aún tengan `estado='anulado'` (no se hace cleanup masivo en este ticket).

## Alcance

Para **cada uno de los tres servicios** (`pagos`, `ingresos`, `gastos`) aplicar la misma transformación.

### 1. Servicios

- [backend/services/pagos.service.js](../backend/services/pagos.service.js) — sustituir `cancel(id, motivo, caller)` (L484–519) por:
  ```js
  async function remove(id, caller) {
    const existing = await repo.findById(SHEET_NAME, id);
    if (!existing) throw new NotFoundError('Pago no encontrado');
    await repo.delete(SHEET_NAME, existing._rowIndex);
    await audit.log('delete', 'pago', caller, { before: existing });
    return { id };
  }
  module.exports = { ..., remove };
  ```
- [backend/services/ingresos.service.js](../backend/services/ingresos.service.js) — análogo en `cancel()` L335–366 → `remove()`, entidad `'ingreso'`.
- [backend/services/gastos.service.js](../backend/services/gastos.service.js) — análogo en `cancel()` L276–308 → `remove()`, entidad `'gasto'`.

Eliminar la lógica que verifica `if (estado === 'anulado')` (ya no aplica al borrar físicamente; el `findById` que retorna null cubre el caso "no existe").

### 2. Repositorio Sheets

- Verificar que [backend/repositories/sheetsRepository.js](../backend/repositories/sheetsRepository.js) (o el archivo equivalente que exporta `repo`) ya implementa `delete(sheetName, rowIndex)`. Si no existe, añadirlo usando `batchUpdate` con request `deleteDimension` sobre la fila correspondiente. Importante: tras un `delete` físico, los `_rowIndex` cacheados se desplazan; invalidar cualquier caché.

### 3. Controllers

- [backend/controllers/pagos.controller.js](../backend/controllers/pagos.controller.js) (L26–31): la acción que hoy llama a `service.cancel(...)` pasa a llamar a `service.remove(req.params.id, req.user)`. Eliminar la extracción de `motivo` desde `req.validatedData`.
- Análogo en `ingresos.controller.js` y `gastos.controller.js`.

### 4. Schemas

- [backend/schemas/pagos.schema.js](../backend/schemas/pagos.schema.js): eliminar/relajar el schema del body del DELETE (ya no requiere `{ motivo }`).
- Análogo en `ingresos.schema.js` y `gastos.schema.js`.

### 5. Routes

- [backend/routes/pagos.routes.js](../backend/routes/pagos.routes.js), `ingresos.routes.js`, `gastos.routes.js`: el path `DELETE /:id` no cambia. Quitar la validación de body si la había.

### 6. Auditoría — [backend/services/audit.service.js](../backend/services/audit.service.js)

- Verificar que `audit.log('delete', entity, user, { before })` ya soporta el tipo de evento `'delete'`. Si en el repo se usaba con `{ before, after, motivo }` para anular, la llamada nueva pasa solo `{ before }` y conserva trazabilidad completa.

### 7. Tests

- Para cada módulo (pagos/ingresos/gastos):
  - `remove()` con id existente → fila eliminada de Sheets, `audit.log` invocado con `{ before }`.
  - `remove()` con id inexistente → `NotFoundError` (404).
  - Tras eliminar un pago, `GET /api/pagos/:id` → 404, `GET /api/balance` excluye su monto del cálculo.

## Archivos a modificar

- [backend/services/pagos.service.js](../backend/services/pagos.service.js)
- [backend/services/ingresos.service.js](../backend/services/ingresos.service.js)
- [backend/services/gastos.service.js](../backend/services/gastos.service.js)
- [backend/controllers/pagos.controller.js](../backend/controllers/pagos.controller.js)
- [backend/controllers/ingresos.controller.js](../backend/controllers/ingresos.controller.js)
- [backend/controllers/gastos.controller.js](../backend/controllers/gastos.controller.js)
- [backend/schemas/pagos.schema.js](../backend/schemas/pagos.schema.js)
- [backend/schemas/ingresos.schema.js](../backend/schemas/ingresos.schema.js)
- [backend/schemas/gastos.schema.js](../backend/schemas/gastos.schema.js)
- [backend/routes/pagos.routes.js](../backend/routes/pagos.routes.js), `ingresos.routes.js`, `gastos.routes.js` (quitar validación de body si la hay)
- [backend/repositories/sheetsRepository.js](../backend/repositories/sheetsRepository.js) (si `delete` no existe, añadirlo)
- [backend/tests/](../backend/tests/) — tests de los tres servicios.

## Criterios de aceptación

- [x] `DELETE /api/pagos/:id` borra físicamente la fila en Sheets; un `GET /api/pagos/:id` posterior responde 404.
- [x] `DELETE /api/ingresos/:id` y `DELETE /api/gastos/:id` se comportan igual.
- [x] El body de los DELETE ya no requiere `{ motivo }`; un body vacío o ausente es válido.
- [x] Auditoría registra `action='delete'`, `entity` correcta, snapshot completo en `before`.
- [x] `GET /api/balance` después de eliminar un pago/ingreso/gasto refleja el cambio (montos descontados).
- [x] Filas históricas con `estado='anulado'` siguen siendo excluidas correctamente por el balance.
- [x] Tests unitarios y de contrato verdes.

## Notas

- **No** borrar el campo `estado` del esquema de Sheets ni del modelo en código; aún hay registros históricos con `estado='anulado'` que necesitan ser interpretables.
- La función exportada se llama `remove` (no `delete`, palabra reservada en JS para nombres de método). En el frontend el helper se llamará `delete<Entidad>` (ver TICKETS 086–088).
- Solo el admin puede ejecutar DELETE, igual que hoy (mantener `requireAdmin`).
- No se hace cleanup masivo de filas con `estado='anulado'` en este ticket; eso queda para una migración separada si el negocio lo solicita.

## Resultado de implementación

- `pagos`, `ingresos` y `gastos` exportan `remove(id, caller)` y usan `repo.findById()` + `repo.delete()` para hard delete.
- `DELETE /api/{pagos,ingresos,gastos}/:id` mantiene `requireAdmin` y ya no valida body.
- Se agregaron `GET /api/{pagos,ingresos,gastos}/:id` con `requireAuth` para lectura puntual y 404 real tras borrar.
- La auditoría conserva trazabilidad con `audit.log('delete', entity, user, { before })`.
- `sheetsRepository` conserva `deleteRow()` y expone alias `delete()` junto con `findById()`.
- Validación ejecutada: focal `node --test tests/pagos-update-cancel.test.js tests/movements-update-cancel.test.js tests/auth-gate-routes.test.js tests/balance-excludes-anulled.test.js`; completa backend `npm run lint`, `npm test` (139 tests) y `npm run build --if-present`.
