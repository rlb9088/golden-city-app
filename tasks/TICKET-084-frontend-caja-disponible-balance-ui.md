# TICKET-084 — Frontend: dashboard con "Caja disponible" y nuevo "Balance acumulado"

> **Estado**: ✅ COMPLETADO
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: TICKET-083 (backend ya devuelve `cajaDisponible` y la nueva fórmula)

---

## Contexto

Tras TICKET-083 el endpoint `GET /api/balance` renombra `balanceDia` → `cajaDisponible` y actualiza la fórmula de `balanceAcumulado`. El dashboard admin debe consumir el nuevo contrato y reemplazar la tarjeta "Balance del día" por **"Caja disponible"**. La tarjeta "Balance acumulado" no requiere cambios de UI (la nueva fórmula vive en el backend); solo conviene actualizar tooltip/copy si menciona la fórmula explícitamente.

## Alcance

### 1. Tipo `BalanceSnapshot` — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- En la interfaz `BalanceSnapshot` (líneas 741–758 aprox.), renombrar:
  ```ts
  balanceDia: number;
  ```
  por:
  ```ts
  cajaDisponible: number;
  ```
- Verificar que `getBalanceSnapshot()` (o equivalente) reenvíe la propiedad sin transformaciones.

### 2. UI dashboard — [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx)

- En el bloque de KPIs (líneas 381–415 aprox.):
  - Cambiar la tarjeta etiquetada "Balance del día" por **"Caja disponible"**.
  - El valor mostrado pasa de `snapshot.balanceDia` a `snapshot.cajaDisponible`.
  - Actualizar tooltip / texto auxiliar para describir la nueva fórmula:
    - "Bancos admin + Cajas agentes − Caja inicio mes"
  - Actualizar el tooltip de "Balance acumulado" si existe, a:
    - "Bancos + Cajas + Gastos − Caja inicio mes"
- Mantener el orden visual y los iconos/colores actuales.

### 3. Snapshots / tests

- Si hay snapshots de Vitest/Jest del dashboard, actualizarlos para reflejar el nuevo label y campo.
- Si hay tests unitarios que tipan `BalanceSnapshot`, actualizar el mock.

## Archivos a modificar

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — tipo `BalanceSnapshot`.
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) — KPI "Caja disponible" y tooltip de "Balance acumulado".
- Cualquier `*.test.ts(x)` o `__snapshots__` que referencie `balanceDia` o "Balance del día".

## Criterios de aceptación

- [x] El dashboard ya no muestra "Balance del día"; en su lugar muestra "Caja disponible" con el valor de `cajaDisponible`.
- [x] No quedan referencias a `balanceDia` en `frontend/`.
- [x] El valor mostrado coincide con `bancosAdmin.total + cajasAgentes.total − cajaInicioMes` al consumir directamente `cajaDisponible` del contrato backend.
- [x] El tooltip/copy de "Balance acumulado" describe la nueva fórmula (suma de gastos).
- [x] `npm run typecheck` (o el script equivalente del repo) pasa sin errores.

## Resultado

- `BalanceSnapshot` en frontend consume `cajaDisponible` en lugar de `balanceDia`.
- El dashboard admin reemplaza el KPI "Balance del dia" por "Caja disponible".
- El copy auxiliar de "Caja disponible" y "Balance acumulado" refleja las formulas vigentes del backend.
- No quedan referencias a `balanceDia` en `frontend/`.

## Validacion

- `npm run lint` ✅
- `npm run test` ✅
- `npm run build` ✅
- `node --test tests/balance-service.test.js` ✅

## Notas

- No tocar la vista Mi Caja del agente ([frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx)): este ticket es solo el dashboard del admin.
- Si la página tiene un date-picker (TICKET-077), seguir respetando el filtro de fecha; el nuevo campo viaja por el mismo endpoint con `?fecha=`.
