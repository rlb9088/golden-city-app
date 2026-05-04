# TICKET-099 — Balance: variación de caja del día y acumulada

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P1
> **Esfuerzo estimado**: ~5h
> **Dependencias**: TICKET-098 (los 6 indicadores básicos ya disponibles en `getBalanceAt`)

---

## Contexto

Agregar al módulo Balance los 2 indicadores más complejos del Sprint: la **variación de caja del día** y la **variación de caja acumulada**. Estas métricas miden la diferencia entre el cambio observado en los saldos (bancos admin + cajas agentes) y el cambio esperado por las operaciones registradas (balance de ingresos − gastos).

**Decisión confirmada**: "total en cajeros" = `cajasAgentes.total` del balance actual (bancos clasificados como `agent` en `config_bancos`). Reutilizar `getCajasAgentesAt()` ya existente.

## Fórmulas

### Variación de caja del día (fecha F)

```
variacionCajaDia(F) =
    (bancosAdminAt(F).total      - bancosAdminAt(F-1).total)
  + (cajasAgentesAt(F).total     - cajasAgentesAt(F-1).total)
  - (
      (depositosRealesDia(F) - retirosRealesDia(F))
      - gastosDelDia(F).total
    )
```

Interpretación: cuánto creció (o cayó) la caja por encima/debajo de lo esperado por las operaciones netas del día.

### Variación de caja acumulada (fecha F)

```
variacionCajaAcumulada(F) = sum_{d in [F0..F]}( variacionCajaDia(d) )
```

Donde `F0` es la primera fecha con datos en cualquiera de las hojas relevantes (depósitos, retiros, bonos, retiros no pagados, bancos snapshots, ingresos, pagos, gastos). Equivalente operativamente a iterar día por día desde la primera fecha del sistema.

## Alcance

### 1. Backend — [backend/services/balance.service.js](../backend/services/balance.service.js)

#### Nueva función `getVariacionCajaDia(fecha, context)`

```js
async function getVariacionCajaDia(fecha, context) {
  const fechaPrev = previousDay(fecha);

  const [bancosF, bancosPrev, cajasF, cajasPrev, depositosF, retirosF, bonosF, rnpF, gastosF] = await Promise.all([
    getBancosAdminAt(fecha, { context }),
    getBancosAdminAt(fechaPrev, { context }),
    getCajasAgentesAt(fecha, { context }),
    getCajasAgentesAt(fechaPrev, { context }),
    getDepositosTotalesAt(fecha, { exactDate: true, context }),
    getRetirosTotalesAt(fecha, { exactDate: true, context }),
    getBonosTotalesAt(fecha, { exactDate: true, context }),
    getRetirosNoPagadosAt(fecha, { exactDate: true, context }),
    getGastosDelDia(fecha, context),
  ]);

  const depositosRealesDia = depositosF.total - bonosF.total;
  const retirosRealesDia = retirosF.total - rnpF.total;

  return (
    (bancosF.total - bancosPrev.total)
    + (cajasF.total - cajasPrev.total)
    - ((depositosRealesDia - retirosRealesDia) - gastosF.total)
  );
}
```

Helper `previousDay(fecha)` — retorna `YYYY-MM-DD` del día anterior en zona Lima.

Si para alguna fecha no hay datos previos (primer día del sistema), considerar `bancosPrev = 0` y `cajasPrev = 0`.

#### Nueva función `getVariacionCajaAcumulada(fecha, context)`

```js
async function getVariacionCajaAcumulada(fecha, context) {
  const fechaInicio = await getFirstDataDate(context);
  if (!fechaInicio) return 0;

  let total = 0;
  for (let d = fechaInicio; d <= fecha; d = nextDay(d)) {
    total += await getVariacionCajaDia(d, context);
  }
  return total;
}
```

Helper `getFirstDataDate(context)` — escanea la fecha mínima entre todas las hojas relevantes. Cachear el resultado en el `context` por request.

#### Optimización

