# Deploy Guide

This repo now includes a Docker-based deploy prep flow and a local startup script.

## Included Files

- `Dockerfile`
- `docker-entrypoint.sh`
- root `.gitignore`
- root `.dockerignore`
- `docs/DEPLOY.md`

## Runtime Model

- Backend runs on port `3001`
- Frontend runs on port `3000`
- The frontend calls `/api/*` by default and Next.js rewrites that traffic to the backend inside the container
- `CORS_ORIGIN` still matters when the backend is reached directly from a browser or when you split services later

## Required Environment Variables

Backend:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_SHEET_ID`
- `JWT_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_AGENT_PASSWORD`
- `CORS_ORIGIN`
- `LOG_DIR` optional. Defaults to `backend/logs`

Frontend:

- `NEXT_PUBLIC_API_URL` only if you want the browser to call a public backend URL directly

## Local Docker

Build the image:

```bash
docker build -t golden-city .
```

Run it locally:

```bash
docker run --rm -p 3000:3000 -p 3001:3001 \
  -v $(pwd)/backend/logs:/app/backend/logs \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/backend/keys/google-vision.json \
  -e GOOGLE_SHEET_ID=your_sheet_id \
  -e JWT_SECRET=your_long_random_secret \
  -e AUTH_BOOTSTRAP_ADMIN_PASSWORD=your_admin_password \
  -e AUTH_BOOTSTRAP_AGENT_PASSWORD=your_agent_password \
  -e CORS_ORIGIN=http://localhost:3000 \
  -e LOG_DIR=/app/backend/logs \
  golden-city
