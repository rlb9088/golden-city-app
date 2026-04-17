# TICKET-035: Deploy prep — Dockerfile, .gitignore, secret management

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~4h  
> **Prioridad**: P1 — High (necesario para cualquier deploy)  
> **Tipo**: DevOps / Infrastructure

---

## Problema

1. **Sin Dockerfile** — no se puede deployar a cloud sin containerizar
2. **Sin .gitignore robusto** — riesgo de subir `.env`, `keys/`, `node_modules`
3. **Sin secret management** — credenciales viven en `.env` local
4. **CORS_ORIGIN hardcoded a localhost** — falla en producción
5. **Sin startup scripts** — desconocimiento de cómo arrancar en la plataforma

---

## Solución

### 1. Dockerfile

Crear `Dockerfile` en la raíz:

```dockerfile
# Stage 1: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend .
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine
WORKDIR /app

# Backend runtime
COPY --from=backend-build /app/backend ./backend
RUN mkdir -p backend/keys

# Frontend built app
COPY --from=frontend-build /app/frontend/.next ./frontend/.next
COPY --from=frontend-build /app/frontend/public ./frontend/public
COPY frontend/next.config.ts frontend/package.json ./frontend/

ENV NODE_ENV=production
EXPOSE 3001 3000

# Startup script
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
```

Crear `docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e

echo "🏛️  Golden City Backoffice — Production startup"

# Backend
cd /app/backend
echo "Starting backend on port 3001..."
node index.js &
BACKEND_PID=$!

# Frontend
cd /app/frontend
echo "Starting frontend on port 3000..."
npx next start &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID
```

### 2. .gitignore

Crear `.gitignore` en la raíz si no existe:

```
# Environment
.env
.env.local
.env.*.local
backend/.env
frontend/.env.local

# Dependencies
node_modules/
*/node_modules/

# Backend
backend/keys/
backend/*.json
backend/spa.traineddata

# Frontend build
frontend/.next
frontend/out

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Misc
dist/
build/
```

### 3. CORS_ORIGIN dinámico

Modificar `backend/index.js`:

```javascript
const cors = require('cors');

// Detectar origen desde env o usar localhost en dev
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

console.log(`CORS configured for: ${corsOrigin}`);
```

### 4. docker-compose.yml (opcional, para testing local)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      NODE_ENV: production
      GOOGLE_APPLICATION_CREDENTIALS: /app/backend/keys/google-vision.json
      GOOGLE_SHEET_ID: ${GOOGLE_SHEET_ID}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: http://localhost:3000
      AUTH_BOOTSTRAP_ADMIN_PASSWORD: ${AUTH_BOOTSTRAP_ADMIN_PASSWORD}
      AUTH_BOOTSTRAP_AGENT_PASSWORD: ${AUTH_BOOTSTRAP_AGENT_PASSWORD}
    volumes:
      - ./backend/keys:/app/backend/keys:ro
```

### 5. Deployment guides (docs/DEPLOY.md)

Crear guía para cada plataforma:

- **Vercel** (frontend only): Next.js nativo, variables env en dashboard
- **Render** (full stack): Dockerfile + env var en dashboard
- **Railway** (full stack): Dockerfile + railway.json
- **Cloud Run** (GCP): Dockerfile + gcloud deploy
- **Fly.io** (full stack): Dockerfile + fly.toml

Ejemplo para Render:

```markdown
## Deploying to Render

1. Push código a GitHub
2. Conectar repo en Render dashboard
3. Crear servicio Web desde Dockerfile
4. Configurar env vars:
   - GOOGLE_APPLICATION_CREDENTIALS
   - GOOGLE_SHEET_ID
   - JWT_SECRET (fuerte, 32+ chars)
   - CORS_ORIGIN (el dominio de Render)
   - NODE_ENV=production
   - AUTH_BOOTSTRAP_ADMIN_PASSWORD
   - AUTH_BOOTSTRAP_AGENT_PASSWORD
5. Subir archivo de Service Account JSON a Render (file service)
6. Deploy
```

### 6. Secret management (Google Secret Manager, opcional)

Si usa GCP:

```bash
# Guardar secreto
gcloud secrets create JWT_SECRET --data-file=-
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member=serviceAccount:PROJECT@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# En Cloud Run, env var referencia el secret
gcloud run deploy golden-city \
  --set-cloudsql-instances=... \
  --update-env-vars=JWT_SECRET=sm://JWT_SECRET
```

---

## Archivos

- `Dockerfile` (nuevo)
- `docker-entrypoint.sh` (nuevo)
- `.gitignore` (crear o actualizar)
- `docker-compose.yml` (opcional)
- `backend/index.js` — actualizar CORS
- `docs/DEPLOY.md` (nuevo)
- `.env.example` — documentar CORS_ORIGIN para prod

---

## Criterios de Aceptación

- [ ] `docker build -t golden-city .` compila sin errores
- [ ] `docker run --rm golden-city` arranca backend + frontend
- [ ] `.gitignore` incluye `.env`, `keys/`, `node_modules/`
- [ ] `git status` no muestra `.env` ni `keys/` (si fue commiteado antes, `git rm --cached`)
- [ ] CORS_ORIGIN se lee de env (default localhost en dev)
- [ ] docs/DEPLOY.md documenta al menos Render + Cloud Run
- [ ] Dockerfile no incluye credenciales (vía env/secrets)

---

## Definición de Terminado

Cualquier plataforma de hosting puede deployar sin modificar código.
