# Arquitectura — Golden City Backoffice

> **Versión**: 1.5  
> **Última actualización**: 2026-04-19

---

## 1. Vista General

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO (Browser)                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Frontend (Next.js 16 + React 19)           │   │
│  │                                                          │   │
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌───────┐ │   │
│  │  │ Balance  │ │ Pagos  │ │Ingresos│ │Gastos │ │Bancos │ │   │
│  │  └─────────┘ └────────┘ └────────┘ └───────┘ └───────┘ │   │
│  │  ┌──────────────┐ ┌──────────┐ ┌─────────────────────┐ │   │
│  │  │Configuración │ │ Sidebar  │ │  ReceiptUploader/OCR│ │   │
│  │  └──────────────┘ └──────────┘ └─────────────────────┘ │   │
│  │                                                          │   │
│  │  lib/api.ts ←→ lib/auth-context.tsx ←→ lib/format.ts    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                     HTTP REST (JSON)                             │
│                  x-role / x-user headers                        │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Backend (Express.js 5)                     │   │
│  │                                                          │   │
│  │  Middleware: CORS → JSON → Auth (extractAuth)            │   │
│  │                                                          │   │
│  │  ┌────────────┐      ┌────────────┐                     │   │
│  │  │ Controllers │ ───→ │  Services  │                     │   │
│  │  └────────────┘      └────────────┘                     │   │
│  │         │                   │                             │   │
│  │    Routes +            Lógica de                          │   │
│  │    Validation          negocio +                          │   │
│  │    (Zod)               Auditoría                          │   │
│  │                             │                             │   │
│  │                    ┌────────────────┐                     │   │
│  │                    │  Repository    │                     │   │
│  │                    │ (sheetsRepo)   │                     │   │
│  │                    └────────────────┘                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│               Google Sheets API v4 + Cloudflare R2              │
│                    (o in-memory fallback)                        │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Google Sheets (Spreadsheet)                   │   │
│  │                                                          │   │
│  │  pagos │ ingresos │ gastos │ bancos │ audit              │   │
│  │  config_agentes │ config_bancos │ config_cajas │ ...     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         OCR Pipeline (invocado desde Backend)             │   │
│  │                                                          │   │
│  │  Google Cloud Vision API → (fallback) → Tesseract.js    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Capa Frontend

### 2.1 Tecnología
- **Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Vanilla CSS con design system propio (variables CSS globales)
- **UI**: React 19 (client components, hooks)
- **Tipografía**: Inter (Google Fonts)
- **Tema**: Dark premium con acentos dorados

### 2.2 Estructura de Archivos

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout (metadata, fonts, providers)
│   ├── client-layout.tsx       # Client wrapper (AuthProvider + Sidebar)
│   ├── page.tsx                # Redirect a /balance
│   ├── globals.css             # Design system completo
│   ├── layout.css              # Layout del app-container
│   │
│   ├── login/
│   │   └── page.tsx            # Formulario login (JWT username/password)
│   │
│   ├── balance/
│   │   ├── page.tsx            # Dashboard de balance global
│   │   └── balance.css
│   │
│   ├── pagos/
│   │   ├── page.tsx            # Formulario + tabla de pagos (con OCR, filtros, anular/editar)
│   │   └── pagos.css
│   │
│   ├── ingresos/
│   │   ├── page.tsx            # Formulario + tabla de ingresos (admin, anular/editar)
│   │   └── ingresos.css
│   │
│   ├── gastos/
│   │   ├── page.tsx            # Formulario + tabla de gastos (admin, anular/editar)
│   │   └── gastos.css
│   │
│   ├── bancos/
│   │   ├── page.tsx            # Formulario + tabla de saldos bancarios (admin)
│   │   └── bancos.css
│   │
│   ├── configuracion/
│   │   ├── page.tsx            # CRUD admin de tablas de config
│   │   └── configuracion.css
│   │
│   └── audit/
│       ├── page.tsx            # Tabla de auditoría (admin only, filtros, JSON expandible)
│       └── audit.css
│
├── components/
│   ├── Sidebar.tsx + .css      # Navegación lateral con selector de rol + responsive
│   ├── AlertBanner.tsx + .css  # Alertas globales (success/error/warning) + autoDismiss
│   ├── StatsCard.tsx + .css    # Cards de métricas del dashboard
│   ├── ReceiptUploader.tsx + .css  # Upload, drag&drop, paste, OCR
│   ├── BackendStatusBanner.tsx # Health polling (20s) + banner de desconexión
│   └── TableSkeleton.tsx       # Skeleton loader genérico para tablas
│
└── lib/
    ├── api.ts                  # Cliente HTTP (fetch wrapper con auth headers)
    ├── auth-context.tsx        # Context de autenticación (localStorage)
    └── format.ts               # Formateo de moneda, fechas, timezone Lima
