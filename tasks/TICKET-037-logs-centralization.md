# TICKET-037: Logs centralizados y persistidos

> **Estado**: 🔴 PENDIENTE  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~2h  
> **Prioridad**: P2 — Medium (ops/observabilidad)  
> **Tipo**: DevOps / Observability

---

## Problema

Actualmente todos los logs van a `console` (stdout/stderr):
- Sin agregación central
- Logs se pierden cuando el contenedor reinicia
- Imposible investigar histórico de errores
- Difícil monitorear production issues en tiempo real

El proyecto ya tiene JSON estructurado en `middleware/errorHandler.js`, pero no está siendo capturado centralmente.

---

## Solución

### Opción A: Google Cloud Logging (si usa GCP)

**Implementación mínima**:

1. **backend/index.js**:
   ```javascript
   let logger;
   if (process.env.NODE_ENV === 'production' && process.env.GOOGLE_PROJECT_ID) {
     const { Logging } = require('@google-cloud/logging');
     logger = new Logging().log('golden-city-backend');
   }

   // En lugar de console.log(), usar logger.write()
   app.listen(port, () => {
     const msg = `🏛️  Golden City Backend running on port ${port}`;
     if (logger) {
       logger.write(logger.entry({ severity: 'INFO', message: msg }));
     } else {
       console.log(msg);
     }
   });
   ```

2. **package.json**:
   ```json
   {
     "dependencies": {
       "@google-cloud/logging": "^11.0.0"
     }
   }
   ```

3. **.env.example**:
   ```
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_LOG_NAME=golden-city-backend
   ```

### Opción B: Consolidado en archivo local + exportación

**Más simple, sin dependencias de cloud**:

1. Crear `backend/lib/logger.js`:
   ```javascript
   const fs = require('fs');
   const path = require('path');

   const LOG_DIR = path.join(__dirname, '..', 'logs');
   const LOG_FILE = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

   if (!fs.existsSync(LOG_DIR)) {
     fs.mkdirSync(LOG_DIR, { recursive: true });
   }

   function writeLog(level, message, meta = {}) {
     const timestamp = new Date().toISOString();
     const entry = JSON.stringify({ timestamp, level, message, ...meta });
     
     // Console (siempre)
     console.log(entry);
     
     // Archivo (si NODE_ENV=production)
     if (process.env.NODE_ENV === 'production') {
       fs.appendFileSync(LOG_FILE, entry + '\n');
     }
   }

   module.exports = {
     info: (msg, meta) => writeLog('INFO', msg, meta),
     warn: (msg, meta) => writeLog('WARN', msg, meta),
     error: (msg, meta) => writeLog('ERROR', msg, meta),
   };
   ```

2. **middleware/errorHandler.js** — ya usa JSON.stringify, basta redirigir:
   ```javascript
   const logger = require('../lib/logger');

   function errorHandler(err, req, res, next) {
     // logging ya está, ahora usa logger.error()
     logger.error('Request error', {
       statusCode: err.statusCode,
       message: err.message,
       path: req.originalUrl,
     });
     // ... rest del handler
   }
   ```

3. **.gitignore**:
   ```
   backend/logs/
   backend/logs/*.log
   ```

4. **docker-compose.yml** — mountar logs:
   ```yaml
   volumes:
     - ./backend/logs:/app/backend/logs
   ```

### Opción C: Datadog (tercero, costo)

Para equipos con presupuesto:
```javascript
const StatsD = require('node-dogstatsd').StatsD;
const dogstatsd = new StatsD();

// En handlers
dogstatsd.increment('auth.login.attempt');
dogstatsd.timing('pagos.list.duration', duration_ms);
```

---

## Recomendación para MVP

**Usar Opción B** (logs en archivo local):
- Sin dependencias externas
- Funciona offline
- Simple de implementar
- Logs persistidos en prodcción (si usa Docker con volumes)
- Cuando cresca, migrar a Datadog/GCP (sin cambios de código si abstraen bien)

---

## Archivos

- `backend/lib/logger.js` (nuevo)
- `backend/middleware/errorHandler.js` — usar logger.error()
- `backend/routes/*.js` — usar logger.info() en eventos importantes
- `.gitignore` — agregar `backend/logs/`
- `docker-compose.yml` — agregar volumen si existe
- `docs/DEPLOY.md` — mencionar que logs van a `backend/logs/`

---

## Criterios de Aceptación

- [ ] `npm install` (Opción A/B/C según elección)
- [ ] Error en backend escribe en logs (archivo o cloud)
- [ ] Logs incluyen timestamp, level, message, metadata
- [ ] En dev, logs siguen visibles en console
- [ ] En prod, logs se persisten sin depender de stdout (importante para Cloud Run/Render)
- [ ] Logs no contienen credenciales (JWT_SECRET, passwords, etc.)
- [ ] Formato JSON estructurado (parseable por herramientas)

---

## Definición de Terminado

Issues en production pueden investigarse post-mortem consultando logs históricos.
