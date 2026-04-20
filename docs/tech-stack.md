# Tech Stack — Golden City Backoffice

> **Versión**: 1.1  
> **Última actualización**: 2026-04-19

---

## 1. Stack Principal

| Capa | Tecnología | Versión | Rol |
|------|-----------|---------|-----|
| **Frontend Framework** | Next.js | 16.2.2 | App Router, SSR/CSR, routing |
| **UI Library** | React | 19.2.4 | Componentes, estado, hooks |
| **Lenguaje Frontend** | TypeScript | ^5 | Tipado estático |
| **Estilos** | Vanilla CSS | - | Design system con custom properties |
| **Backend Framework** | Express.js | 5.2.1 | API REST, middleware chain |
| **Runtime** | Node.js | 18+ | Entorno de ejecución |
| **Lenguaje Backend** | JavaScript | ES2020+ (CommonJS) | Lógica de servidor |
| **Base de Datos** | Google Sheets | API v4 | Persistencia, CRUD |
| **Validación** | Zod | 4.3.6 | Schema validation en endpoints |

---

## 2. Servicios Externos

| Servicio | Uso | Requisitos | Costo |
|----------|-----|-----------|-------|
| **Google Sheets API v4** | Base de datos MVP | Service Account + Spreadsheet compartido | Gratis (cuota: 100 req/100s/user) |
| **Google Cloud Vision API** | OCR primario para comprobantes | Service Account con Vision API habilitada | $1.50/1000 imágenes (primeras 1000 gratis/mes) |
| **Google Drive API v3** | Lectura de metadata del spreadsheet | Incluido en scopes del Service Account | Gratis |
| **Cloudflare R2** | Almacenamiento de comprobantes | Bucket + credenciales S3-compatibles | Sin egress; costo bajo por almacenamiento |

### Credenciales Necesarias
1. **Service Account JSON** — Archivo `.json` descargado desde Google Cloud Console, codificado en base64
2. **GOOGLE_SHEET_ID** — ID del spreadsheet (visible en la URL de Google Sheets)
3. **R2** — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
4. Variables de entorno en `backend/.env` (dev) o en Railway (prod):
   ```
   GOOGLE_CREDENTIALS_BASE64=<service account JSON en base64>
   GOOGLE_SHEET_ID=<id_del_spreadsheet>
   ```

> El backend ya **no** lee `GOOGLE_APPLICATION_CREDENTIALS`. La única forma soportada es `GOOGLE_CREDENTIALS_BASE64`.

---

## 3. Dependencias Backend

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| `express` | ^5.2.1 | Framework web |
| `cors` | ^2.8.6 | CORS middleware |
| `helmet` | ^7.1.0 | Headers de seguridad estándar |
| `express-rate-limit` | ^7.1.5 | Rate limiting (login + global) |
| `jsonwebtoken` | ^9.0.3 | Emisión y verificación de JWT (access + refresh) |
| `bcrypt` | ^6.0.0 | Hashing de contraseñas |
| `dotenv` | ^17.4.1 | Variables de entorno |
| `googleapis` | ^171.4.0 | Google Sheets API client |
| `google-auth-library` | ^10.6.2 | Autenticación Service Account |
| `@google-cloud/vision` | ^5.3.5 | OCR con Google Vision |
| `tesseract.js` | ^7.0.0 | OCR fallback (open source) |
| `@aws-sdk/client-s3` | ^3.1032.0 | Cliente S3-compatible para Cloudflare R2 |
| `zod` | ^4.3.6 | Validación de schemas |

### Desarrollo

| Paquete | Versión | Uso |
|---------|---------|-----|
| `nodemon` | ^3.1.14 | Hot reload en desarrollo |

---

## 4. Dependencias Frontend

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| `next` | 16.2.2 | Framework fullstack React |
| `react` | 19.2.4 | Librería de UI |
| `react-dom` | 19.2.4 | Renderizado DOM |

### Desarrollo

| Paquete | Versión | Uso |
|---------|---------|-----|
| `typescript` | ^5 | Compilación TypeScript |
| `@types/node` | ^20 | Tipos Node.js |
| `@types/react` | ^19 | Tipos React |
| `@types/react-dom` | ^19 | Tipos React DOM |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.2.2 | Reglas ESLint para Next.js |

