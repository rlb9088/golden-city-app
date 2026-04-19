# TICKET-046: Integración de Refresh Tokens en el Frontend

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 8 - Deuda técnica post Sprint-6
> **Esfuerzo**: ~2h
> **Prioridad**: P2 — Sin esta integración, TICKET-039 (refresh tokens backend) no aporta valor real

---

## Problema

El backend de refresh tokens fue implementado en TICKET-039 (`POST /api/auth/refresh`, access token de 15 min, refresh token de 7 días). Sin embargo, el frontend **no usa el refresh token**: cuando el access token expira (a los 15 min), el usuario recibe un error 401 y debe volver a hacer login manualmente.

El flujo silencioso de renovación (301 → refresh → reintentar) no está implementado en el cliente.

---

## Causa Raíz

- `frontend/src/lib/api.ts` — el cliente HTTP no intercepta respuestas 401 para intentar un refresh automático.
- `frontend/src/lib/auth-context.tsx` — solo persiste `accessToken` en localStorage; no almacena ni gestiona `refreshToken`.
- El endpoint `POST /api/auth/login` ya retorna `{ accessToken, refreshToken }` (backend TICKET-039), pero el frontend descarta el `refreshToken`.

---

## Solución

### Flujo objetivo

```
request → 401 → POST /auth/refresh (con refreshToken)
  ├─ éxito → guardar nuevo accessToken → reintentar request original
  └─ fallo (refresh expirado/inválido) → logout automático + redirect /login
```

### Frontend

#### `frontend/src/lib/auth-context.tsx`

1. En `login()`: extraer y guardar `refreshToken` de la respuesta en `localStorage` (clave `gc_refresh_token` o similar).
2. En `logout()`: limpiar también `refreshToken` de localStorage.
3. Exponer `refreshToken` y una función `refreshSession()` en el contexto si se necesita fuera de `api.ts`.

#### `frontend/src/lib/api.ts`

1. En la función `performRequest()` (o en el wrapper `request()`):
   - Si la respuesta es **401** y hay un `refreshToken` en localStorage:
     - Llamar `POST /api/auth/refresh` con `{ refreshToken }`.
     - Si la respuesta es exitosa: actualizar `accessToken` en localStorage + actualizar headers → **reintentar el request original una vez**.
     - Si la respuesta es 401/403 (refresh inválido o expirado): llamar `logout()` del contexto (o limpiar localStorage + redirigir a `/login`).
   - Si la respuesta es **401** y no hay `refreshToken`: llamar `logout()` directamente.
2. Evitar loops infinitos: marcar el request de refresh con un flag para no reintentar un 401 en el propio refresh.

### Consideraciones de seguridad

- `refreshToken` en `localStorage` es la solución actual (ya documentado como tradeoff en TICKET-039). La alternativa (HttpOnly cookie) se considera post-MVP.
- El refresh token no debe enviarse en ningún request que no sea `POST /api/auth/refresh`.

---

## Archivos

- `frontend/src/lib/auth-context.tsx` — persistir y limpiar `refreshToken`; función `refreshSession`
- `frontend/src/lib/api.ts` — interceptar 401, llamar refresh, reintentar request

## Dependencias

- Requiere que TICKET-039 esté implementado en backend (ya lo está).
- No bloquea ni es bloqueado por otros tickets abiertos.

## Criterios de Aceptación

- [ ] Tras login, `refreshToken` se guarda en localStorage.
- [ ] Tras logout, `refreshToken` se elimina de localStorage.
- [ ] Si un request falla con 401 y hay refreshToken válido: se renueva automáticamente sin que el usuario lo note.
- [ ] Si el refreshToken está expirado o es inválido: el usuario es redirigido a `/login`.
- [ ] No hay loops infinitos de refresh (flag de protección implementado).
- [ ] El refreshToken no aparece en headers de requests normales.
- [ ] Test manual: sesión activa 20+ minutos sin relogin forzado.

## Definición de Terminado

- La sesión del usuario dura hasta 7 días sin necesidad de hacer login nuevamente, mientras use la app regularmente.
- El logout limpia todas las credenciales.
- Sin regresiones en el flujo de autenticación.
