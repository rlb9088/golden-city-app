# TICKET-091 — Backend: detección de pagos duplicados al crear

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2.5h
> **Dependencias**: ninguna (puede ejecutarse antes o después de TICKET-085)

---

## Contexto

Usuarios reportan que, ocasionalmente, al registrar un pago el sistema termina creando dos filas idénticas. La causa identificada es: cuando el backend tarda en responder (cold start o latencia transitoria), el primer request sí se procesa en servidor pero el cliente cree que falló y el usuario reintenta o el navegador reintenta. Como `POST /api/pagos` no tiene idempotencia ni dedupe, se inserta el segundo registro.

Este ticket añade detección de pagos duplicados en el lado servidor. La UI complementaria (modal de confirmación al usuario) se entrega en TICKET-092.

## Diseño

- Criterio de duplicado: una nueva fila se considera duplicada si existe **al menos un pago activo** con la **misma combinación** de:
  - `usuario`
  - `monto` (igualdad estricta tras parseo numérico)
  - `banco_id`
  - `fecha_comprobante` (mismo `YYYY-MM-DD`; ignorar la hora si está presente)

  cuyo `fecha_registro` esté dentro de los **últimos 10 minutos** respecto al instante del nuevo `POST`.

- Constante configurable `DUPLICATE_WINDOW_MINUTES` (default 10), expuesta como `process.env.DUPLICATE_WINDOW_MINUTES`.

- Cuando se detecta duplicado, el endpoint responde **HTTP 409**:
  ```json
  {
    "code": "DUPLICATE_PAGO",
    "message": "Se detectó un pago con los mismos datos en los últimos 10 minutos.",
    "existing": {
      "id": "PAG-...",
      "usuario": "...",
      "monto": 123.45,
      "banco_id": "...",
      "fecha_comprobante": "2026-05-02",
      "fecha_registro": "2026-05-02T17:42:11.123Z"
    }
  }
  ```

- **Bypass**: si la petición incluye el header `X-Confirm-Duplicate: true`, saltar la verificación e insertar normalmente. Esto permite al usuario confirmar conscientemente desde la UI (TICKET-092).

## Alcance

### 1. Servicio — [backend/services/pagos.service.js](../backend/services/pagos.service.js)

- En `create()` (L300–393), antes de generar el ID e insertar:
  1. Llamar a un nuevo helper `findDuplicateInWindow(payload, windowMinutes)` que:
     - Lee la lista de pagos activos (mismo filtrado que ya hace `list()` con `isPagoActivo`).
     - Filtra los que cumplen la combinación exacta.
     - De entre los que cumplen, devuelve el primero cuyo `fecha_registro` esté en `[now − windowMinutes, now]`. Si no hay, devuelve `null`.
  2. Si devuelve un duplicado y la flag `skipDuplicateCheck` no está activa, lanzar un error tipado `DuplicatePagoError` con el snapshot del existente.
- Exportar `findDuplicateInWindow` para los tests.

### 2. Controller — [backend/controllers/pagos.controller.js](../backend/controllers/pagos.controller.js)

- En el handler de `POST /api/pagos`:
  - Leer el header `x-confirm-duplicate` (case-insensitive) y pasar `skipDuplicateCheck: header === 'true'` al service.
  - Capturar `DuplicatePagoError` y mapearlo a HTTP 409 con el body indicado en "Diseño".
- Si el repo usa un middleware central de errores, registrar allí el mapeo de `DuplicatePagoError` → 409.

### 3. Schemas — [backend/schemas/pagos.schema.js](../backend/schemas/pagos.schema.js)

- No cambia el schema del body. El header `X-Confirm-Duplicate` no se valida con Zod (es metadato HTTP).

### 4. Configuración — [backend/index.js](../backend/index.js) o `config.js`

- Añadir lectura de `process.env.DUPLICATE_WINDOW_MINUTES` con default 10.
- Documentar la variable en [docs/DEPLOY.md](../docs/DEPLOY.md) y en `.env.example` si existe.

### 5. Tests — [backend/tests/pagos.service.test.js](../backend/tests/)

- Casos:
  - Crear 2 pagos idénticos con 2 minutos de diferencia → el segundo lanza `DuplicatePagoError`.
  - Crear 2 pagos idénticos con 11 minutos de diferencia → el segundo se inserta normalmente.
  - Crear 2 pagos con distinto `monto` (todo lo demás igual) → no duplicado.
  - Crear 2 pagos con distinto `banco_id` → no duplicado.
  - Crear 2 pagos con distinto `fecha_comprobante` → no duplicado.
  - Crear 2 pagos idénticos con header `X-Confirm-Duplicate: true` → ambos insertados.
  - Si existe un pago anulado/eliminado idéntico, **no** debe contar como duplicado (ya no está activo).

## Archivos a modificar

- [backend/services/pagos.service.js](../backend/services/pagos.service.js)
- [backend/controllers/pagos.controller.js](../backend/controllers/pagos.controller.js)
- [backend/index.js](../backend/index.js) (lectura de env var)
- [backend/tests/pagos.service.test.js](../backend/tests/) (extender o crear)
- [docs/DEPLOY.md](../docs/DEPLOY.md) (documentar `DUPLICATE_WINDOW_MINUTES`)

## Criterios de aceptación

- [ ] `POST /api/pagos` con datos repetidos en ventana de 10 min responde 409 con `code: 'DUPLICATE_PAGO'` y el snapshot del existente.
- [ ] Mismo request con header `X-Confirm-Duplicate: true` responde 201 e inserta normalmente.
- [ ] Pagos eliminados (TICKET-085) o anulados históricos no cuentan como duplicado.
- [ ] La constante `DUPLICATE_WINDOW_MINUTES` es ajustable vía env var.
- [ ] Tests unitarios verdes para los 7 casos listados.

## Notas

- Comparar `monto` con tolerancia exacta tras parseo numérico (`Number(value).toFixed(2)`); evitar problemas de coma flotante.
- Para `fecha_comprobante` comparar solo `YYYY-MM-DD` (recortar el componente de hora si lo hubiera).
- La búsqueda en la ventana debe ser eficiente: si el listado de pagos es grande, considerar limitarla a los últimos N minutos al cargar (slicing por `fecha_registro` descendente). En primera implementación basta con filtrar todo y trabajar in-memory; si se vuelve lento, revisar paginación.
- No aplicar la detección a `update()`: el ticket es exclusivo del POST.
- Esta funcionalidad **no** se extiende a ingresos/gastos en este ticket; queda como mejora futura si se requiere.
