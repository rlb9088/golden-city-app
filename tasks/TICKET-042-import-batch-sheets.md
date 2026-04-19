# TICKET-042: Importación masiva — batch append para evitar rate-limit de Sheets

> **Estado**: 🟢 COMPLETADO
> **Sprint**: 7 - Bugfix post-UAT
> **Esfuerzo**: ~2h
> **Prioridad**: P0 — Feature rota en volumen real (162 logins → solo ~33 cargados)

---

## Problema

Al importar 162 usuarios desde Configuración → Usuarios se produce el error:

> "Límite de solicitudes excedido al consultar google sheets"

y solo persisten aproximadamente 33 usuarios. El proceso aborta a mitad de la importación, dejando el estado **parcialmente consistente** (unos usuarios sí, otros no, sin indicación de cuáles fallaron).

---

## Causa Raíz

- `backend/services/config.service.js:211-230` — `importBatch` itera secuencialmente y llama `repo.append()` **una vez por usuario**.
- `backend/repositories/sheetsRepository.js:177-196` — cada `append()` ejecuta una llamada individual a `values.append` de la Google Sheets API.
- Con 162 usuarios = 162 API calls consecutivos → supera el límite de ~100 req/100s definido en ADR-001.
- El retry con backoff exponencial (3 intentos, base 250ms en `sheetsRepository.js:112-127`) agota sus intentos y lanza `RateLimitError`, abortando el resto.

---

## Solución

### Principio
La Google Sheets API `values.append` acepta **múltiples filas en una sola llamada** (`values: [[row1], [row2], ...]`). Pasar de N llamadas a 1 (o unos pocos chunks).

### Backend

1. Implementar `repo.appendBatch(sheetName, rows[])` en `backend/repositories/sheetsRepository.js`:
   - **Modo Sheets**: una sola llamada `spreadsheets.values.append` con `values: rows`.
   - **Modo memory**: push de todas las filas al array en un ciclo (sin API calls).
   - Si el payload supera ~2MB (aprox. 500+ filas densas), partir en chunks y hacer una llamada por chunk con un delay mínimo (100ms) entre cada una.
2. Reescribir `config.service.importBatch()` en `backend/services/config.service.js`:
   - Generar todos los IDs y construir el array completo de rows en memoria.
   - Llamar `repo.appendBatch(sheet, allRows)` → **1 call a la API**.
   - Registrar **una única entrada de auditoría** con `action='import'`, `entity=config_<tabla>`, `changes: { count: N, items: [...nombres] }`.
3. Mantener el manejo de errores: si `appendBatch` falla (ej. credenciales), propagar el error completo con mensaje claro → **ninguna fila parcial**.

### Frontend

- Sin cambios funcionales. El mensaje de error actual seguirá mostrándose si falla, pero el flujo normal ya no debería alcanzar el rate-limit.
- Opcionalmente mostrar progreso si se implementa chunk mode (bajo impacto).

---

## Archivos

- `backend/repositories/sheetsRepository.js` — agregar método `appendBatch(sheetName, rows[])`
- `backend/services/config.service.js` — reescribir `importBatch()` para usar `appendBatch`

## Dependencias

- Ninguna bloqueante. No depende de otros tickets.

## Criterios de Aceptación

- [ ] Importar 162 usuarios completa sin errores.
- [ ] Importar 500 usuarios genera ≤2 llamadas a la API de Sheets.
- [ ] En modo in-memory, la importación funciona igual.
- [ ] Si falla la operación, **ninguna** fila parcial queda en Sheets (o se notifica exactamente cuántas fallaron si se usó chunks).
- [ ] Se registra **una sola entrada** en auditoría por operación de importación, con `count` y tabla.
- [ ] Los tests existentes de importación siguen pasando.

## Definición de Terminado

- Importación masiva de usuarios (y cualquier otra tabla) funciona hasta el límite de la hoja de Sheets sin rate-limit errors.
- Auditoría limpia: 1 evento por importación, no N eventos.
