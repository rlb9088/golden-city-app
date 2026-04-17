# TICKET-034: Rate-limit en login + Helmet para headers de seguridad

> **Estado**: 🔴 PENDIENTE  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Blocker (seguridad crítica)  
> **Tipo**: Security

---

## Problema

1. **Sin rate-limit en POST /api/auth/login**
   - Vulnerable a brute-force: un atacante puede probar millones de contraseñas sin restricción
   - Google Sheets tiene rate limits; requests fallidos cuestan límite API

2. **Sin Helmet**
   - Faltan headers de seguridad HTTP estándar:
     - `Content-Security-Policy` — previene XSS
     - `X-Frame-Options` — previene clickjacking
     - `X-Content-Type-Options` — previene MIME sniffing
     - `Strict-Transport-Security` — fuerza HTTPS

---

## Solución

### Backend

1. **package.json**: agregar dependencias
   ```json
   {
     "dependencies": {
       "helmet": "^7.1.0",
       "express-rate-limit": "^7.1.5"
     }
   }
   ```

2. **backend/index.js** (middleware global, antes de routes):
   ```javascript
   const helmet = require('helmet');
   const rateLimit = require('express-rate-limit');
   
   // Seguridad HTTP headers
   app.use(helmet());
   
   // Rate-limit global moderado (10 req/min por IP)
   const globalLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minuto
     max: 10,
     message: 'Too many requests from this IP, please try again later.',
   });
   app.use(globalLimiter);
   
   // Rate-limit específico en login (5 intentos / 15 min por IP)
   const loginLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutos
     max: 5,
     skipSuccessfulRequests: true, // reset counter en login exitoso
     message: 'Too many login attempts, please try again later.',
   });
   
   app.use('/api/auth/login', loginLimiter);
   ```

3. **.env.example**: agregar config opcional
   ```
   # Rate limiting
   RATE_LIMIT_GLOBAL=10/min
   RATE_LIMIT_LOGIN=5/15min
   ```

### Frontend
- Sin cambios necesarios
- Ya maneja 429 (Too Many Requests) como error de red

---

## Archivos

- `backend/package.json` — agregar helmet + express-rate-limit
- `backend/index.js` — aplicar middleware global + login limiter
- `.env.example` — documentar opcionales

---

## Criterios de Aceptación

- [ ] npm install descarga helmet + express-rate-limit
- [ ] POST /api/auth/login acepta máx 5 intentos fallidos por IP en 15 min
- [ ] 6to intento retorna 429 Too Many Requests
- [ ] Login exitoso reseta el contador (skipSuccessfulRequests)
- [ ] Headers de helmet presentes: CSP, X-Frame-Options, etc. (curl -i)
- [ ] Global rate-limit permite operación normal (~10 req/min)
- [ ] Otros endpoints no están limitados por el global limiter (o límite es razonable)

---

## Definición de Terminado

Seguridad HTTP estándar presente; brute-force significativamente más caro.
