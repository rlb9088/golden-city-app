# Tech Stack — Golden City Backoffice

> **Versión**: 1.0  
> **Última actualización**: 2026-04-15

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

## 2. Servicios Externos (Google Cloud)

| Servicio | Uso | Requisitos | Costo |
|----------|-----|-----------|-------|
| **Google Sheets API v4** | Base de datos MVP | Service Account + Spreadsheet compartido | Gratis (cuota: 100 req/100s/user) |
| **Google Cloud Vision API** | OCR primario para comprobantes | Service Account con Vision API habilitada | $1.50/1000 imágenes (primeras 1000 gratis/mes) |
| **Google Drive API v3** | Lectura de metadata del spreadsheet | Incluido en scopes del Service Account | Gratis |

### Credenciales Necesarias
1. **Service Account JSON** — Archivo `.json` descargado desde Google Cloud Console
2. **GOOGLE_SHEET_ID** — ID del spreadsheet (visible en la URL de Google Sheets)
3. Variables de entorno en `backend/.env`:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=keys/google-vision.json
   GOOGLE_SHEET_ID=<id_del_spreadsheet>
   ```

---

## 3. Dependencias Backend

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| `express` | ^5.2.1 | Framework web |
| `cors` | ^2.8.6 | CORS middleware |
| `dotenv` | ^17.4.1 | Variables de entorno |
| `googleapis` | ^171.4.0 | Google Sheets API client |
| `google-auth-library` | ^10.6.2 | Autenticación Service Account |
| `@google-cloud/vision` | ^5.3.5 | OCR con Google Vision |
| `tesseract.js` | ^7.0.0 | OCR fallback (open source) |
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
| **JWT / Auth0** | Fuera del MVP, se implementará en fase post-MVP |
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

### Para producción (futuro)
- Hosting frontend: Vercel (recomendado para Next.js) o cualquier plataforma con soporte Node
- Hosting backend: Railway, Render, Google Cloud Run, o VPS
- Google Cloud: proyecto con Sheets API + Vision API habilitadas
- Spreadsheet de Google Sheets compartido con la Service Account
- Docker: soporte ya preparado para despliegue y pruebas locales

### Variables de entorno necesarias

```env
# Backend (.env)
GOOGLE_APPLICATION_CREDENTIALS=keys/google-vision.json
GOOGLE_SHEET_ID=<spreadsheet_id>
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# Frontend (variables de entorno de Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3001
```
