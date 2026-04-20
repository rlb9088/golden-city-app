# TICKET-063 — `/api/balance` acepta `?fecha=YYYY-MM-DD`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~1h
> **Dependencias**: TICKET-062

---

## Contexto

El endpoint actual [backend/routes/balance.routes.js](../backend/routes/balance.routes.js) → [balance.controller.js](../backend/controllers/balance.controller.js) no acepta parámetros; siempre retorna el snapshot acumulado. La UI nueva necesita pasar una fecha opcional.

## Alcance

1. Añadir query param `fecha` al handler de `GET /api/balance`. Validar con Zod (`YYYY-MM-DD`, opcional).
2. Invocar `balance.service.getBalanceAt({ fecha })`.
3. Rechazar fechas futuras con 400.
4. Mantener `GET /api/balance/:agente` sin cambios.
5. Actualizar schema de respuesta en `lib/api.ts` (se hace en TICKET-065).

## Criterios de aceptación

- [ ] `GET /api/balance` retorna la nueva estructura.
- [ ] `GET /api/balance?fecha=2026-04-15` retorna snapshot al cierre de esa fecha.
- [ ] Fecha inválida → 400 con mensaje claro.
- [ ] Test de integración que cubre ambos modos.

## Notas

- Auth se mantiene (`requireAuth`) — cualquier usuario logueado puede consultar. Si se decide restringir a admin, añadir `requireAdmin`.
