# TICKET-022: Error handling robusto en backend

> **Estado**: ✅ COMPLETADO
> **Sprint**: 3 — Hardening
> **Esfuerzo**: ~3h  
> **Prioridad**: P1

---

## Objetivo
Mejorar el manejo de errores en toda la cadena backend: errores de Sheets API, errores de red, rate limiting, validación de datos inconsistentes.

## Acciones
1. Crear un error handler centralizado con clases de error custom
2. Agregar try/catch en el repository para errores de Google Sheets API
3. Agregar retry lógico con backoff exponencial para rate limits (429)
4. Manejar errores de conexión (ECONNRESET, timeout) con mensajes claros
5. Devolver códigos HTTP apropiados (400, 401, 403, 404, 429, 500)
6. Logging estructurado con timestamp y contexto

## Archivos probables
- `backend/middleware/errorHandler.js` — (NEW) error handler global mejorado
- `backend/repositories/sheetsRepository.js` — retry logic
- `backend/services/*.service.js` — error propagation
- `backend/index.js` — integrar error handler

## Dependencias
- TICKET-021 (identificar errores reales en integración)

## Criterios de Aceptación
- [x] Si falla la API de Sheets (429/500/502), el backend reintenta hasta 3 veces
- [x] El frontend tiene un timeout para no quedarse en "Cargando..." infinitamente si el backend muere
- [x] Mensajes de error amigables ("No pudimos procesar el pedido por un error de conexión, intenta otra vez")
- [x] No hay crashes (500s crudos propagados al cliente sin parseo)

## Definición de Terminado
- Capa global de error handling implementada (AppError)
- Frontend maneja estados de error con banners
- Auditoría registrada en caso de fallos críticos

---

## Validación Ejecutada

- Jerarquía de errores implementada en `backend/utils/appError.js` (AppError, BadRequestError, UnauthorizedError, etc.)
- Handler global en `backend/middleware/errorHandler.js`
- Retry policy con backoff exponencial implementado en `backend/repositories/sheetsRepository.js`
- Resiliencia frontend implementada en `frontend/src/lib/api.ts` (timeout y retries de red) problemas sin acceso al código
