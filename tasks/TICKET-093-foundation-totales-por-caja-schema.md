# TICKET-093 — Foundation: schema y patrón "totales por caja"

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna

---

## Contexto

Sprint 17 introduce 4 módulos nuevos cuyo funcionamiento es idéntico al módulo Bancos pero registrando un dato único por **fecha + caja** (en lugar de fecha + banco): Depósitos totales, Retiros totales, Bonos totales y Retiros no pagados. Antes de implementar cada módulo conviene preparar el **schema compartido** en Google Sheets y dejar establecido el patrón en la documentación. Este ticket es la base sobre la que se apoyan TICKET-094 a TICKET-097.

## Alcance

### 1. Schema en Google Sheets — [backend/config/sheetsSchema.js](../backend/config/sheetsSchema.js)

Agregar 4 hojas nuevas con headers idénticos:

```js
depositos_totales:    ['id', 'fecha', 'caja_id', 'caja', 'monto']
retiros_totales:      ['id', 'fecha', 'caja_id', 'caja', 'monto']
bonos_totales:        ['id', 'fecha', 'caja_id', 'caja', 'monto']
retiros_no_pagados:   ['id', 'fecha', 'caja_id', 'caja', 'monto']
```

- `id` — UUID (`crypto.randomUUID()`).
- `fecha` — ISO `YYYY-MM-DD` (Lima).
- `caja_id` — FK a `config_cajas.id`.
- `caja` — denormalizado del nombre de la caja al momento del registro.
- `monto` — número decimal ≥ 0 (Soles).

### 2. Setup script — [backend/scripts/setupSheets.js](../backend/scripts/setupSheets.js)

- Asegurar que el script crea las 4 hojas si no existen y agrega los headers.
- Idempotente: si las hojas ya existen, no debe duplicarlas ni reescribir filas.
- Ejecutar `node backend/scripts/setupSheets.js` y validar que las 4 hojas aparecen en el spreadsheet de desarrollo.

### 3. Documentación del patrón — [docs/architecture.md](../docs/architecture.md)

Agregar (en la sección de modelo de datos / Sheets) una subsección breve "Totales por caja" que mencione:
- Las 4 hojas creadas y sus headers.
- El patrón UPSERT por `(fecha, caja_id)` (idéntico al de `bancos`).
- Permisos: admin-only en POST y GET (ver TICKET-094 ss.).

## Archivos a modificar

- [backend/config/sheetsSchema.js](../backend/config/sheetsSchema.js)
- [backend/scripts/setupSheets.js](../backend/scripts/setupSheets.js)
- [docs/architecture.md](../docs/architecture.md)

## Criterios de aceptación

- [x] `backend/config/sheetsSchema.js` exporta las 4 nuevas tablas con los headers indicados.
- [x] `node backend/scripts/setupSheets.js` crea las 4 hojas en un spreadsheet vacío y no falla si ya existen.
- [x] `docs/architecture.md` describe el patrón "totales por caja" en una subsección dedicada.
- [x] No se introduce regresión: tests existentes siguen pasando (`cd backend && npm test`).

## Definición de Terminado

Las 4 hojas pueden crearse en un spreadsheet real, los headers coinciden, la documentación de arquitectura referencia el patrón, y `setupSheets.js` queda idempotente.

## Notas

- No se crean controladores, services ni rutas en este ticket; eso queda para TICKET-094 a TICKET-097.
- Se exporta la constante compartida `TOTALES_POR_CAJA_HEADERS = ['id', 'fecha', 'caja_id', 'caja', 'monto']` para reutilizar en los siguientes tickets.

## Resultado de implementación

- Se agregó `TOTALES_POR_CAJA_HEADERS` y las cuatro hojas al schema central de Sheets.
- `setupSheets.js` ahora evita reescribir cabeceras cuando una hoja ya está alineada.
- La arquitectura documenta el patrón compartido y lo deja enlazado con el plan del Sprint 17.
