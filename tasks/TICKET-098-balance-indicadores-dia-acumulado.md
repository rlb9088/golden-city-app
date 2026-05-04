# TICKET-098 — Balance: indicadores diarios y acumulados (depósitos/retiros reales y balance ingresos)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~6h
> **Dependencias**: TICKET-094, TICKET-095, TICKET-096, TICKET-097 (los 4 módulos operativos)

---

## Contexto

Una vez los 4 módulos de "totales por caja" están operativos, el módulo Balance debe consumir esos datos para calcular y exponer **6 indicadores nuevos** (3 del día seleccionado + 3 acumulados hasta ese día):

1. **Depósitos reales del día** = depósitos del día − bonos del día
2. **Retiros reales del día** = retiros del día − retiros no pagados del día
3. **Balance de ingresos del día** = depósitos reales del día − retiros reales del día
4. **Depósitos reales acumulados** = depósitos acumulados ≤ fecha − bonos acumulados ≤ fecha
5. **Retiros reales acumulados** = retiros acumulados ≤ fecha − retiros no pagados acumulados ≤ fecha
6. **Balance de ingresos acumulado** = depósitos reales acumulados − retiros reales acumulados

"Acumulado hasta una fecha" significa: por cada caja, el último snapshot registrado con `fecha ≤ targetDate`. Patrón ya implementado en `findLatestSnapshot()` de `balance.service.js`.

Este ticket cubre **solo** los 6 indicadores nuevos. La variación de caja queda para TICKET-099 y el detalle por caja para TICKET-100.

## Alcance

### 1. Backend — [backend/services/balance.service.js](../backend/services/balance.service.js)

#### Nuevas funciones de soporte

Crear cuatro funciones paralelas a `getBancosAdminAt()`, cada una sumando snapshots por caja:

```js
async function getDepositosTotalesAt(fecha, { exactDate = false, context }) { ... }
async function getRetirosTotalesAt(fecha, { exactDate = false, context }) { ... }
async function getBonosTotalesAt(fecha, { exactDate = false, context }) { ... }
async function getRetirosNoPagadosAt(fecha, { exactDate = false, context }) { ... }
```

Cada una:
- Lee de la hoja correspondiente (`depositos_totales`, `retiros_totales`, etc.).
- Filtra registros activos.
- **Si `exactDate: true`** → toma solo registros con `fecha === targetDate`.
- **Si `exactDate: false`** → para cada `caja_id`, toma el snapshot más reciente con `fecha ≤ targetDate` (usar `findLatestSnapshot` o helper análogo).
- Suma `monto` agrupando por `caja_id`.
- Retorna `{ total: number, detalle: [{ caja_id, caja, monto }] }`.

Cachear por request usando el `context` ya en uso para evitar lecturas duplicadas.

#### Extender `getBalanceAt({ fecha })`

Calcular y agregar al snapshot:

```js
const depositosDia = await getDepositosTotalesAt(fecha, { exactDate: true, context });
const retirosDia = await getRetirosTotalesAt(fecha, { exactDate: true, context });
const bonosDia = await getBonosTotalesAt(fecha, { exactDate: true, context });
const retirosNoPagadosDia = await getRetirosNoPagadosAt(fecha, { exactDate: true, context });

const depositosAcum = await getDepositosTotalesAt(fecha, { exactDate: false, context });
const retirosAcum = await getRetirosTotalesAt(fecha, { exactDate: false, context });
const bonosAcum = await getBonosTotalesAt(fecha, { exactDate: false, context });
const retirosNoPagadosAcum = await getRetirosNoPagadosAt(fecha, { exactDate: false, context });

const depositosRealesDia = depositosDia.total - bonosDia.total;
const retirosRealesDia = retirosDia.total - retirosNoPagadosDia.total;
const balanceIngresosDia = depositosRealesDia - retirosRealesDia;

const depositosRealesAcumulado = depositosAcum.total - bonosAcum.total;
const retirosRealesAcumulado = retirosAcum.total - retirosNoPagadosAcum.total;
const balanceIngresosAcumulado = depositosRealesAcumulado - retirosRealesAcumulado;
```

Agregar todos al objeto retornado, además de los detalles raw (`depositosDia`, etc.) si conviene para futuros tickets (099, 100).

### 2. Tests backend — [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)