```

### 2.3 Patrones Frontend

| Patrón | Implementación |
|--------|---------------|
| **State** | React hooks (`useState`, `useCallback`, `useEffect`) |
| **Auth** | React Context + localStorage |
| **API** | Client-side fetch con headers de auth inyectados |
| **Routing** | Next.js App Router (file-based) |
| **Styling** | CSS Modules-like (archivos .css por componente/página) |
| **Validación** | Inline en formularios + warnings no bloqueantes |

---

## 3. Capa Backend

### 3.1 Tecnología
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Lenguaje**: JavaScript (CommonJS)
- **Validación**: Zod 4
- **OCR**: Google Cloud Vision API + Tesseract.js (fallback)

### 3.2 Estructura de Archivos

```
backend/
├── index.js                    # Entry point, middleware config, routes
├── package.json
├── .env                        # Variables de entorno
│
├── config/
│   ├── sheetsClient.js         # Conexión a Google Sheets API (singleton)
│   ├── sheetsSchema.js         # Schema centralizado de hojas y headers
│   └── timezone.js             # Helpers de timezone (America/Lima)
│
├── middleware/
│   ├── auth.middleware.js      # extractAuth, requireAuth, requireAdmin
│   ├── errorHandler.js         # Error handler global + 404 handler
│   └── validate.middleware.js  # Validación genérica con Zod
│
├── utils/
│   └── appError.js             # Clases de error (AppError, BadRequest, etc.)
│
├── routes/
│   ├── auth.routes.js          # POST /login, GET /me (JWT)
│   ├── pagos.routes.js         # POST /, GET /, PUT /:id, DELETE /:id (anular)
│   ├── ingresos.routes.js      # POST /, GET /, PUT /:id, DELETE /:id (anular)
│   ├── gastos.routes.js        # POST /, GET /, PUT /:id, DELETE /:id (anular)
│   ├── bancos.routes.js        # POST /, GET /
│   ├── balance.routes.js       # GET /, GET /:agente
│   ├── config.routes.js        # Full CRUD + import + delete
│   ├── audit.routes.js         # GET / (filtros entity/action/user/desde/hasta)
│   └── ocr.routes.js           # POST /analyze
│
├── controllers/
│   ├── auth.controller.js      # login, me
│   ├── pagos.controller.js     # create, getAll, update, cancel
│   ├── ingresos.controller.js  # create, getAll, update, cancel
│   ├── gastos.controller.js    # create, getAll, update, cancel
│   ├── bancos.controller.js    # create, getAll
│   ├── balance.controller.js   # getGlobal, getByAgent
│   ├── config.controller.js    # getFullConfig, getTable, addToTable, importBatch, removeFromTable
│   ├── audit.controller.js     # getAuditLogs (filtros + JSON)
│   └── ocr.controller.js       # analyze
│
├── services/
│   ├── auth.service.js         # login, verifyToken, getAuthUsers, bootstrap
│   ├── pagos.service.js        # CRUD + getFiltered + update + cancel + audit
│   ├── ingresos.service.js     # CRUD + update + cancel + audit
│   ├── gastos.service.js       # CRUD + update + cancel + audit
│   ├── bancos.service.js       # Upsert + audit
│   ├── balance.service.js      # Cálculo (excluye estado='anulado')
│   ├── config.service.js       # CRUD + seed + validateReferences + deleteRow
│   ├── audit.service.js        # Append-only + getFiltered (5 filtros)
│   └── ocr.service.js          # Pipeline OCR (Vision → Tesseract → Mock)
│
├── repositories/
│   └── sheetsRepository.js     # getAll, append, update, findByColumn + retry
│
├── schemas/
│   ├── pagos.schema.js         # Zod schema para pagos
│   ├── ingresos.schema.js
│   ├── gastos.schema.js
│   └── bancos.schema.js
│
├── scripts/
│   ├── setupSheets.js          # Creación automática de hojas en Sheets
│   ├── verifySheetsSetup.js    # Verificación de estructura de hojas
│   └── verifySheetsE2E.js      # Test E2E contra Sheets real
│
└── keys/
    └── google-vision.json      # Service account key (no commiteado)
