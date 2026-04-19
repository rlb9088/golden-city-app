# TICKET-056 — Despliegue a producción: Vercel (frontend) + Railway (backend)

> **Estado**: 🔴 PENDIENTE  
> **Sprint**: 11 — Pre-producción  
> **Prioridad**: P0  
> **Esfuerzo estimado**: ~3h  
> **Dependencias**: TICKET-055 completado (migraciones ejecutadas)

---

## Contexto

El sistema está listo para producción a nivel de código. Este ticket cubre la configuración del entorno de producción y el despliegue en la arquitectura elegida:

- **Frontend**: Vercel (host nativo de Next.js, preview URLs por branch, zero-config)
- **Backend**: Railway (Node.js always-on, integración GitHub, fácil gestión de secrets)

El Dockerfile existente se mantiene como alternativa para desarrollo local o deploy en VPS/Render/Cloud Run.

### Punto crítico de `next.config.ts`

El rewrite `/api/*` → `BACKEND_INTERNAL_URL` se evalúa en **build time** en Vercel. La variable debe estar configurada en Vercel **antes** del primer build.

---

## Parte 1 — Backend en Railway

### 1.1 Crear el proyecto Railway

1. Ir a [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Seleccionar el repositorio APPGOLDEN.
3. Configurar **Root Directory** = `backend/`.
4. Railway detecta Node.js automáticamente y ejecuta `npm start` → `node index.js`.

### 1.2 Variables de entorno en Railway

Ir a Variables del proyecto y configurar:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=<mínimo 32 chars>
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

AUTH_BOOTSTRAP_ADMIN_PASSWORD=<contraseña admin de producción>
AUTH_BOOTSTRAP_AGENT_PASSWORD=<contraseña agente de producción>

GOOGLE_SHEET_ID=<id del spreadsheet de producción>
GOOGLE_CREDENTIALS_BASE64=<service account JSON en base64>
# Generar con: base64 -w0 backend/keys/google-vision.json

CORS_ORIGIN=https://<dominio-vercel>.vercel.app
# (actualizar después del paso 2.3)

R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret key>
R2_BUCKET=<nombre del bucket>
R2_PUBLIC_URL=https://<r2-public-domain>

RATE_LIMIT_GLOBAL=600/min
RATE_LIMIT_LOGIN=5/15min
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 1.3 Manejo de credenciales Google (GOOGLE_CREDENTIALS_BASE64)

Agregar al inicio de `backend/index.js` (antes de cualquier import que use las credenciales):

```js
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  const fs = require('fs');
  fs.writeFileSync('/tmp/google-creds.json',
    Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64'));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/google-creds.json';
}
```

> Alternativa Railway Pro: usar un volume montado en `/app/backend/keys/` y setear `GOOGLE_APPLICATION_CREDENTIALS` con esa ruta.

### 1.4 Verificar backend

- `GET https://<railway-url>/api/health` → `{"status":"ok"}`
- `POST https://<railway-url>/api/auth/login` con credenciales admin → JWT
- Anotar la URL pública de Railway (ej: `https://appgolden-backend.up.railway.app`)

---

## Parte 2 — Frontend en Vercel

### 2.1 Importar proyecto en Vercel

1. Ir a [vercel.com](https://vercel.com) → Add New Project → Import from GitHub.
2. Seleccionar el repositorio APPGOLDEN.
3. Configurar **Root Directory** = `frontend/`.
4. Vercel detecta Next.js automáticamente.

### 2.2 Variables de entorno en Vercel

En Settings → Environment Variables, configurar para **Production** (y opcionalmente Preview):

```
BACKEND_INTERNAL_URL=https://<railway-url>
```

> No setear `NEXT_PUBLIC_API_URL` a menos que se quiera que el navegador llame al backend directamente (sin el proxy de Next.js).

### 2.3 Deploy y actualizar CORS

1. Hacer Deploy. Anotar la URL de Vercel (ej: `https://appgolden.vercel.app`).
2. Volver a Railway → actualizar `CORS_ORIGIN=https://appgolden.vercel.app` → Railway hace redeploy automático.

---

## Parte 3 — R2 CORS Policy

Si el frontend muestra imágenes de comprobante directamente desde la URL de R2, configurar en Cloudflare Dashboard (R2 → Bucket → Settings → CORS):

```json
[{
  "AllowedOrigins": ["https://<dominio>.vercel.app"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```

---

## Parte 4 — CI/CD automático

- **Railway**: en el proyecto → Settings → GitHub Integration → activar auto-deploy en branch `main`. Deploys solo ocurren si el workflow de CI pasa.
- **Vercel**: activar integración GitHub en el proyecto Vercel. Auto-deploy en `main` + preview URLs por cada PR/branch.

Con esto, cada push a `main` que pase CI (tests + lint + build) despliega automáticamente backend en Railway y frontend en Vercel.

---

## Parte 5 — Smoke test post-deploy

Ejecutar el checklist completo contra las URLs de producción:

- [ ] `GET /api/health` → 200
- [ ] Login con credenciales admin → access + refresh tokens
- [ ] Login con credenciales agente → access + refresh tokens
- [ ] Credenciales inválidas → 401
- [ ] `GET /api/config` sin auth → 200 con datos de config
- [ ] `GET /api/pagos` con JWT → datos paginados
- [ ] `POST /api/pagos` con JWT válido → registro visible en Google Sheets
- [ ] Upload de comprobante en el pago anterior → objeto creado en R2 bucket
- [ ] `GET /api/balance` → valores numéricos correctos
- [ ] `GET /api/audit` (JWT admin) → eventos incluyendo los de migración (TICKET-055)
- [ ] Frontend: página de login carga sin errores en consola del navegador
- [ ] Frontend: autenticación exitosa redirige a `/balance`
- [ ] Frontend: banner de estado del backend en verde (health poll exitoso)
- [ ] Frontend: menú lateral muestra opciones correctas según rol
- [ ] Rate limiting: 6 intentos de login rápidos → 429 en el 6to intento

---

## Criterios de aceptación

- [ ] Backend accesible en URL pública de Railway con health check verde
- [ ] Frontend accesible en URL de Vercel y funcional end-to-end
- [ ] Login funciona con credenciales migradas (TICKET-055)
- [ ] Un pago de prueba es visible en Google Sheets
- [ ] Un comprobante de prueba es visible en R2
- [ ] CI/CD automático activado en ambas plataformas
- [ ] Smoke test completo pasado sin errores críticos

---

## Notas

- Si se usa un dominio personalizado (no `.vercel.app`), actualizar también `CORS_ORIGIN` en Railway y la CORS policy de R2.
- El Dockerfile existente no se modifica; sigue siendo válido para desarrollo local y como alternativa de deploy en VPS/Render/Cloud Run.
- En caso de rollback: Railway permite revertir a cualquier deploy anterior desde el dashboard.