---

## 5. Recursos y Assets

| Recurso | Tipo | Ubicación | Descripción |
|---------|------|-----------|-------------|
| `spa.traineddata` | Binario (3.3MB) | `backend/` | Datos de entrenamiento de Tesseract para español |
| `google-vision.json` | JSON | `backend/keys/` | Service Account key (NO commitear) |
| Inter Font | CDN | Google Fonts | Tipografía principal |

---

## 6. Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **npm** | Package manager |
| **nodemon** | Auto-restart del backend en desarrollo |
| **Next.js Dev Server** | HMR/Fast Refresh para frontend |
| **ESLint** | Linting del frontend |
| **Git** | Control de versiones |

---

## 7. Puertos y URLs

| Servicio | URL | Puerto |
|----------|-----|--------|
| Frontend (dev) | http://localhost:3000 | 3000 |
| Backend (dev) | http://localhost:3001 | 3001 |
| Backend API base | http://localhost:3001/api | 3001 |

---

## 8. Decisiones de No-Uso

| Tecnología descartada | Razón |
|----------------------|-------|
| **TailwindCSS** | Preferencia por Vanilla CSS para control total del design system |
| **PostgreSQL / MySQL** | Google Sheets elegido intencionalmente por simplicidad operativa y familiaridad del usuario |
| **Auth0 / Clerk** | JWT propio + bcrypt sobre `config_agentes` cubre el caso (ver ADR-014, ADR-021) |
| **Prisma / Sequelize** | No aplica — la DB es Google Sheets |
| **Docker** | Usado para prep de deploy y arranque reproducible |
| **Monorepo tools (Turbo, Nx)** | Proyecto suficientemente simple, 2 carpetas independientes |
| **Socket.io / WebSockets** | No hay necesidad de real-time push en MVP |
| **Redux / Zustand** | React Context es suficiente para el estado actual |

---

## 9. Requisitos de Infraestructura

### Para desarrollo local
- Node.js >= 18
- npm
- Navegador moderno (Chrome/Firefox/Edge)

### Producción (vigente)
- **Frontend**: Vercel (Next.js nativo, auto-deploy en `main`)
- **Backend**: Railway (Node.js always-on, auto-deploy en `main`)
- **Persistencia**: Google Sheets compartido con la Service Account
- **Comprobantes**: Cloudflare R2 con CORS al dominio Vercel
- **Docker**: alternativa para VPS/Render/Cloud Run (no se usa en deploy actual)

### Variables de entorno necesarias

```env
# Backend (.env local o Railway)
GOOGLE_CREDENTIALS_BASE64=<service account JSON en base64>
GOOGLE_SHEET_ID=<spreadsheet_id>
JWT_SECRET=<>=32 chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AUTH_BOOTSTRAP_ADMIN_PASSWORD=<>
AUTH_BOOTSTRAP_AGENT_PASSWORD=<>
CORS_ORIGIN=http://localhost:3000   # o el dominio Vercel en prod
NODE_ENV=development                # production en Railway
PORT=3001                           # Railway inyecta PORT en runtime
RATE_LIMIT_GLOBAL=600/min
RATE_LIMIT_LOGIN=5/15min
R2_ACCOUNT_ID=<>
R2_ACCESS_KEY_ID=<>
R2_SECRET_ACCESS_KEY=<>
R2_BUCKET=<>
R2_PUBLIC_URL=<>

# Frontend (Vercel)
BACKEND_INTERNAL_URL=https://<railway-url>   # se evalúa en build time
# NEXT_PUBLIC_API_URL solo si se quiere bypass del proxy de Next.js
```
## 10. Backup Operativo

- Sheets snapshots are exported to R2 under `backups/sheets/YYYY-MM-DD/`.
- R2 receipts are copied daily to `backups/r2/YYYY-MM-DD/`.
- Recommended retention is 30 days for Sheets and 90 days for R2.
- No new environment variables were introduced for this ticket; the backup jobs reuse the existing Sheets and R2 credentials.
