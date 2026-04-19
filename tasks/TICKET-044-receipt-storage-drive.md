# TICKET-044: Persistencia del comprobante de pago en Google Drive

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 7 - Bugfix post-UAT
> **Esfuerzo**: ~3h
> **Prioridad**: P1 — El comprobante se pierde al cerrar sesión; no hay trazabilidad del voucher

---

## Problema

El comprobante (imagen de voucher) que sube el operador en Pagos se procesa con OCR para extraer monto y fecha, pero **no se persiste**. La celda `comprobante_url` en Google Sheets queda con un `blob:` URL temporal del navegador, que deja de ser válido al cerrar la pestaña.

No hay forma de recuperar el comprobante original después de registrar el pago.

---

## Causa Raíz

- `frontend/src/components/ReceiptUploader.tsx:78`: genera `URL.createObjectURL(file)` — URL válida solo en la sesión del navegador.
- `backend/services/ocr.service.js`: recibe base64, analiza con Vision/Tesseract y **descarta la imagen** sin guardarla.
- `backend/services/pagos.service.js:8-11, 132-150`: guarda `comprobante_url` tal como llega del frontend (el blob URL temporal).
- No existe lógica de subida a ningún almacenamiento persistente.

---

## Solución Adoptada: Google Drive vía Service Account existente

Se reutiliza la Service Account ya configurada (`backend/keys/google-vision.json`) añadiendo el scope `drive.file`. El comprobante se sube a una carpeta en Drive compartida con el SA, y se guarda el `webViewLink` + `fileId` en Sheets.

**Ventajas**:
- Sin vendor adicional ni costo extra (reutiliza SA).
- Coherente con el ecosistema Google del stack.
- El link es accesible para quien tenga permiso en la carpeta Drive.
- Archivos ligeros gracias a compresión JPEG frontend.

**Alternativas descartadas**: base64 en Sheets (celda ~50k chars, inviable), filesystem backend (se pierde en redeploy), Cloudinary/S3 (vendor innecesario).

---

## Acciones

### Prerequisito (manual, operador)

1. Crear una carpeta en Google Drive: "Comprobantes - Golden City".
2. Compartirla con el email del Service Account con rol **Editor**.
3. Copiar el ID de la carpeta (de la URL de Drive) y añadirlo como variable de entorno:
   ```
   DRIVE_RECEIPTS_FOLDER_ID=<id_carpeta>
   ```

### Backend

1. Crear `backend/services/drive.service.js`:
   - Método `uploadReceipt(base64Image, meta)`:
     - `meta = { pagoId, fecha, agente }` para nombrar el archivo descriptivamente.
     - Inicializa cliente Drive con las mismas credenciales del SA (`backend/keys/google-vision.json`).
     - Sube el archivo como `image/jpeg` a `DRIVE_RECEIPTS_FOLDER_ID`.
     - Nombre sugerido: `comprobante-{pagoId}-{fecha}.jpg`.
     - Retorna `{ fileId, webViewLink }`.
   - Si `DRIVE_RECEIPTS_FOLDER_ID` no está configurado → retorna `null` con log de warning (no bloquea el pago).
2. En `backend/services/pagos.service.js` — en el método de creación de pago:
   - Si el body incluye `comprobante_base64`:
     - Llamar `driveService.uploadReceipt(comprobante_base64, { pagoId, fecha, agente })`.
     - Si éxito: guardar `webViewLink` en campo `comprobante_url` y `fileId` en campo `comprobante_file_id`.
     - Si error (Drive no disponible): registrar warning en auditoría + guardar cadena vacía en `comprobante_url`. **El pago se crea igualmente**.
3. Actualizar schema de Sheets: añadir columna `comprobante_file_id` a la hoja `pagos`.

### Frontend

1. En `frontend/src/components/ReceiptUploader.tsx`:
   - Al confirmar la imagen para el pago, enviar la imagen como `comprobante_base64` (ya disponible como data URL) junto al payload del pago.
   - Eliminar el paso de generar blob URL para el campo del formulario; el link final lo devuelve el backend.
2. Al recibir la respuesta del pago creado, mostrar el `comprobante_url` recibido como enlace clickeable en la tabla de pagos.
3. En la tabla de pagos: la celda de comprobante debe mostrar "Ver comprobante" (link) o "—" si no hay URL.

### Optimización de peso

- La imagen ya se redimensiona a max 1200px en el frontend (`ReceiptUploader.tsx:44-50`).
- Cambiar la conversión de PNG a **JPEG con calidad 0.85** antes de enviar al backend (~70% menor peso).
- Peso esperado: 150–300KB por comprobante.

---

## Archivos

- `backend/services/drive.service.js` — nuevo servicio de subida a Drive
- `backend/services/pagos.service.js` — integrar `driveService.uploadReceipt()` en la creación de pagos
- `backend/config/sheetsSchema.js` — añadir columna `comprobante_file_id` a hoja `pagos`
- `frontend/src/components/ReceiptUploader.tsx` — enviar JPEG en lugar de PNG; eliminar blob URL
- `frontend/src/app/pagos/page.tsx` — mostrar link de comprobante en tabla

## Dependencias

- Service Account debe tener scope `drive.file` (puede requerir regenerar credenciales o añadir scope).
- Variable de entorno `DRIVE_RECEIPTS_FOLDER_ID` debe estar configurada antes de ejecutar en producción.
- Ver **Prerequisito manual** arriba.

## Criterios de Aceptación

- [ ] Al registrar un pago con comprobante, la imagen se sube a la carpeta de Drive.
- [ ] La celda `comprobante_url` en Sheets contiene un `webViewLink` válido (no un blob URL).
- [ ] La celda `comprobante_file_id` en Sheets contiene el `fileId` de Drive.
- [ ] Si Drive no está configurado (`DRIVE_RECEIPTS_FOLDER_ID` ausente), el pago se crea igualmente sin error.
- [ ] Si la subida a Drive falla (error de red, permisos), el pago se crea con warning en auditoría.
- [ ] En la tabla de pagos, la columna comprobante muestra "Ver comprobante" (link) o "—".
- [ ] Los archivos subidos son JPEG ≤ 400KB promedio.
- [ ] El flow de OCR no se ve afectado (sigue funcionando con o sin Drive).

## Definición de Terminado

- Cada pago con comprobante tiene un enlace permanente a la imagen en Drive.
- El enlace es accesible para admins con acceso a la carpeta compartida.
- Sin regresiones en el flujo de pagos.
