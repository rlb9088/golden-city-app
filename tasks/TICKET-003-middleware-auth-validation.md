# TICKET-003: Backend — Middleware de auth y validación

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 0 — Setup  
> **Esfuerzo**: ~1h  
> **Prioridad**: P0 — Blocker

---

## Objetivo
Implementar los middlewares base: autenticación por headers y validación con Zod.

## Archivos
- `backend/middleware/auth.middleware.js` — extractAuth, requireAuth, requireAdmin
- `backend/middleware/validate.middleware.js` — Wrapper genérico de Zod

## Dependencias
- TICKET-001

## Criterios de Aceptación
- [x] `extractAuth` inyecta `req.auth` con role y user desde headers
- [x] `requireAuth` rechaza con 401 si user es unknown
- [x] `requireAdmin` rechaza con 403 si role no es admin
- [x] `validate(schema)` valida req.body y retorna errores formateados
- [x] Errores incluyen campo y mensaje específico

## Definición de Terminado
- Middlewares se aplican correctamente en las rutas
- Respuestas de error son claras y consistentes
