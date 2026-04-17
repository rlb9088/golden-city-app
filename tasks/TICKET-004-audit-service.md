# TICKET-004: Backend — Servicio de auditoría

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 0 — Setup  
> **Esfuerzo**: ~1h  
> **Prioridad**: P0 — Blocker

---

## Objetivo
Implementar el servicio de auditoría (audit trail) que registra toda mutación en el sistema.

## Archivos
- `backend/services/audit.service.js` — log(action, entity, user, changes)

## Dependencias
- TICKET-002 (sheetsRepository)

## Criterios de Aceptación
- [x] `audit.log()` registra un entry en la hoja `audit`
- [x] Cada entry tiene: id, action, entity, user, timestamp, changes (JSON)
- [x] Los IDs son únicos (formato AUD-timestamp-counter)
- [x] Es append-only (nunca modifica/borra)

## Definición de Terminado
- Todo servicio que muta datos puede llamar a `audit.log()`
- Los registros de auditoría se persisten correctamente
