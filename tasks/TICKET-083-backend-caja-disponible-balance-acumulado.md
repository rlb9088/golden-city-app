# TICKET-083 — Backend: nueva fórmula `cajaDisponible` y suma de gastos en `balanceAcumulado`

> **Estado**: ✅ COMPLETADO
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna

---

## Contexto

El dashboard admin muestra hoy dos KPIs derivados (`balanceDia` y `balanceAcumulado`) cuyas fórmulas no reflejan lo que el negocio realmente quiere medir:

- "Balance del día" mide variación de activos respecto al cierre anterior, pero el negocio necesita saber **caja efectivamente disponible hoy** (lo que hay menos lo que arrancó el mes).
- "Balance acumulado" resta gastos, pero los gastos ya están reflejados como salidas en bancos/caja, lo que los descuenta dos veces. La fórmula correcta para auditar el comportamiento del mes es `bancos + caja + gastos − caja_inicio_mes`.

Este ticket cambia el contrato del endpoint `GET /api/balance` renombrando el campo `balanceDia` a `cajaDisponible` y ajustando la fórmula de `balanceAcumulado`. El frontend se actualiza en TICKET-084.

## Fórmulas nuevas

```
cajaDisponible   = bancosAdmin.total + cajasAgentes.total − cajaInicioMes
balanceAcumulado = bancosAdmin.total + cajasAgentes.total + totalGastos.total − cajaInicioMes
```

Ambas operan sobre los totales que ya calcula `loadBalanceContext()`. No se requieren nuevos campos de BD/Sheets.

## Alcance

### 1. Servicio — [backend/services/balance.service.js](../backend/services/balance.service.js)

- En el bloque que hoy calcula `balanceDia` y `balanceAcumulado` (alrededor de las líneas 605–615):
  - Eliminar el cálculo y la variable `previousAssets` si queda huérfano tras el cambio.
  - Eliminar el uso de `gastosDelDia.total` para este KPI (sigue calculándose si se usa para otros desgloses; revisar y limpiar si queda muerto).
  - Reemplazar:
    ```js
    const balanceDia = activosTotales - previousAssets - gastosDelDia.total;
    const balanceAcumulado = activosTotales - totalGastos.total - ctx.cajaInicioMes;
    ```
    por:
    ```js
    const cajaDisponible = bancosAdmin.total + cajasAgentes.total - ctx.cajaInicioMes;
    const balanceAcumulado = bancosAdmin.total + cajasAgentes.total + totalGastos.total - ctx.cajaInicioMes;
    ```
- En el snapshot devuelto, reemplazar la propiedad `balanceDia` por `cajaDisponible`. `balanceAcumulado` queda con el mismo nombre pero nueva fórmula.
- Si hay logs/comentarios que mencionan "balance del día", actualizarlos a "caja disponible".

### 2. Controller / Routes

- Verificar que [backend/controllers/balance.controller.js](../backend/controllers/balance.controller.js) y [backend/routes/balance.routes.js](../backend/routes/balance.routes.js) sólo reenvían el snapshot. No deberían requerir cambios. Si tipan/serializan explícitamente, propagar el rename.

### 3. Tests — [backend/tests/](../backend/tests/)

- Si existen tests de `balance.service` (TICKET-064), actualizarlos para:
  - Verificar la nueva clave `cajaDisponible` en el snapshot.
  - Comprobar la nueva aritmética de `balanceAcumulado` con un caso conocido:
    - `bancosAdmin.total = 1000`, `cajasAgentes.total = 500`, `totalGastos.total = 200`, `cajaInicioMes = 300` →
      - `cajaDisponible = 1200`
      - `balanceAcumulado = 1400`
- Añadir al menos un test que asegure que `balanceDia` ya no aparece en el snapshot.

## Archivos a modificar

- [backend/services/balance.service.js](../backend/services/balance.service.js)
- [backend/controllers/balance.controller.js](../backend/controllers/balance.controller.js) (revisar; cambio sólo si serializa explícitamente)
- [backend/routes/balance.routes.js](../backend/routes/balance.routes.js) (revisar)
- [backend/tests/balance.service.test.js](../backend/tests/) (si existe)

## Criterios de aceptación

- [x] `GET /api/balance` devuelve `cajaDisponible` en lugar de `balanceDia`.
- [x] `cajaDisponible = bancosAdmin.total + cajasAgentes.total − cajaInicioMes`.
- [x] `balanceAcumulado = bancosAdmin.total + cajasAgentes.total + totalGastos.total − cajaInicioMes`.
- [x] No hay referencias muertas a `previousAssets` ni a `balanceDia` en el servicio/controller/tests.
- [x] Tests unitarios verdes.

## Implementacion

- `backend/services/balance.service.js`: se elimino el calculo basado en activos del dia anterior para el snapshot global admin y se expone `cajaDisponible`.
- `backend/tests/balance-service.test.js` y `backend/tests/balance-excludes-anulled.test.js`: expectativas actualizadas y caso dedicado para verificar `cajaDisponible = 1200`, `balanceAcumulado = 1400`, y ausencia de `balanceDia`.
- `backend/scripts/verifyBalanceE2E.js`: fixture de UAT actualizado al nuevo contrato.
- `docs/PRD.md`, `docs/decisions.md`, `docs/uat-balance.md` y `tasks/BACKLOG.md`: documentacion sincronizada.

## Validacion

- `npm run lint` en `backend/`.
- `node --test tests/balance-service.test.js tests/balance-excludes-anulled.test.js tests/balance-route-date-param.test.js` en `backend/`.
- `npm test` en `backend/`.

## Notas

- Es un cambio breaking acotado: el único consumidor del snapshot es el frontend de balance, que se actualiza en TICKET-084. No hay otros clientes (mobile/integraciones) según el repo actual.
- No tocar `getAgentCajaAt()` (Mi Caja del agente); este ticket es exclusivo del balance global del admin.
- No tocar el cálculo de `cajaInicioMes` ni los desgloses `bancosAdmin.detalle` / `cajasAgentes.detalle` / `totalGastos.detalle`.
