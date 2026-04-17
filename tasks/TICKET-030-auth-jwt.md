# TICKET-030: Autenticación real (login con JWT)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 5 — Seguridad  
> **Esfuerzo**: ~4h  
> **Prioridad**: P1 (blocker para producción en internet)  
> **Completado en**: 2026-04-16

---

## Objetivo
Reemplazar el placeholder de auth por headers con un sistema de login real basado en JWT.

## Acciones
### Backend
1. Crear tabla `config_auth_users` con: id, username, password_hash, role, nombre
2. POST `/api/auth/login` — valida credenciales, retorna JWT
3. Middleware `verifyToken` reemplaza `extractAuth`
4. JWT incluye: userId, role, username
5. Expiración de token configurable (ej: 24h)
6. Hash de passwords con bcrypt

### Frontend
1. Página `/login` — formulario de usuario y contraseña
2. Guardar token JWT en localStorage
3. Enviar token en header `Authorization: Bearer <token>`
4. Redirigir a /login si token expirado o inválido
5. Eliminar selector de rol del sidebar
6. Mostrar solo nombre y rol del usuario logueado

## Archivos probables
- `backend/middleware/auth.middleware.js` — reescribir completamente
- `backend/routes/auth.routes.js` — (NEW)
- `backend/services/auth.service.js` — (NEW)
- `frontend/src/app/login/page.tsx` — (NEW)
- `frontend/src/lib/auth-context.tsx` — adaptar a JWT
- `frontend/src/lib/api.ts` — enviar Bearer token
- `frontend/src/components/Sidebar.tsx` — eliminar selector de rol

## Dependencias nuevas
- `bcrypt` (backend)
- `jsonwebtoken` (backend)

## Dependencias de tickets
- Ninguna (puede hacerse independientemente)

## Criterios de Aceptación
- [ ] Login con username/password funciona
- [ ] JWT se genera y valida correctamente
- [ ] Endpoints protegidos rechazan requests sin token válido
- [ ] Token expira después del tiempo configurado
- [ ] Frontend redirige a login cuando no hay sesión
- [ ] Selector de rol eliminado del sidebar

## Definición de Terminado
- El sistema es apto para exposición a internet (con HTTPS)
- No se puede acceder a funciones admin sin credenciales correctas
