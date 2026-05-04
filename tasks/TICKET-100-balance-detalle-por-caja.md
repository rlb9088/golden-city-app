# TICKET-100 — Balance: detalle de balance de ingresos disgregado por caja

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P1
> **Esfuerzo estimado**: ~4h
> **Dependencias**: TICKET-098 (los detalles raw por caja ya disponibles en `getBalanceAt`)

---

## Contexto

Agregar a la sección de "detalle / cuadros" del módulo Balance dos tablas nuevas, una para el día y otra acumulada, mostrando el **balance de ingresos disgregado por caja**:

1. **Balance de ingresos del día por caja** — para cada caja: depósito real del día (depósitos − bonos) − retiro real del día (retiros − retiros no pagados) = balance.
2. **Balance de ingresos acumulado por caja** — la misma cuenta pero usando montos acumulados ≤ fecha.

## Alcance

### 1. Backend — [backend/services/balance.service.js](../backend/services/balance.service.js)

#### Función `buildBalancePorCaja({ depositos, retiros, bonos, retirosNoPagados, cajasConfig })`

Helper puro (sin I/O) que recibe los detalles raw por caja (que TICKET-098 ya calcula como `{ caja_id, caja, monto }[]`) y devuelve para cada caja en `config_cajas`:

```js
[{
  caja_id: string,
  caja: string,
  depositoReal: number,    // depositos[caja] - bonos[caja]
  retiroReal: number,      // retiros[caja] - retirosNoPagados[caja]
  balance: number,         // depositoReal - retiroReal
}]
```

- Iterar por **todas** las cajas configuradas (incluso las que no tienen datos: 0).
- Si una caja aparece en los detalles pero no en `config_cajas` (caja eliminada), incluirla al final con un flag `_orphan: true` o similar para que el frontend pueda señalarla.

#### Extender `getBalanceAt({ fecha })`

Agregar al snapshot:

```js
{
  // ... campos del ticket 098 y 099,
  balanceIngresosDiaPorCaja: [{ caja_id, caja, depositoReal, retiroReal, balance }],
  balanceIngresosAcumuladoPorCaja: [{ caja_id, caja, depositoReal, retiroReal, balance }],
}
```

Reutilizar los mismos `depositosDia.detalle`, `retirosDia.detalle`, `bonosDia.detalle`, `retirosNoPagadosDia.detalle` (versión `exactDate: true`) y sus equivalentes acumulados (`exactDate: false`) que ya calcula TICKET-098.

### 2. Tests backend — [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)

Casos a cubrir:
- Caja sin datos en ninguna hoja → fila con todos los valores = 0.
- Caja con depósitos pero sin bonos → `depositoReal == depositos`.
- Caja con datos en versión "día" pero no "acumulado" (caso teórico) → ambas tablas correctas.
- Suma de la columna `balance` de la tabla del día == `balanceIngresosDia` (KPI del ticket 098).
- Caja "huérfana" (existe en hojas pero no en `config_cajas`) aparece marcada.

### 3. Frontend — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

Extender `BalanceSnapshot`:

```ts
export interface BalanceCajaDetail {
  caja_id: string;
  caja: string;
  depositoReal: number;
  retiroReal: number;
  balance: number;
  _orphan?: boolean;
}

export interface BalanceSnapshot {
  // ... campos previos,
  balanceIngresosDiaPorCaja: BalanceCajaDetail[];
  balanceIngresosAcumuladoPorCaja: BalanceCajaDetail[];
}
```

### 4. Frontend — [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)

Agregar dos secciones de tipo tabla, en la zona de "detalle / cuadros" (después de las tarjetas KPI), reutilizando estilos `.balance-sections` y `.balance-nested-table`:

**Tabla 1: "Balance de ingresos del día por caja"**

| Caja | Depósito real | Retiro real | Balance |
|------|---------------|-------------|---------|
| Caja Principal | S/ 1,200.00 | S/ 800.00 | S/ 400.00 |
| ... | ... | ... | ... |
| **Total** | **S/ X** | **S/ Y** | **S/ Z** |

**Tabla 2: "Balance de ingresos acumulado por caja"** — misma estructura con datos acumulados.

- Pintar el `balance` con verde (≥ 0) / rojo (< 0).
- Si una fila es `_orphan`, agregar pequeño badge "caja eliminada" y tooltip aclaratorio.
- Mantener responsive (en mobile: scroll horizontal o pila vertical, según patrón actual del balance).

### 5. CSS — [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css)

Añadir estilos si las tablas nuevas requieren tweaks (ej: ancho mínimo de columna, alineación numérica derecha). Reutilizar lo posible.

## Archivos a modificar

- [backend/services/balance.service.js](../backend/services/balance.service.js)
- [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)
- [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css)

## Criterios de aceptación

- [x] `GET /api/balance?fecha=YYYY-MM-DD` retorna `balanceIngresosDiaPorCaja` y `balanceIngresosAcumuladoPorCaja` como arrays.
- [x] Cada caja en `config_cajas` aparece en cada array (aunque tenga monto 0).
- [x] Suma de la columna `balance` de la tabla del día coincide con `balanceIngresosDia` (KPI).
- [x] Misma coherencia para acumulado.
- [x] Caja huérfana (caja_id que no existe en `config_cajas`) aparece con `_orphan: true` y se renderiza con badge en frontend.
- [x] Tablas responsive en mobile.
- [x] Tests backend pasan.
- [x] `npm run typecheck` y `npm run lint` (frontend) pasan.

## Definición de Terminado

El balance global expone y muestra los 2 cuadros de detalle por caja, con coherencia matemática verificable contra los KPIs y manejo de cajas huérfanas.

## Resultado de Implementación

- `backend/services/balance.service.js` calcula y expone `balanceIngresosDiaPorCaja` y `balanceIngresosAcumuladoPorCaja` reutilizando los snapshots raw ya existentes y cruzándolos con `config_cajas`.
- `backend/tests/balance.service.test.js` cubre cajas en cero, coherencia contra el KPI, acumulado por snapshot y cajas huérfanas marcadas con `_orphan: true`.
- `frontend/src/lib/api.ts` tipa el nuevo detalle por caja y `frontend/src/app/balance/page.tsx` lo muestra en dos tablas responsivas con badge para cajas eliminadas.
- `frontend/src/app/balance/balance.css` añade los ajustes visuales para la tabla de detalle por caja.
- Documentación sincronizada en `tasks/BACKLOG.md`, `context/memory/state.md` y `docs/architecture.md`.

## Notas

- **Reutilizar** los detalles `[{ caja_id, caja, monto }]` que TICKET-098 ya retorna en `depositosDia.detalle`, etc. — no volver a leer las hojas.
- Si TICKET-098 no preservó esos detalles (porque solo expuso totales agregados), agregarlos al snapshot interno para reusarlos aquí.
- La tabla acumulada puede incluir filas con `0` si la caja aún no registró movimientos; mostrar de todas formas para visibilidad.
