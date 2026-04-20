# TICKET-064 — Tests unitarios de `balance.service` rediseñado

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~3h
> **Dependencias**: TICKET-062

---

## Contexto

El cálculo de Balance tiene varias ramas (con/sin fecha, carry-forward, anulados, primer día de mes). Es imprescindible una suite de tests que lo fije.

## Alcance

Crear `backend/tests/balance-service.test.js` con los siguientes casos:

1. **Sin fecha, data vacía** → todos los totales en 0.
2. **Con fecha específica y snapshot completo** → bancos admin suman solo los banco_id admin de esa fecha.
3. **Carry-forward**: snapshot para banco admin solo el día D−2; pide D → usa el de D−2.
4. **Modo "ahora" sin snapshot del día** → `bancos(ayer) + ingresos(hoy admin) − gastos(hoy admin)`.
5. **Bancos de agentes no cuentan como bancos admin**.
6. **Anulados excluidos** en ingresos, pagos, gastos.
7. **Balance del día — primer día del mes**: D−1 sin data → `cajas(D-1)=0`, `bancos(D-1)` usa último anterior o 0.
8. **Balance acumulado** usa `caja_inicio_mes` del `config_settings`.
9. **Desglose por agente**: incluye agentes con movimientos y omite los que no.
10. **Desglose por subcategoría de gasto**: agrupa correctamente.

Usar fixtures in-memory (repo ya soporta modo memoria sin credenciales).

## Criterios de aceptación

- [ ] `npm test` ejecuta la nueva suite.
- [ ] Todos los casos en verde.
- [ ] Coverage razonable sobre `balance.service.js`.

## Notas

- Replicar patrón de suites existentes (p.ej. `backend/tests/` tests de servicios).