```

### 3.3 Patrón Arquitectónico: Controller → Service → Repository

```
Request
  │
  ▼
Route (define path + middleware chain)
  │
  ▼
Middleware (auth + validation con Zod)
  │
  ▼
Controller (maneja req/res, delega lógica)
  │
  ▼
Service (lógica de negocio, auditoría, cálculos)
  │
  ▼
Repository (abstracción de persistencia: Sheets o in-memory)
  │
  ▼
Google Sheets API / In-memory store
```

### 3.4 API Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | - | Health check (sin auth) |
| POST | `/api/auth/login` | - | Login con username/password, retorna JWT |
| GET | `/api/auth/me` | verifyToken | Datos del usuario logueado |
| GET | `/api/config` | - | Config completa para los selects (sin auth) |
| GET | `/api/config/:table` | Admin | Datos de una tabla de config |
| POST | `/api/config/:table` | Admin | Agregar registro a tabla |
| POST | `/api/config/:table/import` | Admin | Importación masiva |
| DELETE | `/api/config/:table/:id` | Admin | Eliminar registro de config (real delete + audit) |
| POST | `/api/pagos` | Auth | Crear pago |
| GET | `/api/pagos` | Auth | Listar pagos (filtros: desde/hasta/agente/banco/usuario) |
| PUT | `/api/pagos/:id` | Admin | Editar pago |
| DELETE | `/api/pagos/:id` | Admin | Anular pago (soft-delete: estado='anulado', audita) |
| POST | `/api/ingresos` | Admin | Crear ingreso |
| GET | `/api/ingresos` | Auth | Listar ingresos |
| PUT | `/api/ingresos/:id` | Admin | Editar ingreso |
| DELETE | `/api/ingresos/:id` | Admin | Anular ingreso |
| POST | `/api/gastos` | Admin | Crear gasto |
| GET | `/api/gastos` | Auth | Listar gastos |
| PUT | `/api/gastos/:id` | Admin | Editar gasto |
| DELETE | `/api/gastos/:id` | Admin | Anular gasto |
| POST | `/api/bancos` | Admin | Upsert saldo bancario |
| GET | `/api/bancos` | Auth | Listar saldos bancarios |
| GET | `/api/balance` | Auth | Balance global (excluye anulados) |
| GET | `/api/balance/:agente` | Auth | Balance de un agente (excluye anulados) |
| GET | `/api/audit` | Admin | Listar auditoría (filtros: entity/action/user/desde/hasta) |
| POST | `/api/ocr/analyze` | Auth | Analizar imagen con OCR |

---

## 4. Capa de Datos

### 4.1 Persistencia Dual

| Modo | Condición | Uso |
|------|-----------|-----|
| **Google Sheets** | `GOOGLE_APPLICATION_CREDENTIALS` y `GOOGLE_SHEET_ID` configurados | Producción |
| **In-memory** | Variables no configuradas | Desarrollo local |

El `sheetsRepository.js` abstrae ambos modos transparentemente.

### 4.2 Modelo de Datos
Ver sección 4 del [PRD](./PRD.md) para el modelo completo de hojas y headers.

### 4.3 Generación de IDs
Formato: `{PREFIJO}-{timestamp}-{counter}`
- `PAG-` para pagos
- `ING-` para ingresos
- `GAS-` para gastos
- `BAN-` para bancos
- `AUD-` para auditoría

> ⚠️ **Nota**: Los counters son in-memory y se resetean al reiniciar el servidor. En producción con Sheets, el timestamp proporciona unicidad suficiente.

---

## 5. Servicios Externos

### 5.1 Google Sheets API v4
- **Propósito**: Base de datos del MVP
- **Autenticación**: Service Account (keyFile JSON)
- **Permisos**: spreadsheets + drive.readonly
- **Operaciones**: read (values.get), append (values.append), update (values.update)
- **Límite conocido**: ~100 req/100s — las importaciones masivas deben usar batch append (TICKET-042; ver ADR-019)

### 5.2 Google Cloud Vision API
- **Propósito**: OCR primario para comprobantes
- **Método**: `documentTextDetection`
- **Input**: Base64 image
- **Output**: Texto completo del documento

### 5.3 Tesseract.js
- **Propósito**: OCR fallback (open source, sin costos)
- **Idioma**: Español (`spa`)
- **Input**: Buffer de imagen
- **Archivo de datos**: `spa.traineddata` (~3.3MB incluido en backend)

### 5.4 Cloudflare R2
- **Propósito**: Almacenamiento persistente de comprobantes de pago
- **Autenticación**: credenciales S3-compatible (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)
- **Operaciones**: `PutObject` para subir comprobantes y guardar una key persistente en `comprobante_file_id`
- **Salida**: `comprobante_url` pública basada en `R2_PUBLIC_URL`
- **Variables de entorno**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- **Decisión**: ver ADR-020

---

## 6. Seguridad

### 6.1 Estado Actual
- **Auth real**: JWT + bcrypt (tabla `config_agentes` como fuente única de identidad; `config_auth_users` deprecada — ver ADR-021)
- **Token expiration**: 24h configurable
- **CORS**: configurado a `http://localhost:3000` (requiere `CORS_ORIGIN` env para prod)
- **Validación de entrada**: Zod en todos los endpoints de escritura
- **Permisos**: verificados en middleware backend (`verifyToken`, `requireAuth`, `requireAdmin`)

