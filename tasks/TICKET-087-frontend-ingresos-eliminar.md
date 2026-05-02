# TICKET-087 — Frontend Ingresos: reemplazar "Anular" por "Eliminar"

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: TICKET-085 (backend hace hard delete sobre `/api/ingresos/:id`)

---

## Contexto

Espejando TICKET-086 sobre Pagos, la tabla de Ingresos también muestra "Anular" como acción. Para consistencia con el cambio de modelo (hard delete en backend, TICKET-085) la UI de ingresos debe reemplazar **Anular** por **Eliminar**, sin modal de motivo, sin badge "Anulado" y sin estilos de fila anulada.

## Alcance

### 1. Página — [frontend/src/app/ingresos/page.tsx](../frontend/src/app/ingresos/page.tsx)

- Reemplazar botón "Anular" → "Eliminar" (rojo).
- Eliminar helper análogo a `isIngresoAnulado` (si existe), badge "Anulado", clase CSS de fila anulada y filtros por estado.
- Reemplazar el modal de anulación (con textarea de motivo) por un modal de confirmación simple:
  - Título: "Eliminar ingreso"
  - Cuerpo: "¿Eliminar este ingreso? Esta acción no se puede deshacer."
  - CTAs: "Cancelar" / "Eliminar" (rojo).
- Reemplazar el handler `handleCancelIngreso` por `handleDeleteIngreso(id)` que llama a `deleteIngreso(id)` y, en éxito, elimina la fila localmente y muestra `AlertBanner` verde "Ingreso eliminado correctamente.".

### 2. Cliente API — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- Renombrar `cancelIngreso(id, motivo)` → `deleteIngreso(id)` (mismo patrón que `deletePago` en TICKET-086).
- El body deja de enviar `{ motivo }`.

### 3. Tipos / consumers

- Confirmar que ningún componente filtra ingresos por `estado === 'anulado'` para renderizado. Mantener `estado?` opcional en el tipo para no romper lectura de filas históricas.

## Archivos a modificar

- [frontend/src/app/ingresos/page.tsx](../frontend/src/app/ingresos/page.tsx)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- CSS asociado a la fila anulada (buscar `--anulado` en `frontend/src/`).
- Cualquier test/snapshot que referencie "Anular" o `cancelIngreso`.

## Criterios de aceptación

- [ ] Tabla de ingresos muestra solo botones **Editar** y **Eliminar** (rojo). No hay "Anular".
- [ ] Click en "Eliminar" abre modal de confirmación simple (sin campo motivo) y, al confirmar, la fila desaparece y se muestra `AlertBanner` verde.
- [ ] No quedan referencias a `cancelIngreso` ni helpers/clases de "anulado" para ingresos.
- [ ] Tras eliminar un ingreso, el dashboard de balance refleja la baja del monto (verificar manualmente con un caso real).
- [ ] `npm run typecheck` y `npm run lint` pasan.

## Notas

- Reutilizar el componente de confirmación creado/usado en TICKET-086 si conviene parametrizar título/cuerpo.
- No tocar el formulario de registro/edición de ingresos.
- Si la página de ingresos hoy tiene una columna "Estado" en la tabla, eliminarla.
