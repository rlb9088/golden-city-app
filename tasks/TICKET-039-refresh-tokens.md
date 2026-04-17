# TICKET-039: Refresh tokens para sesiones de larga duración

> **Estado**: 🔴 PENDIENTE  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~3h  
> **Prioridad**: P3 — Low (post-lanzamiento, UX)  
> **Tipo**: Feature / Security

---

## Problema

Actualmente, JWT expira en 24h:
- Usuario logueado durante una operación larga → token expira → error 401
- Sin forma de renovar sesión automáticamente
- UX: necesita volver a loguear cada 24h (o menos)

Para oficinas que usan el sistema todo el día, es molesto.

---

## Solución

### Backend

1. **Crear tabla `config_auth_sessions` en Sheets** (opcional, para auditoria):
   - id, user_id, refresh_token_hash, issued_at, expires_at
   - Permite revocar sesiones remotamente

2. **Modificar JWT signing** ([backend/services/auth.service.js](../backend/services/auth.service.js)):
   ```javascript
   function signSessionWithRefresh(user) {
     const accessToken = jwt.sign(buildSession(user), getJwtSecret(), {
       expiresIn: '15m', // access token corto
     });
     
     const refreshToken = jwt.sign(
       { userId: user.id, type: 'refresh' },
       getJwtSecret() + '_refresh', // secret diferente
       { expiresIn: '7d' }, // refresh token largo
     );
     
     return {
       accessToken,
       refreshToken,
       user: buildSession(user),
       expiresIn: '15m',
     };
   }
   ```

3. **POST /api/auth/refresh** (nuevo endpoint):
   ```javascript
   async function refresh(req, res, next) {
     try {
       const { refreshToken } = req.body;
       const payload = jwt.verify(refreshToken, getJwtSecret() + '_refresh');
       
       const user = await getAuthUserById(payload.userId);
       if (!user) throw new UnauthorizedError('Usuario no encontrado');
       
       const { accessToken, refreshToken: newRefreshToken } = signSessionWithRefresh(user);
       res.json({ status: 'success', data: { accessToken, refreshToken: newRefreshToken } });
     } catch (error) {
       next(new UnauthorizedError('Refresh token inválido', { details: error.message }));
     }
   }
   ```

4. **routes/auth.routes.js**:
   ```javascript
   router.post('/refresh', controller.refresh);
   ```

### Frontend

1. **Cambiar JWT almacenado** ([frontend/src/lib/auth-context.tsx](../frontend/src/lib/auth-context.tsx)):
   ```typescript
   interface AuthSession {
     accessToken: string;
     refreshToken: string;
     expiresIn: string;
     user: { userId: string; role: string; ... };
   }

   function persistSession(session: AuthSession) {
     localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
   }
   ```

2. **API wrapper auto-refresh** ([frontend/src/lib/api.ts](../frontend/src/lib/api.ts)):
   ```typescript
   async function request(url: string, options: RequestInit = {}) {
     let token = getStoredToken();
     
     const response = await performRequest(url, {
       ...options,
       headers: {
         ...options.headers,
         Authorization: `Bearer ${token}`,
       },
     });
     
     // Si 401 por token expirado, intentar refresh
     if (response.status === 401) {
       const { refreshToken } = getStoredSession();
       const refreshResp = await fetch(`${API_BASE}/auth/refresh`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ refreshToken }),
       });
       
       if (refreshResp.ok) {
         const { data: newSession } = await refreshResp.json();
         persistSession(newSession);
         // Reintentar request original
         return performRequest(url, {
           ...options,
           headers: {
             ...options.headers,
             Authorization: `Bearer ${newSession.accessToken}`,
           },
         });
       } else {
         // Refresh falló, redirigir a login
         logout();
       }
     }
     
     return response;
   }
   ```

3. **Refrescar proactivamente antes de expirar**:
   ```typescript
   useEffect(() => {
     const session = getStoredSession();
     if (!session) return;
     
     // Si access token expira en < 2 min, refresh
     const decoded = jwtDecode(session.accessToken);
     const msUntilExpiry = decoded.exp * 1000 - Date.now();
     
     if (msUntilExpiry < 2 * 60 * 1000) {
       refreshSession();
     }
     
     // Check cada minuto
     const interval = setInterval(() => {
       // ... mismo check
     }, 60000);
     
     return () => clearInterval(interval);
   }, []);
   ```

### .env.example

```
# JWT
JWT_SECRET=your-long-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## Archivo de referencia

- `backend/services/auth.service.js` — nuevas funciones signSessionWithRefresh, refresh
- `backend/routes/auth.routes.js` — POST /refresh
- `frontend/src/lib/auth-context.tsx` — persistir refreshToken, logout lo borra
- `frontend/src/lib/api.ts` — intercept 401, refresh automático
- `.env.example` — documentar nuevas envs

---

## Criterios de Aceptación

- [ ] POST /api/auth/login retorna accessToken + refreshToken
- [ ] accessToken expira en 15 min
- [ ] refreshToken expira en 7 días
- [ ] POST /api/auth/refresh con refreshToken válido retorna nuevo accessToken
- [ ] Refresh token inválido → 401
- [ ] Frontend detecta 401, intenta refresh automático
- [ ] Si refresh falla, redirige a login
- [ ] Usuario puede estar logueado varios días sin reloguearse (si refresca constantemente)
- [ ] Logout elimina refreshToken (imposible refrescar después)

---

## Definición de Terminado

Usuarios no ven interrupciones por expiración de token en sesiones normales de < 7 días.

---

## Notas

- Refresh token debe guardarse **en HttpOnly cookie** para máxima seguridad (XSS no puede robarlo)
- Actualmente localStorage, menos seguro pero más fácil en SPA
- Post-MVP: migrar a HttpOnly cookies si es prioritario
