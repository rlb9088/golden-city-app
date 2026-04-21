# TICKET-081 — Backend: `caja_inicio_mes` por banco de agente

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P0
> **Esfuerzo estimado**: ~3.5h
> **Dependencias**: TICKET-060 (tabla `config_settings` debe existir), TICKET-070 (`getAgentCajaAt` debe existir)

---

## Contexto

Hoy cada agente tiene bancos propios, pero la caja de inicio de mes de cada banco es implícitamente cero: el balance arranca desde los ingresos y pagos históricos sin un monto inicial configurable. El admin necesita poder definir para cada banco de agente un monto fijo de arranque de mes, que se comporta exactamente como si fuera un ingreso registrado antes del primer movimiento.

El `caja_inicio_mes` global del admin (para el balance global) **no se toca** en este ticket.

## Diseño de almacenamiento

Reutilizar la tabla `config_settings` existente (creada en TICKET-060) con **keys compuestas**:

```
caja_inicio_mes:banco:<banco_id>
```

Ejemplo: si un banco de agente tiene `id = "banco-abc123"`, su key es `caja_inicio_mes:banco:banco-abc123`.

- `value`: monto decimal (string en Sheets, parseado como Number en backend).
- `fecha_efectiva`: fecha ISO desde la cual aplica el valor; si la fecha consultada en Mi Caja es anterior a `fecha_efectiva`, el monto inicial de ese banco es 0.
- `actualizado_por`, `actualizado_en`: trazabilidad de auditoría, igual que el setting global.

Este diseño no requiere modificar el schema de `config_bancos`.

## Alcance

### 1. Config Service — [backend/services/config.service.js](../backend/services/config.service.js)

- Nueva función `getCajaInicioMesByBanco(bancoId)`:
  - Llama a `getSetting(`caja_inicio_mes:banco:${bancoId}`)`.
  - Si no existe, devuelve `{ value: 0, fecha_efectiva: null }`.
  - Si existe, devuelve `{ value: Number(record.value), fecha_efectiva: record.fecha_efectiva }`.
- Extender `upsertSetting` (o crear alias) para aceptar keys con el prefijo `caja_inicio_mes:banco:` sin romper la validación existente. El schema Zod debe aceptar ese formato de key.

### 2. Routes — [backend/routes/config.routes.js](../backend/routes/config.routes.js)

Nuevas rutas dedicadas (alternativa a la ruta genérica por key):

```
GET  /api/config/settings/caja_inicio_mes/banco/:bancoId
PUT  /api/config/settings/caja_inicio_mes/banco/:bancoId
```

**Autorización:**
- `GET`: `verifyToken` + validar que el usuario es admin **O** que el banco pertenece al agente que hace la petición (usar `getBankClassificationFromRecord` + `propietario_id === req.user.id`). Si el banco no le pertenece al agente: 403.
- `PUT`: `verifyToken` + `requireAdmin`. Solo el admin puede editar. Si se intenta con token de agente: 403.
- Rechazar `PUT` sobre bancos cuyo propietario sea admin (solo aplica a bancos de agentes): 400 con mensaje descriptivo.

**Body del PUT** (Zod):
```json
{ "value": 1500.00, "fecha_efectiva": "2026-04-01" }
```

### 3. Balance Service — [backend/services/balance.service.js](../backend/services/balance.service.js)

Modificar `getAgentCajaAt()` (líneas 428-479) para incorporar la caja inicial por banco:

- Al construir la lista de bancos del agente, para cada banco llamar a `getCajaInicioMesByBanco(banco.id)`.
- Aplicar el `value` como ingreso inicial si `fecha_efectiva` ≤ `fecha` consultada (o si `fecha_efectiva` es null, no aplica).
- Sumar el monto inicial al `saldo` del banco correspondiente en el resultado de `bancos[]`.
- Sumar el total de montos iniciales de todos los bancos al `montoInicial` devuelto en el KPI principal.

La semántica es idéntica a un ingreso previo: aumenta el saldo del banco y el total de Mi Caja.

### 4. Seed — [backend/scripts/setupSheets.js](../backend/scripts/setupSheets.js)

Añadir lógica idempotente que, al detectar bancos de agentes en `config_bancos` sin su key en `config_settings`, inserte un registro `value=0, fecha_efectiva=null` para cada uno. Esto evita que la función `getCajaInicioMesByBanco` tenga que manejar el caso "key inexistente" en producción.

### 5. Tests — [backend/tests/](../backend/tests/)

Extender o crear tests para:
- `getCajaInicioMesByBanco`: banco sin key → devuelve 0; banco con key → devuelve el valor.
- `getAgentCajaAt` con caja inicial:
  - Agente con 2 bancos, `banco-A` con caja inicial S/ 500 y `banco-B` con S/ 200.
  - Consultar fecha posterior a ambas `fecha_efectiva` → `montoInicial = 700`, saldos correctos.
  - Consultar fecha anterior a `fecha_efectiva` de `banco-A` → ese banco aporta 0 al inicial.
  - Anulaciones no afectan los totales.
- Autorización: `PUT` con token de agente → 403.

## Archivos a modificar

- [backend/services/config.service.js](../backend/services/config.service.js)
- [backend/services/balance.service.js](../backend/services/balance.service.js)
- [backend/routes/config.routes.js](../backend/routes/config.routes.js)
- [backend/scripts/setupSheets.js](../backend/scripts/setupSheets.js)
- [backend/tests/](../backend/tests/) — tests de config y balance service.

## Criterios de aceptación

- [ ] `GET /api/config/settings/caja_inicio_mes/banco/:id` responde 200 con `{ value: 0, fecha_efectiva: null }` si no hay registro.
- [ ] `PUT` con token admin persiste el valor; relecura confirma el nuevo monto.
- [ ] `PUT` con token de agente → 403.
- [ ] `GET` con token de agente sobre banco que no le pertenece → 403.
- [ ] En Mi Caja, un agente con banco configurado en S/ 500 ve `montoInicial` incluyendo esos S/ 500 y el saldo de ese banco arranca en S/ 500 antes de cualquier movimiento.
- [ ] `fecha_efectiva` posterior a la fecha consultada → el monto inicial de ese banco no se aplica.
- [ ] Tests verdes.

## Notas

- El `caja_inicio_mes` global admin (key simple sin prefijo de banco) no se modifica en este ticket.
- Mantener compatibilidad con el script E2E de TICKET-076; si hace falta actualizar el seed de datos, hacerlo.