Casos a cubrir:
- Día sin datos en ninguna de las 4 hojas → todos los nuevos campos = 0.
- Día con depósitos y bonos → `depositosRealesDia` correcto.
- Día con retiros y retiros no pagados → `retirosRealesDia` correcto.
- Acumulado con UPSERT (registro reemplazado) → solo el último monto cuenta.
- Acumulado con múltiples cajas y fechas mixtas → suma correcta usando `findLatestSnapshot`.

### 3. Frontend — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

Extender `BalanceSnapshot`:

```ts
export interface BalanceSnapshot {
  // ... campos existentes,
  depositosRealesDia: number;
  retirosRealesDia: number;
  balanceIngresosDia: number;
  depositosRealesAcumulado: number;
  retirosRealesAcumulado: number;
  balanceIngresosAcumulado: number;
  // (Detalles internos opcionales, ver TICKET-100 para el detalle por caja)
}
```

### 4. Frontend — [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)

Agregar 6 tarjetas KPI nuevas, organizadas en 2 sub-secciones visualmente distintas:

**Sección "Del día seleccionado":**
- Depósitos reales del día
- Retiros reales del día
- Balance de ingresos del día

**Sección "Acumulado hasta el día":**
- Depósitos reales acumulados
- Retiros reales acumulados
- Balance de ingresos acumulado

Reutilizar las clases CSS existentes `.balance-stats` o introducir un grid nuevo `.balance-stats-extended` si el layout lo requiere.

Formatear con `formatCurrency`. Tarjetas de "Balance" pueden colorearse según signo (verde ≥ 0, rojo < 0).

### 5. CSS — [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css)

Ajustar grid y/o agregar estilos para las nuevas sub-secciones. Mantener responsive.

## Archivos a modificar

- [backend/services/balance.service.js](../backend/services/balance.service.js)
- [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)
- [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css)

## Criterios de aceptación

- [x] `GET /api/balance?fecha=YYYY-MM-DD` retorna los 6 nuevos campos numéricos.
- [x] Sin datos: todos los nuevos campos son `0`.
- [x] UPSERT respetado: si un mismo (fecha + caja) se registra dos veces, el cálculo usa el último monto.
- [x] `depositosRealesDia + retirosRealesDia` resulta en `balanceIngresosDia` correcto en escenario manual.
- [x] Mismo para versiones acumuladas.
- [x] Frontend muestra las 6 tarjetas KPI con `formatCurrency` y separación visual de "día" vs "acumulado".
- [x] Tests backend pasan: `cd backend && npm test`.
- [x] `cd frontend && npm run typecheck && npm run lint` pasan.

## Definición de Terminado

El balance global integra y muestra correctamente los 6 nuevos indicadores. El cálculo es robusto frente a UPSERTs y acumulación. Los tests cubren los caminos principales.

## Notas

- **No tocar** la vista del agente (`MiCajaView.tsx`); los nuevos indicadores son globales.
- Si hubiese más de un snapshot en la misma fecha+caja (no debería por UPSERT, pero si pasa por edición manual del sheet), tomar el de mayor `_rowIndex` (mismo patrón que `bancos`).
- Performance: para acumulados, una sola lectura por hoja por request es suficiente; el `context` se encarga de cachear.
- Este ticket prepara los detalles internos (`depositosDia.detalle`, etc.) que TICKET-100 expondrá disgregados por caja. Si esos detalles ya están calculados aquí, dejarlos en el snapshot o en el contexto para reutilizar.

## Resultado de implementacion

- `backend/services/balance.service.js` ahora calcula y expone `depositosRealesDia`, `retirosRealesDia`, `balanceIngresosDia`, `depositosRealesAcumulado`, `retirosRealesAcumulado` y `balanceIngresosAcumulado`.
- Se agregaron los snapshots raw por caja para día y acumulado (`depositosDia`, `retirosDia`, `bonosDia`, `retirosNoPagadosDia`, y sus equivalentes acumulados) para reutilización futura.
- `frontend/src/lib/api.ts` y `frontend/src/app/balance/page.tsx` muestran dos bloques separados de KPIs: día seleccionado y acumulado hasta el día.
- `frontend/src/app/balance/balance.css` incorpora el layout responsive para las nuevas subsecciones.
- La documentación operativa del sprint quedó sincronizada en `tasks/BACKLOG.md`, `context/memory/state.md` y `docs/architecture.md`.
