# TICKET-060 — Tabla `config_settings` + endpoint para `caja_inicio_mes`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna

---

## Contexto

El nuevo cálculo de **Balance acumulado** requiere un valor estático configurable: "Caja total al inicio de mes". No existe hoy una tabla de settings genérica; las demás configs son listas (agentes, bancos, categorías, etc.). Se introduce una nueva hoja `config_settings` tipo key/value para alojar este y futuros ajustes singleton.

## Alcance

1. Añadir `config_settings` a [backend/config/sheetsSchema.js](../backend/config/sheetsSchema.js) con headers `['key', 'value', 'fecha_efectiva', 'actualizado_por', 'actualizado_en']`.
2. Actualizar [backend/scripts/setupSheets.js](../backend/scripts/setupSheets.js) y `verifySheetsSetup.js` para incluir la nueva hoja.
3. Crear endpoint:
   - `GET /api/config/settings/:key` (auth) — devuelve `{ key, value, fecha_efectiva }`.
   - `PUT /api/config/settings/:key` (admin) — upsert con validación Zod; audita en `audit`.
4. Seed inicial: `caja_inicio_mes = 0` con `fecha_efectiva` = primer día del mes actual.
5. Documentar la clave `caja_inicio_mes` (semántica, cuándo actualizarla).

## Criterios de aceptación

- [ ] Hoja `config_settings` creada por `setupSheets.js` en modo Sheets e in-memory.
- [ ] `GET/PUT /api/config/settings/caja_inicio_mes` funciona con auth correcta.
- [ ] Cambios registrados en la hoja `audit` con `entity='config_settings'`.
- [ ] Test backend que cubre upsert + lectura + auth guard.

## Notas

- El valor se guarda como número decimal (string en Sheets, parsed en backend).
- `fecha_efectiva` indica desde qué fecha aplica el valor para el cálculo de Balance acumulado.
