# TICKET-047: Unificar `config_agentes` como única fuente de identidad (auth + operación)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~5h
> **Prioridad**: P0 — Prerequisito de TICKET-049 y TICKET-050

---

## Problema

Hoy existen **dos fuentes de identidad paralelas y desconectadas**:

- `config_auth_users` (id, username, password_hash, role, nombre) — usuarios de login.
- `config_agentes` (id, nombre) — agentes operativos a los que se asocian pagos, bancos, ingresos.

Nunca se relacionan. El "agente" que aparece en un pago es sólo un texto libre; el usuario logueado no está vinculado a un registro de agente. Esto impide:

- Filtrar datos por propietario (bancos de Paolo vs bancos de Juan).
- Saber qué bancos pertenecen al admin logueado.
- Administrar usuarios y roles desde un solo lugar.

El requerimiento del negocio es: **las personas registradas en `configuracion/agentes` son los usuarios del sistema**. Cada agente debe tener credenciales administrables y un rol (admin | agent). El admin ve todo; el agente sólo ve Pagos y su Balance.

---

## Solución

Unificar ambas tablas: `config_agentes` pasa a ser la única tabla de identidad/agente.

### Schema nuevo de `config_agentes`

| Columna         | Tipo   | Notas                                            |
|-----------------|--------|--------------------------------------------------|
| `id`            | string | PK (e.g. `AG-123`)                               |
| `nombre`        | string | Visible en UI / asociado a pagos                 |
| `username`      | string | Único, lowercase, requerido                      |
| `password_hash` | string | bcrypt 10 rounds, requerido                      |
| `role`          | enum   | `admin` \| `agent`                                |
| `activo`        | bool   | `true`/`false` — inactivo bloquea login          |

> `config_auth_users` queda **deprecada** (ver TICKET-054 para migración de datos).

---

## Acciones

### Backend

1. **Schema**: actualizar `backend/config/sheetsSchema.js` — headers de `config_agentes` extendidos (ver tabla arriba).
2. **Script de setup**: `backend/scripts/setupSheets.js` crea la hoja con los nuevos headers si no existe.
3. **`config.service.js`**:
   - `TABLES.agentes.headers` actualizado.
   - `addToTable('agentes', …)` y `updateInTable('agentes', …)` aceptan `username`, `password` (plaintext → hashea en service antes de persistir) y `role`, `activo`.
   - `getFullConfig()` expone `agentes_full` sin `password_hash` al frontend.
   - Validación: `username` único; `role ∈ {admin, agent}`; no permitir desactivar al único admin activo.
4. **`auth.service.js`**:
   - Eliminar lectura de `config_auth_users`. Leer identidad de `config_agentes`.
   - `login(username, password)` busca agente por `username`, valida `activo=true`, compara `password_hash`.
   - `buildSession(user)` incluye `userId = agente.id`, `role`, `nombre`, `username`.
   - Bootstrap: si `config_agentes` está vacía tras `ensureAuthSheetSeed()`, crear un agente admin con credenciales de `AUTH_BOOTSTRAP_ADMIN_*` (y fallar si falta en prod).
5. **Endpoints**:
   - `PUT /api/config/agentes/:id/password` (admin-only): cambio de contraseña con hash en backend.
   - `PUT /api/config/agentes/:id` (admin-only, ya existe): acepta cambios de `role`, `activo`, `username`, `nombre`.
6. **Auditoría**: cada alta/edición/cambio de password/toggle activo se registra en `audit`.
7. **Middleware `requireAdmin`**: sigue validando `req.user.role === 'admin'` (sin cambios).
8. **Tests**:
   - Actualizar `backend/tests/auth-gate-routes.test.js` y añadir tests de login contra `config_agentes`.
   - Tests de CRUD agentes con campos nuevos (crear, rotar password, toggle activo, no eliminar último admin).

### Frontend

1. **`/configuracion/agentes`**:
   - Formulario extendido: nombre, username, password (solo al crear o al cambiar), rol (select admin/agent), activo (toggle).
   - Acción "Cambiar contraseña" (modal) por fila.
   - Acción "Activar/Desactivar" por fila.
   - Validación client-side: username único local antes de enviar.
2. **`lib/auth-context.tsx`**: `user.id` (agente) disponible en el contexto para que las pantallas puedan filtrar por propietario (habilitador de TICKET-049/050).
3. **Sidebar**: rol mostrado sigue leyéndose de `user.role` — sin cambios funcionales.

---

## Archivos

- `backend/config/sheetsSchema.js`
- `backend/services/auth.service.js`
- `backend/services/config.service.js`
- `backend/controllers/config.controller.js`
- `backend/routes/config.routes.js`
- `backend/scripts/setupSheets.js`
- `backend/tests/auth-gate-routes.test.js` (y test nuevo)
- `frontend/src/app/configuracion/page.tsx`
- `frontend/src/app/configuracion/configuracion.css`
- `frontend/src/lib/auth-context.tsx`
- `frontend/src/lib/api.ts`

## Dependencias

- Debe ejecutarse **antes** de TICKET-049 y TICKET-050.
- La migración de datos históricos de `config_auth_users` la cubre **TICKET-054** (puede ejecutarse antes, durante o inmediatamente después).

## Criterios de Aceptación

- [ ] `config_agentes` tiene headers `id, nombre, username, password_hash, role, activo`.
- [ ] Login funciona contra `config_agentes` (no contra `config_auth_users`).
- [ ] Admin puede crear/editar/desactivar agentes y cambiar su password desde `/configuracion`.
- [ ] No se puede desactivar/eliminar al único admin activo.
- [ ] `auth-context` expone `user.id` (id del agente).
- [ ] Todas las pruebas de auth existentes siguen pasando.
- [ ] Bootstrap produce un admin válido en entorno limpio.

## Definición de Terminado

- Una sola tabla de identidad (`config_agentes`) activa; `config_auth_users` deprecada y no usada por runtime.
- Admin puede administrar agentes y credenciales desde UI.
- `user.id` disponible en frontend para filtrados por propietario en tickets posteriores.
