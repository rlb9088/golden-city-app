# TICKET-041: Bancos — Propietario debe ser FK a `config_agentes`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 7 - Bugfix post-UAT
> **Esfuerzo**: ~2h
> **Prioridad**: P1 — Integridad de datos (un banco sin agente válido rompe el balance por agente)

---

## Problema

El campo "propietario/agrupación" en Configuración → Bancos acepta opciones **hardcodeadas** ("Negocio (Global)", "Agente 1", "Agente 2", "Agente 3") que no corresponden a los agentes reales registrados. El backend no valida que el propietario exista en `config_agentes`.

Consecuencias:
- Un banco puede quedar asignado a un agente que no existe.
- El cálculo de balance por agente puede omitir o duplicar saldos.
- Al renombrar un agente, los bancos no se actualizan.

---

## Causa Raíz

- **Frontend** — `frontend/src/app/configuracion/page.tsx:174-195`: `<select>` con opciones estáticas hardcodeadas.
- **Backend** — `backend/schemas/bancos.schema.js:1-9`: no valida el campo `propietario`; el schema solo contempla `banco`, `saldo` y `fecha`.
- **Backend** — no hay validación referencial para bancos en `config.service.js`.

---

## Decisiones tomadas

- **Validación**: **bloqueante** — si el agente no existe, el backend responde `400`.
- **Almacenamiento**: guardar `propietario_id` (ID del agente), no el nombre, para evitar roturas al renombrar agentes.

---

## Acciones

### Backend

1. Actualizar `backend/schemas/bancos.schema.js`:
   - Añadir campo `propietario_id` como requerido (`z.string().min(1)`).
   - Eliminar o dejar el campo `propietario` (nombre) como opcional para compatibilidad transitoria.
2. En `backend/services/bancos.service.js` (o en el controller, antes de persistir):
   - Consultar `config_agentes` por el `propietario_id` recibido.
   - Si no existe → lanzar `BadRequestError('El agente especificado no existe en configuración')`.
3. Actualizar `backend/config/sheetsSchema.js` (o equivalente):
   - Añadir columna `propietario_id` a los headers de la hoja `config_bancos`.
4. Registrar en auditoría `propietario_id` al crear/editar un banco.

### Frontend

1. Al cargar la sección Bancos, obtener la lista de agentes desde la config ya disponible (el endpoint `GET /api/config` público ya retorna agentes).
2. Reemplazar el `<select>` hardcodeado por uno poblado dinámicamente:
   - `option.value = agente.id`
   - `option.label = agente.nombre`
3. Al mostrar la tabla de bancos, resolver `propietario_id → nombre` buscando en la lista de agentes.
4. Si un banco existente tiene `propietario_id` no resuelto, mostrar "Agente no encontrado" en la celda.

### Migración de datos existentes

- Los bancos en Sheets que tengan texto en `propietario` (ej. "Agente 1") deben corregirse manualmente por el operador usando la nueva función de edición (TICKET-040).
- Documentar en el release note de este ticket el paso de migración manual.

---

## Archivos

- `backend/schemas/bancos.schema.js` — añadir `propietario_id`
- `backend/services/bancos.service.js` — validación bloqueante contra `config_agentes`
- `backend/config/sheetsSchema.js` — columna `propietario_id` en `config_bancos`
- `frontend/src/app/configuracion/page.tsx` — dropdown dinámico de agentes en form de bancos

## Dependencias

- Depende de que `GET /api/config` devuelva agentes con `id` y `nombre` (ya lo hace).
- La migración de datos existentes se facilita si TICKET-040 ya está implementado (edición de registros).

## Criterios de Aceptación

- [ ] El dropdown de propietario muestra solo agentes registrados en config_agentes.
- [ ] El backend rechaza con `400` si `propietario_id` no existe en `config_agentes`.
- [ ] La tabla de bancos muestra el nombre del agente (resuelto desde su ID).
- [ ] Bancos existentes sin `propietario_id` válido muestran "Agente no encontrado" (sin crash).
- [ ] La nueva columna `propietario_id` aparece en la hoja `config_bancos` de Sheets.
- [ ] Se registra auditoría con `propietario_id` al crear un banco.

## Definición de Terminado

- Ningún banco puede crearse sin un agente válido del sistema.
- Integridad referencial bancos ↔ agentes garantizada a nivel de backend.
- Datos visibles y correctos en la tabla de configuración.

## Release note

- Los bancos históricos con propietario textual quedaron marcados para migración manual mediante la edición del registro, ya que ahora el sistema persiste `propietario_id` contra `config_agentes`.