- **Cache agresivo en context**: `getBancosAdminAt`, `getCajasAgentesAt`, `getGastosDelDia` y las cuatro `getXxxTotalesAt` deben memoizar por `fecha` dentro del `context`. Esto convierte el O(N²) ingenuo en O(N) prácticamente, ya que cada fecha se consulta a lo sumo 2 veces (en su día y como "día anterior" del siguiente).
- Si la performance sigue degradándose con históricos largos, considerar una variante batch de los aggregations que pre-agrupa por fecha en una sola pasada por la hoja.

#### Extender `getBalanceAt({ fecha })`

Agregar al snapshot:

```js
{
  // ... campos del ticket 098,
  variacionCajaDia: number,
  variacionCajaAcumulada: number,
}
```

### 2. Tests backend — [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)

Casos a cubrir:
- Día único con datos: la variación = `(bancosF + cajasF) - ((dep_real - ret_real) - gastos)` con `bancosPrev = cajasPrev = 0`.
- Dos días consecutivos: validar que `variacionCajaAcumulada(F2) = variacionCajaDia(F1) + variacionCajaDia(F2)`.
- Día sin gastos: la fórmula sigue válida (gastos = 0).
- Día sin depósitos/retiros pero con cambio en bancos: la variación captura ese cambio.
- Performance smoke: balance con 60 días de datos termina en < 3s.

### 3. Frontend — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

Extender `BalanceSnapshot` con `variacionCajaDia` y `variacionCajaAcumulada`.

### 4. Frontend — [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)

Agregar 2 tarjetas KPI:
- "Variación de caja del día"
- "Variación de caja acumulada"

Coloreado por signo (verde ≥ 0, rojo < 0). Tooltip o ayuda contextual explicando que estas métricas miden el cuadre entre cambio en saldos y operaciones registradas — útil para detectar discrepancias.

## Archivos a modificar

- [backend/services/balance.service.js](../backend/services/balance.service.js)
- [backend/tests/balance.service.test.js](../backend/tests/balance.service.test.js)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)

## Criterios de aceptación

- [ ] `GET /api/balance?fecha=YYYY-MM-DD` retorna `variacionCajaDia` y `variacionCajaAcumulada`.
- [ ] Fórmula del día verificada manualmente: con datos dummy, la métrica calculada coincide con cálculo a mano.
- [ ] Acumulada coincide con suma de variaciones diarias.
- [ ] Performance: balance con histórico de ≥60 días tarda < 3s en cargar (incluyendo la acumulada).
- [ ] Frontend muestra las 2 tarjetas KPI con coloreado por signo.
- [ ] Tests backend pasan.
- [ ] `npm run typecheck` y `npm run lint` (frontend) pasan.

## Definición de Terminado

Las dos variaciones de caja se calculan correctamente, son visibles en el dashboard y los tests cubren tanto la corrección como un smoke de performance.

## Notas

- **Reuso clave**: `getBancosAdminAt`, `getCajasAgentesAt`, `getGastosDelDia` ya existen.
- **Precisión decimal**: usar el mismo patrón actual del balance (números JS estándar). Si en el futuro aparecen diferencias por floats, considerar `Decimal.js`, pero hoy no es necesario.
- **Edge case "primer día del sistema"**: si `fechaInicio === fecha`, la variación es solo del día actual sin restar nada (bancos previos y cajas previas son 0).
- **Edge case "fecha futura sin datos"**: la variación del día = 0 (todos los inputs son 0).
- **Si la métrica diaria no calza con la expectativa del usuario** después de UAT, queda reservado revisar la fórmula con él en TICKET-101 (documentación) antes del cierre.

## Resultado de implementacion

- `backend/services/balance.service.js` ahora calcula `variacionCajaDia` y `variacionCajaAcumulada` reutilizando los snapshots de bancos, cajas y totales por caja, con cache por request para mantener el recorrido histórico dentro de tiempo.
- `backend/tests/balance-service.test.js` cubre el caso del primer día, dos días consecutivos, ausencia de gastos, cambio puro en bancos y un smoke de 60 días.
- `frontend/src/lib/api.ts` expone los nuevos campos en `BalanceSnapshot` y `frontend/src/app/balance/page.tsx` muestra las dos tarjetas KPI con ayuda contextual y color por signo.
- `tasks/BACKLOG.md`, `context/memory/state.md` y `docs/architecture.md` quedaron sincronizados con el estado real del sprint.
