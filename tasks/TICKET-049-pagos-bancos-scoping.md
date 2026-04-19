# TICKET-049: Scoping de bancos por propietario en Pagos

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~3h
> **Prioridad**: P1 — Funcionalidad operativa crítica (no deben verse bancos de terceros)

---

## Problema

En `/pagos`, el `<select>` de banco muestra **todos los bancos del sistema** a cualquier usuario logueado. Según el requerimiento:

- Un **agente** logueado debe ver sólo los bancos cuyo `propietario_id` es su `user.id`.
- Un **admin** logueado, por defecto, ve los bancos de su propio agente. Pero tiene la opción de registrar un pago en nombre de otro agente (si el agente olvidó o cometió error), y al elegir ese agente, el combo de banco debe cambiar a los del agente seleccionado.

---

## Solución

### Backend

1. **Nuevo endpoint**: `GET /api/bancos/scoped?agente_id=<id>`
   - Auth requerida.
   - Si el caller es `agent`: ignora `agente_id` del query y siempre devuelve bancos con `propietario_id = caller.id`.
   - Si el caller es `admin`: sin `agente_id` devuelve bancos del admin logueado; con `agente_id` devuelve los bancos del agente indicado.
2. **Pagos POST**: al crear un pago, validar que `banco_id` pertenezca al `propietario_id` del agente objetivo del pago:
   - Si caller es `agent`: agente del pago = caller.id; banco debe ser suyo.
   - Si caller es `admin`: el body incluye `agente_id` (el agente dueño del pago); banco debe pertenecer a ese agente.
   - Violación → `403 ForbiddenError` (no warning — aquí sí debe ser bloqueante por integridad).
3. **Pagos PUT (editar)**: mismo check al editar (admin).

### Frontend (`/pagos`)

1. Al cargar la página:
   - Si `user.role === 'agent'`: llamar `GET /api/bancos/scoped`. El combo banco se llena con esos bancos. Campo "agente" del formulario queda fijo a `user.id`/`user.nombre` (readonly).
   - Si `user.role === 'admin'`:
     - Mostrar combo adicional: "Registrar a nombre de…" (lista de agentes activos).
     - Valor inicial: el propio admin.
     - Al cambiar el agente seleccionado → recargar bancos vía `GET /api/bancos/scoped?agente_id=<id>` y resetear el combo banco.
2. La tabla de pagos y los filtros siguen respetando los permisos ya existentes (agente sólo ve sus propios pagos, admin ve todos).
3. Editar pago (admin): al abrir el modal de edición, el combo banco se filtra por el `propietario_id` del agente del pago.

---

## Archivos

- `backend/routes/bancos.routes.js`
- `backend/controllers/bancos.controller.js`
- `backend/services/bancos.service.js` (helper `getScopedBancos`)
- `backend/services/pagos.service.js` (check de ownership en create/update)
- `backend/controllers/pagos.controller.js`
- `backend/tests/*.test.js` (tests nuevos de scoping)
- `frontend/src/lib/api.ts`
- `frontend/src/app/pagos/page.tsx`

## Dependencias

- **Requiere TICKET-047** (`user.id` disponible en sesión, agentes con rol).
- **Requiere TICKET-048** (`banco_id` como FK) para que el check de ownership sea inequívoco.

## Criterios de Aceptación

- [ ] Agente ve sólo sus bancos en el combo de Pagos.
- [ ] Admin ve sus bancos por defecto; puede cambiar a otro agente y ver los bancos de ese agente.
- [ ] El backend rechaza con 403 un `POST /api/pagos` cuyo `banco_id` no pertenece al propietario objetivo.
- [ ] La tabla y los filtros no muestran pagos cruzados entre agentes (agente sólo ve los propios).
- [ ] Editar pago (admin) respeta el scoping del agente dueño del pago.
- [ ] Tests cubren: agente cross-banco, admin impersonando agente, edición cruzada.

## Definición de Terminado

- Ningún agente ve o puede registrar contra bancos ajenos.
- Admin tiene flujo claro y auditado para registrar pagos en nombre de otro agente.
