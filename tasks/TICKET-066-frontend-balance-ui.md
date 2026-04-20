# TICKET-066 — UI Balance rediseñada (date-picker + 5 KPIs + 3 desgloses)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P1
> **Esfuerzo estimado**: ~4h
> **Dependencias**: TICKET-065

---

## Contexto

[frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) muestra 4 cards + 2 tablas. Requiere rediseño para reflejar la nueva semántica.

## Alcance

1. **Date picker** en el header:
   - Input `type="date"`, vacío por defecto.
   - Label: "Cierre al (dejar vacío = ahora)".
   - Al cambiar → refetch.
2. **5 StatsCards**:
   - Bancos (admin) — `bancosAdmin.total`.
   - Cajas de agentes — `cajasAgentes.total`.
   - Total Gastos — `totalGastos.total`.
   - Balance del día — `balanceDia`.
   - Balance acumulado — `balanceAcumulado`.
3. **3 tablas de detalle**:
   - **Balance por Agente**: cada agente y sus bancos con saldo (expandible o agrupado).
   - **Balance por Banco admin**: banco + saldo.
   - **Balance por categoría de gasto**: subcategoría + monto (agrupadas por categoría).
4. Empty states para cada tabla.
5. Mantener `AlertBanner`, `TableSkeleton`, y loading states.
6. Solo admin ve la página completa (el sidebar ya filtra, pero validar con `useAuth`).

## Criterios de aceptación

- [ ] Date picker vacío → modo "ahora"; con fecha → snapshot al cierre.
- [ ] 5 KPIs correctos y con colores (positivo/negativo/neutral).
- [ ] 3 tablas renderizan con la data del backend.
- [ ] Responsive en mobile.
- [ ] No errores de TypeScript.

## Notas

- Respetar [frontend/AGENTS.md](../frontend/AGENTS.md): **no asumir APIs de Next.js del training data**; leer `node_modules/next/dist/docs/` si hay dudas.
- Reusar `StatsCard` existente.
