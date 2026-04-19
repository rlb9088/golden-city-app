# TICKET-048: `banco_id` como FK en pagos, ingresos, gastos y bancos

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~3h
> **Prioridad**: P0 — Prerequisito de filtros determinísticos por propietario

---

## Problema

Las hojas `pagos`, `ingresos`, `gastos` y `bancos` (saldos) almacenan el banco como **string libre** (`banco: "BBVA"`). No hay relación con `config_bancos`. Esto produce ambigüedad:

- Si Paolo y Juan tienen un banco llamado "BBVA" (con propietario distinto en `config_bancos`), un pago que dice `banco: "BBVA", agente: "Paolo"` no está realmente enlazado a la fila correcta — se deduce por convención.
- El filtrado por propietario (TICKET-049, TICKET-050) queda frágil si se basa en nombre.

---

## Solución

Añadir `banco_id` como columna explícita en todas las hojas de movimientos. `banco_id` es FK a `config_bancos.id` y es el campo canónico. El texto `banco` (nombre) se mantiene desnormalizado para lectura rápida.

### Schema afectado

| Hoja       | Columnas nuevas | Columnas existentes relevantes |
|------------|-----------------|--------------------------------|
| `pagos`    | `banco_id`      | `banco` (mantener)             |
| `ingresos` | `banco_id`      | `banco` (mantener)             |
| `gastos`   | `banco_id`      | `banco` (mantener)             |
| `bancos`   | `banco_id`      | `banco` (mantener)             |

---

## Acciones

### Backend

1. **Schema**: `backend/config/sheetsSchema.js` — añadir `banco_id` en pagos, ingresos, gastos, bancos (antes de `banco`).
2. **Script setup/verify**: que añada la columna si falta (`setupSheets.js`, `verifySheetsSetup.js`).
3. **Zod schemas**:
   - `schemas/pagos.schema.js`, `ingresos.schema.js`, `gastos.schema.js`, `bancos.schema.js`: `banco_id` requerido (string); `banco` opcional (el service lo resuelve del id).
4. **Services**:
   - `pagos.service.js`, `ingresos.service.js`, `gastos.service.js`, `bancos.service.js`:
     - Al crear/editar: recibir `banco_id` → buscar en `config_bancos` → desnormalizar `banco` (nombre) y `propietario_id` si aplica.
     - `validateReferences` usa `banco_id` (no nombre).
5. **Auditoría**: los logs incluyen ambos campos.

### Frontend

1. **`lib/api.ts`**: tipos `PagoRecord`, `IngresoRecord`, `GastoRecord`, `BancoRecord` con `banco_id`.
2. **Formularios de pagos, ingresos, gastos, bancos**: el `<select>` de banco envía `banco_id` (value = id, label = nombre). El submit envía `banco_id` al backend.
3. **Tablas**: siguen mostrando `banco` (nombre) en la columna.

### Tests

- Actualizar tests existentes que crean pagos/ingresos/gastos para usar `banco_id`.
- Nuevo test: crear pago con `banco_id` inexistente → warning referencial, pago se crea igualmente (coherente con ADR-012).

---

## Archivos

- `backend/config/sheetsSchema.js`
- `backend/schemas/{pagos,ingresos,gastos,bancos}.schema.js`
- `backend/services/{pagos,ingresos,gastos,bancos}.service.js`
- `backend/scripts/{setupSheets,verifySheetsSetup}.js`
- `backend/tests/*.test.js` (actualizaciones)
- `frontend/src/lib/api.ts`
- `frontend/src/app/{pagos,ingresos,gastos,bancos}/page.tsx`

## Dependencias

- No requiere TICKET-047 para compilar, pero el scoping por propietario (TICKET-049/050) depende de ambos.
- La **migración de datos históricos** la cubre **TICKET-053**.

## Criterios de Aceptación

- [ ] Las hojas `pagos`, `ingresos`, `gastos`, `bancos` tienen columna `banco_id`.
- [ ] Todo registro nuevo incluye `banco_id` válido.
- [ ] El backend rechaza (o advierte) cuando `banco_id` no existe en `config_bancos`.
- [ ] Frontend envía `banco_id`; tablas muestran `banco` (nombre) como antes.
- [ ] Tests pasan con el nuevo contrato.

## Definición de Terminado

- `banco_id` es el campo canónico en todos los movimientos.
- Ya es posible filtrar movimientos/bancos por propietario sin ambigüedad.
