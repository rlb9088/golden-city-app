# TICKET-040: Edición de registros en Configuración (CRUD incompleto)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 7 - Bugfix post-UAT
> **Esfuerzo**: ~3h
> **Prioridad**: P1 — Bloqueo operativo (obliga a eliminar y recrear para corregir un dato)

---

## Problema

La página de Configuración permite agregar y eliminar registros, pero **no editarlos**. No existe botón de edición en las filas ni endpoint `PUT` en el backend para las tablas de config.

Cuando un operador necesita corregir un dato (nombre de agente, número de cuenta, etc.), debe:
1. Eliminar el registro.
2. Volver a crearlo con el valor correcto.

Esto genera entradas de auditoría innecesarias y riesgo de pérdida de datos.

---

## Causa Raíz

- **Frontend** — `frontend/src/app/configuracion/page.tsx:260-288`: solo renderiza el botón 🗑️ (eliminar). Sin handler ni UI de edición.
- **Backend** — `backend/routes/config.routes.js`: expone solo `GET`, `POST` (crear), y `DELETE`. No hay ruta `PUT`.
- **Backend** — `backend/controllers/config.controller.js`: no tiene handler `updateInTable`.
- **Backend** — `backend/services/config.service.js`: no tiene función `updateInTable`.

Afecta todas las tablas: `agentes`, `bancos`, `cajas`, `tipos_pago`, `categorias`, `usuarios`.

---

## Acciones

### Backend

1. Agregar `PUT /api/config/:table/:id` en `backend/routes/config.routes.js` con `requireAdmin`.
2. Implementar `config.controller.updateInTable(req, res)`:
   - Extrae `table`, `id` de params y el payload del body.
   - Delega a `config.service.updateInTable()`.
3. Implementar `config.service.updateInTable(table, id, patch, user)`:
   - Busca la fila por `id` en la tabla real (no seed).
   - Llama a `repo.update(sheetName, rowIndex, updatedRow)`.
   - Registra auditoría: `action='update'`, `entity=config_<tabla>`, incluyendo diff `{ before, after }`.
4. Manejar el caso de que el ID no exista → `NotFoundError`.

### Frontend

1. Agregar botón ✏️ en cada fila de la tabla (junto al 🗑️ existente).
2. Al hacer clic: activar modo inline de edición (o modal simple) con los campos editables pre-rellenos.
3. Al confirmar: llamar `PUT /api/config/:table/:id` con el payload.
4. Al éxito: recargar la tabla y mostrar AlertBanner `success`.
5. Al cancelar: descartar cambios sin llamada al backend.

---

## Archivos

- `backend/routes/config.routes.js` — agregar ruta `PUT /:table/:id`
- `backend/controllers/config.controller.js` — agregar `updateInTable`
- `backend/services/config.service.js` — agregar `updateInTable(table, id, patch, user)`
- `frontend/src/app/configuracion/page.tsx` — botón editar + formulario inline/modal

## Dependencias

- Requiere que `repo.update()` funcione correctamente (ya implementado para pagos/ingresos/gastos).

## Criterios de Aceptación

- [ ] Cada fila de cada tabla de config tiene botón de edición.
- [ ] Al editar y guardar, el cambio se refleja en Google Sheets.
- [ ] Funciona en modo in-memory.
- [ ] Se registra auditoría con `action='update'` incluyendo diff `{ before, after }`.
- [ ] ID no encontrado → respuesta 404 clara.
- [ ] No se rompe el flujo de seed data.
- [ ] Al cancelar la edición, no se realiza ninguna llamada al backend.

## Definición de Terminado

- CRUD completo en configuración (crear, leer, editar, eliminar) funcional en Sheets e in-memory.
- Auditoría registrada para toda mutación.