### 6.2 Endurecimiento Aplicado
- ✅ **GETs financieros protegidos**: `/api/pagos`, `/api/ingresos`, `/api/gastos`, `/api/bancos`, `/api/balance*` requieren JWT; `/api/config` general queda público por diseño.
- ✅ **JWT_SECRET endurecido**: en producción falla el arranque si falta; en desarrollo usa fallback solo para local.
- ✅ **Bootstrap controlado**: las credenciales base se exigen por env en producción; en desarrollo se permiten defaults inseguros solo para demo.
- ✅ **Rate-limit + Helmet**: login con límite específico, middleware global moderado y headers de seguridad estándar activados.
- ✅ **Service Account key**: en `/keys/` (no commiteado si `.gitignore` correcto)
- ✅ **Refresh tokens**: backend y frontend completos (15min access / 7d refresh, secret separado, auto-renovación en cliente).

### 6.3 Credenciales
- En `.env` (no commiteado)
- Service Account key en `backend/keys/` (NO commiteado — confirmar `.gitignore`)
- JWT_SECRET debe ser env-variable larga en producción

---

## 7. Comunicación Frontend ↔ Backend

```
Frontend (localhost:3000)  →  Backend (localhost:3001)
         │                            │
    fetch() con headers          express.json()
    x-role: admin|agent          extractAuth middleware
    x-user: nombre               cors: localhost:3000
    Content-Type: JSON
```

- Responses siempre siguen el formato: `{ status: 'success', data: {...} }`
- Errores: `{ error: 'mensaje', details: '...' }`

---

