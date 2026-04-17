# TICKET-031: Fix removeFromTable — no elimina de Google Sheets

> **Estado**: ✅ COMPLETADO
> **Sprint**: 3 - Hardening
> **Esfuerzo**: ~2h
> **Prioridad**: P1 — Bug funcional
> **Completado en**: 2026-04-16

---

## Problema

`config.service.js::removeFromTable()` solo filtra el array `SEED_DATA` en memoria. **No elimina la fila de Google Sheets** y **no registra auditoría**.

En modo producción (Sheets), al hacer clic en "Eliminar" en la página de configuración:
1. La UI muestra que se eliminó (estado local se actualiza)
2. Pero la fila permanece en Google Sheets
3. Al recargar la página, el item reaparece
4. No queda registro de auditoría

## Acciones

### Backend
1. Implementar `deleteRow(sheetName, rowIndex)` en `sheetsRepository.js`
   - En modo Sheets: usar `spreadsheets.batchUpdate` con `deleteDimension`
   - En modo memory: splice del array
2. En `config.service.js::removeFromTable()`:
   - Buscar el item por ID en la tabla real (no solo seed)
   - Llamar a `repo.deleteRow()` con el `_rowIndex`
   - Registrar en auditoría: `audit.log('delete', 'config_<tabla>', user, { id, ...item })`
3. Manejar el caso de que el item esté en seed data vs en Sheets

## Archivos
- `backend/repositories/sheetsRepository.js` — agregar `deleteRow()`
- `backend/services/config.service.js` — reescribir `removeFromTable()`

## Dependencias
- Ninguna

## Criterios de Aceptación
- [ ] Eliminar un config item borra la fila de Google Sheets
- [ ] Eliminar un config item funciona en modo in-memory
- [ ] Se registra auditoría con action='delete'
- [ ] El item no reaparece al recargar la página
- [ ] No se rompe el seed data flow (tablas vacías siguen mostrando seed)

## Definición de Terminado
- CRUD de configuración completo y funcional en ambos modos
- Auditoría registrada para toda mutación (incluido delete)
