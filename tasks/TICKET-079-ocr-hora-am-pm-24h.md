# TICKET-079 — OCR: interpretar AM/PM y devolver hora en formato 24h

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: ninguna

---

## Contexto

El servicio OCR en [backend/services/ocr.service.js](../backend/services/ocr.service.js) detecta correctamente el monto, la fecha y la hora de los recibos. Sin embargo, la función `extractFinancialData()` (líneas 92-152) captura el indicador AM/PM pero no lo interpreta: si el recibo dice `2:30 PM`, el campo `fecha` devuelto es `"2024-04-15 2:30 PM"` sin conversión a 24h, lo que genera confusión al rellenar el formulario de pagos.

Los regex en las líneas 115-116 ya capturan los caracteres `[aAp]m` como grupo 4, pero las líneas 124-125 y 136-138 simplemente concatenan ese texto crudo al string de fecha sin interpretarlo.

## Alcance

1. **Refinar el regex de hora** en las líneas 115 y 116 de [backend/services/ocr.service.js](../backend/services/ocr.service.js):
   - Separar la captura de `hh:mm` de la captura de `am|pm` en grupos distintos.
   - Tolerar variantes: `AM`, `PM`, `a.m.`, `p.m.`, `a m`, `p m` (con y sin puntos/espacios intermedios).

2. **Nueva función `normalizeTime(hhmm, meridiem)`** en el mismo archivo:
   - `meridiem = 'pm'` y `hour < 12` → `hour + 12`
   - `meridiem = 'am'` y `hour === 12` → `00`
   - Sin meridiem y `hour > 12` → conservar como 24h
   - Sin meridiem y `hour ≤ 12` → conservar (ambiguo, sin transformar)
   - Devuelve string `HH:mm` con cero a la izquierda.

3. **Actualizar el armado del string fecha** (líneas 124-125 y 136-138): usar `normalizeTime()` y construir el resultado como `YYYY-MM-DD HH:mm` sin texto suelto de AM/PM.

4. **Tests unitarios** — crear o extender `backend/tests/ocr.service.test.js` (si no existe, crear el archivo) con los siguientes casos:
   | Entrada de tiempo | Meridiem | Resultado esperado |
   |---|---|---|
   | `2:30` | `PM` | `14:30` |
   | `12:15` | `AM` | `00:15` |
   | `11:59` | `PM` | `23:59` |
   | `9:00` | sin sufijo | `09:00` |
   | `13:45` | sin sufijo | `13:45` |
   | `12:00` | `PM` | `12:00` |
   | `12:00` | `AM` | `00:00` |
   - Incluir un caso de texto completo: `"15 de Abril 2026, 3:20 p.m."` → fecha `"2026-04-15 15:20"`.

5. **Verificar frontend** — confirmar que [frontend/src/components/ReceiptUploader.tsx:94](../frontend/src/components/ReceiptUploader.tsx) y [frontend/src/app/pagos/page.tsx:1072](../frontend/src/app/pagos/page.tsx) no requieren cambios: si muestran el string crudo de `fecha`, el nuevo formato `YYYY-MM-DD HH:mm` será suficiente.

## Archivos a modificar

- [backend/services/ocr.service.js](../backend/services/ocr.service.js) — `extractFinancialData()`, nuevos regex, función `normalizeTime`.
- [backend/tests/ocr.service.test.js](../backend/tests/) — tests unitarios de los casos indicados.

## Criterios de aceptación

- [ ] Tests unitarios pasan para todos los casos de la tabla.
- [ ] Prueba manual: subir un recibo que diga `2:30 PM` → el formulario de pagos recibe `14:30` en el campo hora.
- [ ] Prueba manual: recibo sin AM/PM con hora en 24h (`13:00`) → no se modifica.
- [ ] No hay regresión en la detección de monto ni de fecha.

## Notas

- Mantener el campo devuelto como `fecha` (string); no cambiar la firma de `extractFinancialData()`.
- Si el recibo no tiene hora, el campo sigue siendo solo `YYYY-MM-DD` (sin tiempo).
