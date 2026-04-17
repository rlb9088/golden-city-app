# Setup Guide - Golden City Backoffice

Guia paso a paso para dejar el proyecto funcionando desde cero en local, con Google Cloud y Google Sheets reales.

## 1. Pre-requisitos

Antes de empezar, confirma que tienes:

- Node.js 18 o superior
- npm
- Una cuenta de Google
- Acceso a Google Cloud Console
- Un editor capaz de abrir archivos `.json` y `.env`

## 2. Configuracion de Google Cloud

### 2.1 Crear el proyecto

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto nuevo para Golden City Backoffice.
3. Espera a que el proyecto quede seleccionado en la barra superior.

### 2.2 Habilitar APIs

Habilita estas APIs en el proyecto:

- Google Sheets API
- Google Drive API
- Google Cloud Vision API

Si alguna API no aparece como habilitada, el backend no podra completar el flujo real de hojas u OCR.

### 2.3 Crear la Service Account

1. Ve a `IAM y administracion > Cuentas de servicio`.
2. Crea una nueva cuenta de servicio.
3. Asigna un nombre descriptivo, por ejemplo `golden-city-backoffice`.
4. Crea y descarga una clave JSON.
5. Guarda ese archivo en `backend/keys/` con un nombre estable, por ejemplo `google-vision.json`.

### 2.4 Comprobar el email de la cuenta de servicio

Abre el JSON descargado y localiza el campo `client_email`. Ese email es el que debes compartir con el spreadsheet en el siguiente paso.

## 3. Configuracion de Google Sheets

### 3.1 Crear el spreadsheet

1. Crea un spreadsheet nuevo en Google Sheets.
2. Ponle un nombre identificable, por ejemplo `Golden City Backoffice`.
3. Copia el `spreadsheetId` de la URL.

### 3.2 Crear las 11 hojas requeridas

Crea estas hojas con los nombres exactos:

- `pagos`
- `ingresos`
- `gastos`
- `bancos`
- `audit`
- `config_agentes`
- `config_categorias`
- `config_bancos`
- `config_cajas`
- `config_tipos_pago`
- `config_usuarios`

### 3.3 Escribir los headers en fila 1

Usa estos headers exactos por hoja:

| Hoja | Headers |
|------|---------|
| `pagos` | `id`, `usuario`, `caja`, `banco`, `monto`, `tipo`, `comprobante_url`, `fecha_comprobante`, `fecha_registro`, `agente` |
| `ingresos` | `id`, `agente`, `banco`, `monto`, `fecha_movimiento`, `fecha_registro` |
| `gastos` | `id`, `fecha_gasto`, `fecha_registro`, `concepto`, `categoria`, `subcategoria`, `banco`, `monto` |
| `bancos` | `id`, `fecha`, `banco`, `saldo` |
| `audit` | `id`, `action`, `entity`, `user`, `timestamp`, `changes` |
| `config_agentes` | `id`, `nombre` |
| `config_categorias` | `id`, `categoria`, `subcategoria` |
| `config_bancos` | `id`, `nombre`, `propietario` |
| `config_cajas` | `id`, `nombre` |
| `config_tipos_pago` | `id`, `nombre` |
| `config_usuarios` | `id`, `nombre` |

### 3.4 Compartir el spreadsheet

1. Comparte el spreadsheet con el `client_email` de la Service Account.
2. Dale permiso de editor.
3. Verifica que la cuenta aparezca en los permisos del archivo.

## 4. Configuracion del proyecto

### 4.1 Clonar el repo

Clona el repositorio en tu maquina local y entra en la carpeta raiz del proyecto.

### 4.2 Configurar el backend

1. En `backend/`, copia la estructura de variables desde `.env.example`.
2. Crea o edita `backend/.env`.
3. Rellena estas variables:

```env
GOOGLE_APPLICATION_CREDENTIALS=keys/google-vision.json
GOOGLE_SHEET_ID=tu_spreadsheet_id
GOOGLE_SHEET_OWNER_EMAIL=tu_correo_opcional
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

Notas:

- `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar al JSON dentro de `backend/keys/`.
- `GOOGLE_SHEET_ID` debe ser el id exacto del spreadsheet.
- `GOOGLE_SHEET_OWNER_EMAIL` es opcional, pero ayuda si quieres que el script comparta el spreadsheet automaticamente cuando lo crea.

### 4.3 Instalar dependencias

Instala dependencias en ambos proyectos:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 4.4 Configurar el frontend

El frontend usa un proxy interno para `/api` por defecto, asi que no necesita una URL publica del backend para el flujo local o el contenedor.

Si quieres apuntar a un backend separado, crea `frontend/.env.local` con:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 5. Preparar las hojas automaticamente

Si ya configuraste `backend/.env` y la Service Account tiene acceso al spreadsheet, puedes dejar que el backend cree o complete la estructura con el script incluido:

```bash
cd backend
npm run sheets:setup
```

Luego verifica la estructura:

```bash
cd backend
npm run sheets:verify
```

El resultado esperado es que las 11 hojas existan y que la fila 1 tenga los headers correctos.

## 6. Arranque local

### 6.1 Levantar el backend

```bash
cd backend
npm run dev
```

El backend corre en `http://localhost:3001`.

### 6.2 Levantar el frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

El frontend corre en `http://localhost:3000`.

### 6.3 Comportamiento esperado

Cuando todo esta bien configurado:

- El backend responde en `/api/health`
- El frontend carga la app sin errores
- El modo del backend indica Google Sheets en lugar de in-memory

## 7. Verificacion final

Haz estas comprobaciones en este orden:

1. Abre `http://localhost:3001/api/health`.
2. Confirma que devuelve `status: "ok"`.
3. Entra al frontend en `http://localhost:3000`.
4. Crea un pago de prueba desde la pantalla de pagos.
5. Verifica que el registro aparezca en la hoja `pagos` del spreadsheet.
6. Comprueba que tambien se registre la auditoria en la hoja `audit`.

Si el backend arranca pero no encuentra credenciales o `GOOGLE_SHEET_ID`, caera en modo in-memory. Eso sirve para desarrollo, pero no valida persistencia real.

## 8. Despliegue futuro

Este proyecto todavia no trae despliegue configurado, pero estas son las opciones recomendadas:

- Frontend: Vercel
- Backend: Railway, Render, Google Cloud Run o un VPS
- Persistencia: Google Sheets compartido con la Service Account

Checklist antes de producir:

- Variables de entorno separadas por entorno
- `CORS_ORIGIN` apuntando al dominio real del frontend
- Service Account con acceso al spreadsheet real
- Vision API habilitada si vas a usar OCR

## 9. Troubleshooting rapido

- Si el backend no conecta, revisa que `GOOGLE_APPLICATION_CREDENTIALS` apunte al JSON correcto.
- Si Sheets devuelve `403`, comparte el spreadsheet con el `client_email` de la Service Account.
- Si `npm run sheets:verify` falla, revisa que los nombres de hojas y los headers coincidan exactamente.
- Si el frontend no llega al backend, revisa `NEXT_PUBLIC_API_URL` y `CORS_ORIGIN`.

## 10. Resultado esperado

Al terminar estos pasos deberias tener:

- Backend funcionando en `3001`
- Frontend funcionando en `3000`
- Spreadsheet con 11 hojas y headers correctos
- Un pago de prueba visible en Google Sheets
- Auditoria escrita automaticamente
