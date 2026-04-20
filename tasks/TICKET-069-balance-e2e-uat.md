# TICKET-069 - Pruebas E2E + checklist UAT del nuevo Balance

> **Estado**: COMPLETADO
> **Sprint**: 13 - Redisenio modulo Balance
> **Prioridad**: P2
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-064, TICKET-066, TICKET-067

---

## Contexto

Antes de dar por cerrado el redisenio de Balance, se valida end-to-end contra un spreadsheet real (o in-memory poblado) y se corre un UAT manual con el usuario.

## Alcance

1. **Script E2E**: `backend/scripts/verifyBalanceE2E.js`:
   - Siembra data deterministica (agentes, bancos admin/agente, ingresos, pagos, gastos, snapshot bancario, `caja_inicio_mes`).
   - Llama a `balance.service.getBalanceAt({ fecha })` para 3 fechas: inicio, medio, fin de mes.
   - Compara contra valores esperados. Falla con detalle si no cuadra.
2. **Checklist UAT manual** (agregar a `docs/uat-balance.md`):
   - [ ] Con fecha hoy sin registro en `bancos` -> calculo usa ayer + movimientos del dia.
   - [ ] Con fecha historica -> muestra snapshot correcto.
   - [ ] Anulados no afectan totales.
   - [ ] Desgloses cuadran con los totales (suma de detalle = total del KPI).
   - [ ] Editar `caja_inicio_mes` desde Configuracion impacta Balance acumulado.
   - [ ] Cambiar filtro de fecha actualiza todos los KPIs y tablas.
3. Documentar como correr el script en `docs/setup-guide.md`.

## Criterios de aceptacion

- [x] Script ejecutable con `node backend/scripts/verifyBalanceE2E.js` y pasa.
- [x] Checklist UAT disponible y ejecutado por el usuario al menos una vez.
- [x] Todos los items del UAT marcados OK antes de cerrar el sprint.

## Notas

- Si se detectan diferencias durante UAT, priorizar rollback o hotfix antes de cerrar.
- Implementacion: [backend/scripts/verifyBalanceE2E.js](../backend/scripts/verifyBalanceE2E.js), [docs/uat-balance.md](../docs/uat-balance.md), [docs/setup-guide.md](../docs/setup-guide.md).
