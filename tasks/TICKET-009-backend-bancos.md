# TICKET-009: Backend — Saldos Bancarios (upsert)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Implementar el registro de saldos bancarios diarios con lógica de upsert (sobrescribir si banco+fecha ya existe).

## Archivos
- `backend/schemas/bancos.schema.js`
- `backend/services/bancos.service.js`
- `backend/controllers/bancos.controller.js`
- `backend/routes/bancos.routes.js`

## Dependencias
- TICKET-002, TICKET-003, TICKET-004

## Criterios de Aceptación
- [x] POST `/api/bancos` crea o actualiza saldo (upsert by banco+fecha)
- [x] GET `/api/bancos` lista todos los saldos
- [x] `getLatest()` retorna el último saldo por banco
- [x] Si se sobrescribe, se audita con saldo anterior y nuevo

## Definición de Terminado
- Upsert funcional con auditoría de sobreescritura
- Balance global usa saldos más recientes
