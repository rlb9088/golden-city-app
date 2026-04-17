# TICKET-002: Backend — Capa de persistencia (sheetsRepository)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 0 — Setup  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Blocker

---

## Objetivo
Implementar el repository genérico que abstrae la persistencia en Google Sheets con fallback in-memory para desarrollo.

## Archivos
- `backend/config/sheetsClient.js` — Singleton de conexión a Google Sheets API
- `backend/repositories/sheetsRepository.js` — getAll, append, update, findByColumn

## Dependencias
- TICKET-001

## Criterios de Aceptación
- [x] `getAll(sheetName)` retorna array de objetos con headers como keys
- [x] `append(sheetName, data, headers)` agrega una fila
- [x] `update(sheetName, rowIndex, data, headers)` actualiza una fila
- [x] `findByColumn(sheetName, column, value)` filtra filas
- [x] Funciona en modo in-memory cuando no hay credenciales
- [x] Funciona en modo Sheets cuando hay GOOGLE_APPLICATION_CREDENTIALS

## Definición de Terminado
- Backend arranca sin errores en ambos modos
- Logs claros indican modo activo (Sheets vs in-memory)
