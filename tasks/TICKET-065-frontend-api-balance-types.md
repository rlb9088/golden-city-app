# TICKET-065 — Frontend `lib/api.ts`: tipos + filtro de fecha

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1h
> **Dependencias**: TICKET-063

---

## Contexto

[frontend/src/lib/api.ts](../frontend/src/lib/api.ts) expone hoy `getBalance()` devolviendo `GlobalBalance` con los campos del cálculo viejo. Hay que alinear los tipos con la nueva respuesta del backend.

## Alcance

1. Añadir tipo `BalanceSnapshot`:
   ```ts
   type BalanceSnapshot = {
     fecha: string | null;
     bancosAdmin: { total: number; detalle: { banco_id: string; banco: string; saldo: number }[] };
     cajasAgentes: { total: number; detalle: { agente: string; bancos: { banco_id: string; banco: string; saldo: number }[] }[] };
     totalGastos: { total: number; detalle: { categoria: string; subcategoria: string; monto: number }[] };
     balanceDia: number;
     balanceAcumulado: number;
     cajaInicioMes: number;
   };
   ```
2. Actualizar firma: `getBalance(fecha?: string): Promise<{ data: BalanceSnapshot }>`.
3. Añadir helpers `getSetting(key)` y `updateSetting(key, value, fechaEfectiva)` para `config_settings` (TICKET-060).
4. Mantener `getAgentBalance(agente)` tal cual.

## Criterios de aceptación

- [ ] Tipo publicado y exportado.
- [ ] Compila sin `any`.
- [ ] `GlobalBalance` antiguo removido (o marcado deprecated si alguna page legacy lo usa).

## Notas

- Respetar [frontend/AGENTS.md](../frontend/AGENTS.md) — Next.js nuevo, no asumir APIs del training data.
