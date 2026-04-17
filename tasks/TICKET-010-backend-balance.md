# TICKET-010: Backend — Motor de balance (agente + global)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Implementar el cálculo de balance por agente y global del negocio.

## Archivos
- `backend/services/balance.service.js`
- `backend/controllers/balance.controller.js`
- `backend/routes/balance.routes.js`

## Dependencias
- TICKET-006, TICKET-007, TICKET-008, TICKET-009

## Criterios de Aceptación
- [x] GET `/api/balance` retorna balance global
- [x] GET `/api/balance/:agente` retorna balance de un agente
- [x] Fórmula global: Σ(cajas_agentes) + Σ(bancos_últimos) - Σ(gastos)
- [x] Fórmula agente: Σ(ingresos_agente) - Σ(pagos_agente)
- [x] Siempre recalcula desde fuente de verdad (no cachea)

## Definición de Terminado
- Balance se recalcula correctamente al agregar pagos/ingresos/gastos/bancos
- No hay estados cached que puedan desincronizarse
