# TICKET-076 — Docs, E2E y UAT de "Mi Caja"

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P2
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-070, TICKET-071, TICKET-072, TICKET-073, TICKET-074, TICKET-075

---

## Contexto

Una vez que todos los tickets del Sprint 14 están implementados, se valida end-to-end y se actualiza la documentación para reflejar la nueva semántica de la vista de agente.

## Alcance

### 1. Script E2E

Crear `backend/scripts/verifyMiCajaE2E.js` (paralelo a `verifyBalanceE2E.js`):

- Sembrar data determinista: 2 agentes, 2 bancos por agente, ingresos y pagos en 3 fechas distintas.
- Llamar a `getAgentCajaAt({ agente, fecha })` para:
  - Fecha inicio de rango.
  - Fecha intermedia (con pagos ese día).
  - Modo ahora (sin fecha).
- Comparar contra valores esperados calculados manualmente.
- Falla con mensaje descriptivo si algún valor no cuadra.
- Verificar que los datos de Agente A no aparecen en el resultado de Agente B.

Ejecutable con:
```sh
node backend/scripts/verifyMiCajaE2E.js
```

### 2. Checklist UAT manual

Agregar sección al final de [docs/uat-balance.md](../docs/uat-balance.md):

```markdown
## UAT — Mi Caja (agente)

- [ ] Agente logueado ve el link "Balance" en el sidebar.
- [ ] Al entrar a /balance como agente: muestra "Mi Caja" (no el dashboard admin).
- [ ] Sin fecha seleccionada → modo ahora; KPI y tablas muestran data del día actual.
- [ ] Con fecha histórica → KPI y tablas muestran snapshot al cierre de ese día.
- [ ] Botón "Limpiar" restaura modo ahora.
- [ ] Monto inicial + pagos del día cuadran con el saldo total mostrado en el KPI.
- [ ] Suma de saldos por banco = total "Mi caja".
- [ ] Agente sin movimientos → KPI en S/ 0.00, empty states en tablas.
- [ ] Anulados no afectan ningún total (registrar un pago, anularlo, verificar).
- [ ] Admin logueado en /balance sigue viendo dashboard de administrador completo.
- [ ] Un agente no puede ver la caja de otro (probar llamada directa a /api/balance/mi-caja con token de agente A → solo datos de A).
```

### 3. Actualizar documentación existente

- **[docs/setup-guide.md](../docs/setup-guide.md)**: agregar sección "Verificación Mi Caja" con instrucción para correr el script E2E nuevo.
- **PRD / [docs/architecture.md](../docs/architecture.md)** (si existe): mencionar que `/balance` tiene dos vistas según rol (admin → dashboard global, agente → Mi Caja personal).

## Criterios de aceptación

- [ ] `node backend/scripts/verifyMiCajaE2E.js` pasa sin errores.
- [ ] Checklist UAT disponible en `docs/uat-balance.md`.
- [ ] Todos los items del UAT marcados OK antes de cerrar el sprint.
- [ ] `docs/setup-guide.md` incluye el comando del nuevo script.

## Notas

- Si se detectan diferencias durante el UAT, crear un hotfix antes de cerrar el sprint.
- Replicar estructura del script `verifyBalanceE2E.js` existente para mantener consistencia.
