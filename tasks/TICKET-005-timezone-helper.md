# TICKET-005: Backend — Timezone helper (America/Lima)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 0 — Setup  
> **Esfuerzo**: ~30min  
> **Prioridad**: P1

---

## Objetivo
Centralizar las operaciones de fecha/hora en timezone Lima (UTC-5).

## Archivos
- `backend/config/timezone.js` — nowLima(), todayLima(), getTimezone()

## Dependencias
- Ninguna

## Criterios de Aceptación
- [x] `nowLima()` retorna ISO string en hora de Lima
- [x] `todayLima()` retorna YYYY-MM-DD en Lima
- [x] `getTimezone()` retorna 'America/Lima'

## Definición de Terminado
- Todos los servicios usan timezone.js para timestamps
