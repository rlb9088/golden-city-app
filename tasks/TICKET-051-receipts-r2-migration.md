# TICKET-051: Migrar almacenamiento de comprobantes de Google Drive a Cloudflare R2

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 10 — Migración de almacenamiento
> **Esfuerzo estimado**: ~3h
> **Prioridad**: P1 — Reemplaza una integración ya implementada (Drive) por la definitiva (R2)

---

## Problema / Decisión

La persistencia de comprobantes se implementó con Google Drive en TICKET-044 / ADR-018. Se decide **reemplazarla por Cloudflare R2** como única capa de almacenamiento de archivos. Motivos:

- Separa responsabilidades: Google Sheets para datos, R2 para archivos.
- R2 es un almacenamiento de objetos genuino (URLs públicas, versionado, lifecycle).
- Sin cambios de vendor para la base de datos.

**IMPORTANTE**:
- Google Sheets sigue siendo la base de datos principal (sin cambios).
- NO se modifica nada de Sheets; sólo se cambia el destino de los archivos.
- R2 se usará exclusivamente para imágenes de comprobantes.

---

## Variables de entorno (ya existen en `.env.example`)

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL
```

---

## Acciones

### 1. Dependencias

- Instalar: `@aws-sdk/client-s3`.
- Evaluar si `googleapis` sigue siendo necesaria (sí: se mantiene para Sheets y Vision — **no desinstalar**).

### 2. Nuevo módulo `backend/services/r2.service.js`

- Inicializar `S3Client`:
  - `endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  - `region: 'auto'`
  - Credenciales: `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`
- Exportar:
  - `uploadReceipt(fileBuffer, fileName, mimeType)`:
    - Genera key única: `receipts/{timestamp}-{random}.jpg` (o con la extensión que corresponda al `mimeType`).
    - Sube con `PutObjectCommand` al bucket `R2_BUCKET` con `ContentType = mimeType`.
    - Retorna `{ url: `${R2_PUBLIC_URL}/${key}`, key }`.
- Fallo de subida:
  - Loguea (`logger.error`) y relanza. El caller decide si degrada el flujo (ver §3).

### 3. Cambios en `backend/services/pagos.service.js`

- Eliminar `require('./drive.service')` y todo uso de `driveService.uploadReceipt` y helpers Drive-específicos (`getReceiptFailureWarning` que menciona Drive, strings con "Drive").
- Al crear pago con `comprobante_base64`:
  - Parsear el base64 → `Buffer` + `mimeType`.
  - Llamar `r2Service.uploadReceipt(buffer, fileName, mimeType)`.
  - Si éxito:
    - `comprobante_url = resultado.url` (URL pública R2).
    - `comprobante_file_id = resultado.key` (key R2).
  - Si falla:
    - **No romper el flujo**: se guarda el pago sin URL, warning claro al caller, audit con `receipt_warning`.
- El campo `comprobante_file_id` en la hoja `pagos` ya existe (lo deja TICKET-044); **reutilizarlo** (ahora almacena una key R2 en vez de fileId de Drive).

### 4. Borrar código de Drive

- Eliminar `backend/services/drive.service.js`.
- Eliminar/renombrar `backend/tests/pagos-drive.test.js` → `pagos-r2.test.js` con nuevos mocks.
- Eliminar variables `DRIVE_RECEIPTS_FOLDER_ID` del código y `.env.example` (mantener en decisions.md como histórico).

### 5. Documentación

- Actualizar `.env.example`: quitar `DRIVE_RECEIPTS_FOLDER_ID` (ya no aplica).
- Los cambios en `docs/architecture.md` §5 y `docs/decisions.md` (nuevo ADR-020, supersede de ADR-018) se hacen en **TICKET-052**.

### 6. Frontend

- Sin cambios funcionales: `comprobante_url` sigue llegando en la respuesta del pago y la tabla ya la muestra como link. Verificar que los links de R2 abren correctamente.

---

## Archivos

- `backend/services/r2.service.js` (nuevo)
- `backend/services/pagos.service.js`
- `backend/services/drive.service.js` (eliminar)
- `backend/tests/pagos-drive.test.js` → `backend/tests/pagos-r2.test.js`
- `backend/package.json` (dep nueva)
- `.env.example`

## Dependencias

- Credenciales R2 válidas en `.env` antes de ejecutar contra entorno real.
- No depende de 047–050 (puede ejecutarse en paralelo).

## Criterios de Aceptación

- [ ] `@aws-sdk/client-s3` instalado.
- [ ] `r2.service.js` creado con `uploadReceipt(fileBuffer, fileName, mimeType)`.
- [ ] Un pago con comprobante produce una URL pública de R2 en `comprobante_url` y una key en `comprobante_file_id`.
- [ ] La URL se puede abrir públicamente (dentro del dominio `R2_PUBLIC_URL`).
- [ ] `drive.service.js` eliminado; no queda código ni strings de Drive para comprobantes en `pagos.service.js`.
- [ ] Si R2 falla: el pago se registra igualmente, con warning claro, sin romper el flujo.
- [ ] Tests de pagos con comprobante pasan contra R2 (mockeado).
- [ ] Google Sheets sigue siendo el único destino de datos — ningún campo de datos va a R2.

## Definición de Terminado

- Los comprobantes viven en R2 y sus URLs públicas se guardan en Sheets.
- Drive ya no se usa para este flujo. El código está limpio de referencias a Drive.