```

Mount the service account JSON into `/app/backend/keys/google-vision.json` if you want real Sheets and OCR access.
In production, backend runtime logs are written as JSON lines into `backend/logs/app-YYYY-MM-DD.log` and also remain visible in stdout/stderr.

## Render

Use the Dockerfile-based service and set secrets in the Render dashboard.

Suggested settings:

1. Create a Web Service from the repository.
2. Use the Dockerfile build.
3. Set `NODE_ENV=production`.
4. Set the backend secrets and `CORS_ORIGIN`.
5. Provide the Google service account file as a mounted secret or file secret.
6. Leave `NEXT_PUBLIC_API_URL` empty unless you deliberately split frontend and backend into separate services.

## Cloud Run

Cloud Run exposes a single public port, so the built-in frontend proxy is the cleanest path.

Suggested settings:

1. Build and push the image to Artifact Registry.
2. Deploy the image to Cloud Run.
3. Expose port `3000` at the platform level.
4. Inject backend secrets with Secret Manager or mounted files.
5. Set `CORS_ORIGIN` to the public frontend origin if you ever call the backend directly from the browser.

If you later split frontend and backend into separate deployments, set `NEXT_PUBLIC_API_URL` to the public backend URL and keep `CORS_ORIGIN` aligned with the frontend origin.

## Vercel (frontend) + Railway (backend)

La opción recomendada para este proyecto. El frontend Next.js se despliega en Vercel de forma nativa; el backend Express en Railway como proceso Node.js siempre activo.

### Punto crítico de configuración

`next.config.ts` reescribe `/api/*` → `BACKEND_INTERNAL_URL`. Esta variable se evalúa en **build time** en Vercel, no en runtime. Debe configurarse como Environment Variable en Vercel **antes** de lanzar el primer build.

### Pre-requisito

**Ejecutar TICKET-055 antes de cualquier deploy**: los scripts de migración (`migrateAuthUsersToAgentes.js` y `migrateBancoId.js`) deben correr en modo `--dry-run` + `--commit` contra la hoja de producción antes de subir el backend.

### Paso 1 — Backend en Railway

1. Crear proyecto Railway desde GitHub. Root dir = `backend/`.
2. Configurar variables de entorno en Railway:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<mínimo 32 chars — generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   AUTH_BOOTSTRAP_ADMIN_PASSWORD=<contraseña admin>
   AUTH_BOOTSTRAP_AGENT_PASSWORD=<contraseña agente>
   GOOGLE_SHEET_ID=<id del spreadsheet de producción>
   CORS_ORIGIN=https://<tu-dominio>.vercel.app
   R2_ACCOUNT_ID=<cloudflare account id>
   R2_ACCESS_KEY_ID=<r2 key>
   R2_SECRET_ACCESS_KEY=<r2 secret>
   R2_BUCKET=<nombre del bucket>
   R2_PUBLIC_URL=https://<r2-public-domain>
   GOOGLE_CREDENTIALS_BASE64=<service account JSON codificado en base64>
   ```
3. Agregar al inicio de `backend/index.js` la decodificación de credenciales (antes de cualquier import que las use):
   ```js
   const { bootstrapEnvironment } = require('./config/bootstrapEnv');
   bootstrapEnvironment();
   ```
4. Verificar: `GET https://<railway-url>/api/health` → 200.
5. Anotar la URL pública de Railway.

### Paso 2 — Frontend en Vercel

1. Importar proyecto en Vercel. Root dir = `frontend/`.
2. Configurar variable de entorno en Vercel (para Production y Preview):
   ```
   BACKEND_INTERNAL_URL=https://<railway-url>
   ```
3. Deploy. Anotar la URL de Vercel.
4. Volver a Railway → actualizar `CORS_ORIGIN` con la URL real de Vercel → redeploy.

### Paso 3 — CORS del bucket R2

Configurar en Cloudflare Dashboard la CORS policy del bucket:
```json
[{
  "AllowedOrigins": ["https://<tu-dominio>.vercel.app"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```

### Paso 4 — CI/CD automático

- **Railway**: activar integración GitHub en el proyecto. Auto-deploy en push a `main` tras tests ✅.
- **Vercel**: activar integración GitHub. Auto-deploy en `main` + preview URLs por branch.

### Checklist de smoke test post-deploy

- [ ] `GET /api/health` → 200
- [ ] Login con credenciales admin → access + refresh tokens
- [ ] Login con credenciales agente → access + refresh tokens
- [ ] Credenciales inválidas → 401
- [ ] `GET /api/config` sin auth → 200
- [ ] `GET /api/pagos` con JWT → datos paginados
- [ ] `POST /api/pagos` con JWT → registro visible en Google Sheets
- [ ] Upload comprobante en un pago → objeto creado en R2
- [ ] `GET /api/balance` → valores numéricos
- [ ] `GET /api/audit` (JWT admin) → eventos de auditoría incluyendo los de migración (TICKET-055)
- [ ] Frontend: login sin errores en consola
- [ ] Frontend: banner de estado backend en verde
- [ ] Rate limiting: 6 intentos de login rápidos → 429 en el 6to

### Smoke test ejecutable desde el repo

Para automatizar las comprobaciones HTTP principales contra producción:

```bash
node scripts/smoke-production.mjs
```

Variables requeridas:

- `PRODUCTION_BACKEND_URL`
- `PRODUCTION_FRONTEND_URL`

Variables opcionales para validar login real:

- `PRODUCTION_ADMIN_USERNAME` (default `admin`)
- `PRODUCTION_ADMIN_PASSWORD`
- `PRODUCTION_AGENT_USERNAME`
- `PRODUCTION_AGENT_PASSWORD`

El script valida health, config pública, credenciales inválidas, login admin/agente si se proporcionan, endpoints protegidos (`/api/pagos`, `/api/balance`, `/api/audit`) y respuesta base del frontend. Las verificaciones que escriben datos o requieren navegador siguen siendo manuales.

---

## Secret Management

Do not bake secrets into the image.

Keep these values outside the repo and outside the container image:

- `JWT_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_AGENT_PASSWORD`
- `GOOGLE_APPLICATION_CREDENTIALS`

On GCP, use Secret Manager or a mounted secret file for the service account JSON.