## 8. Estado de Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend: estructura base | ✅ Completo | Express + middleware + routes + error handler |
| Backend: CRUD pagos | ✅ Completo | Con auditoría + validación referencial |
| Backend: CRUD ingresos | ✅ Completo | Con auditoría + validación referencial |
| Backend: CRUD gastos | ✅ Completo | Con auditoría + validación referencial |
| Backend: saldos bancarios | ✅ Completo | Con upsert + auditoría |
| Backend: balance calculation | ✅ Completo | Global + por agente |
| Backend: config CRUD | ✅ Completo | CRUD + seed data + deleteRow real + auditoría |
| Backend: OCR pipeline | ✅ Completo | Vision + Tesseract fallback |
| Backend: auditoría | ✅ Completo | Append-only |
| Backend: error handling | ✅ Completo | AppError hierarchy + retry con backoff |
| Backend: validación referencial | ✅ Completo | Warnings no bloqueantes + audit logging |
| Backend: paginación unificada | ✅ Completo | Todos los listados usan limit/offset + metadata |
| Frontend: design system | ✅ Completo | Dark theme, gold accents, responsive |
| Frontend: login | ✅ Completo | username/password + JWT almacenado + redirección |
| Frontend: sidebar + nav | ✅ Completo | Badge rol + logout + hamburger mobile (rol selector eliminado) |
| Frontend: dashboard balance | ✅ Completo | 4 cards + 2 tablas + skeleton (excluye anulados) |
| Frontend: paginación de listados | ✅ Completo | PaginationControls unificado en pagos, ingresos, gastos, bancos y audit |
| Frontend: refresh tokens | ✅ Completo | Interceptor de 401 renueva sesión con refresh token |
| Frontend: formulario pagos | ✅ Completo | Con OCR + validación + skeleton + filtros + editar/anular |
| Frontend: formulario ingresos | ✅ Completo | Admin only |
| Frontend: formulario gastos | ✅ Completo | Con categorías dinámicas |
| Frontend: formulario bancos | ✅ Completo | Con upsert warning |
| Frontend: configuración | ✅ Completo | CRUD completo con edición e importación masiva |
| Frontend: auditoría UI | ✅ Completo | Tabla + filtros + JSON expandible (admin only) |
| Frontend: UX resilience | ✅ Completo | Health polling, timeout, retry, skeletons |
| Google Sheets: conexión | ✅ Completo | Configurado y verificado E2E |
| Google Sheets: hojas creadas | ✅ Completo | Script automático + verificación |
| Auth real | ✅ Completo | JWT + bcrypt (tabla `config_agentes`, bootstrap configurable; ver ADR-021) |
| Identidad unificada + scoping por propietario | ✅ Completo | `config_agentes` fuente única; `banco_id` FK; GET /bancos/scoped; validación 403 en pagos/ingresos/bancos |
| Migración R2 (comprobantes) | ✅ Completo | R2 reemplaza Drive; degradación elegante si R2 no configurado (ver ADR-020) |
| Filtros pagos | ✅ Completo | Query params + normalización de fechas + combinación AND |
| Anulación/edición | ✅ Completo | Soft-delete (estado='anulado'), auditoría con motivo |
| Comprobantes de pago | ✅ Completo | Imagen persistida en Cloudflare R2 con `comprobante_file_id` |
| Tests | ✅ Completo | 8 suites node:test + E2E contra Sheets real |
| CI/CD | ✅ Completo | GitHub Actions ejecuta tests backend, lint/build frontend, npm audit y docker build en main |
| Deploy | ✅ Completo | Dockerfile, entrypoint, .gitignore, .dockerignore y guia de deploy listos |

---

## 9. Pendientes Pre-Producción

### Bloquean el pase a producción (Sprint 11)
1. **Ejecución de scripts de migración** — `migrateAuthUsersToAgentes.js` y `migrateBancoId.js` deben ejecutarse en modo `--dry-run` + `--commit` contra la hoja de producción antes del primer deploy (TICKET-055)
2. **Despliegue Vercel + Railway** — frontend en Vercel, backend en Railway; configurar variables de entorno, CORS y credenciales Google (TICKET-056)

### Deuda técnica menor (no bloquean)
- `config_auth_users` en `sheetsSchema.js` marcada como deprecada; la hoja en producción se renombrará a `_deprecated` durante TICKET-055
- IDs basados en timestamp (ADR-009): aceptable para MVP; considerar `crypto.randomUUID()` en el futuro
