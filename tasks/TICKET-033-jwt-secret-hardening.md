# TICKET-033: Hardening JWT_SECRET + credenciales bootstrap

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Blocker (seguridad crítica)  
> **Tipo**: Security

---

## Problema

1. **JWT_SECRET fallback a 'golden-city-dev-secret'** ([backend/services/auth.service.js:14](../backend/services/auth.service.js#L14))
   - Si `process.env.JWT_SECRET` no está definida, cae a string público `'golden-city-dev-secret'`
   - En un deploy accidental sin env, todos los JWTs son falsificables

2. **Credenciales por defecto `admin/admin123`, `agent/agent123`** en `.env.example` e iguales al bootstrap
   - Si el deploy usa defaults, entrada trivial
   - `AUTH_BOOTSTRAP_ADMIN_PASSWORD=admin123` está hardcoded como fallback ([auth.service.js:39](../backend/services/auth.service.js#L39))

---

## Solución

### Backend
1. **auth.service.js::getJwtSecret()** (línea 13-15):
   - Cambiar fallback: en `NODE_ENV=production`, lanzar error si `JWT_SECRET` no existe
   - En dev, permitir fallback pero loguear warning

   ```
   function getJwtSecret() {
     const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
     if (!secret) {
       if (process.env.NODE_ENV === 'production') {
         throw new Error('FATAL: JWT_SECRET no configurada en producción');
       }
       console.warn('[Auth] JWT_SECRET no definida; usando dev-secret (INSEGURO)');
       return 'golden-city-dev-secret'; // dev only
     }
     return secret;
   }
   ```

2. **auth.service.js::buildBootstrapUsers()** (línea 30-60):
   - Cambiar fallbacks de passwords: en `NODE_ENV=production`, lanzar error si faltan envs
   - En dev, permitir defaults pero loguear warning
   
   ```
   function buildBootstrapUsers() {
     // ...
     const adminPwd = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
     if (!adminPwd && process.env.NODE_ENV === 'production') {
       throw new Error('FATAL: AUTH_BOOTSTRAP_ADMIN_PASSWORD no definida en producción');
     }
     const defaults = [
       {
         id: 'AUTH-ADMIN',
         username: process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME || 'admin',
         password: adminPwd || 'admin123', // dev fallback
         role: 'admin',
         nombre: process.env.AUTH_BOOTSTRAP_ADMIN_NAME || 'Administrador',
       },
       // igual para agent...
     ];
     // ...
   }
   ```

3. **index.js** (startup):
   - Ya llama `authService.ensureAuthSheetSeed()` (línea 36)
   - Esto trigger la validación de secrets al arrancar

### .env.example
- Cambiar valores por placeholders sin valores por defecto:
  ```
  JWT_SECRET=PUT_A_LONG_RANDOM_STRING_HERE
  AUTH_BOOTSTRAP_ADMIN_PASSWORD=CHANGE_ME_IN_PRODUCTION
  AUTH_BOOTSTRAP_AGENT_PASSWORD=CHANGE_ME_IN_PRODUCTION
  ```

---

## Archivos

- `backend/services/auth.service.js` — funciones getJwtSecret(), buildBootstrapUsers()
- `.env.example` — valores de bootstrap
- `backend/index.js` — startup es donde se valida (sin cambios, lógica en auth.service)

---

## Criterios de Aceptación

- [ ] En `NODE_ENV=production`, falta JWT_SECRET → error al arrancar
- [ ] En `NODE_ENV=production`, falta AUTH_BOOTSTRAP_ADMIN_PASSWORD → error al arrancar
- [ ] En `NODE_ENV=development`, faltan secrets → warning en logs (pero arranca)
- [ ] `.env.example` no tiene valores por defecto inseguros
- [ ] En dev con `.env` correcto, arranca sin warnings
- [ ] Despliegue olvidó JWT_SECRET → falla inmediatamente (no silenciosamente con secret débil)

---

## Definición de Terminado

No es posible deployar accidentalmente sin credenciales fuertes.
