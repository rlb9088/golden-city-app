# TICKET-086 — Frontend Pagos: reemplazar "Anular" por "Eliminar" en Últimos pagos

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-085 (el backend ya hace hard delete y no exige `motivo`)

---

## Contexto

En la sección de pagos, la tabla "Últimos pagos" muestra los botones **Editar** y **Anular**. El negocio pide reemplazar **Anular** por **Eliminar** (borrado físico). Después de este ticket, "anular" deja de existir en la UI de pagos: solo quedan **Editar** y **Eliminar**, sin badge "Anulado", sin filas tachadas/grises y sin modal de motivo.

## Alcance

### 1. Página y tabla — [frontend/src/app/pagos/page.tsx](../frontend/src/app/pagos/page.tsx)

- Botón en la fila (alrededor de L1099–1110):
  - Renombrar etiqueta "Anular" → "Eliminar".
  - Cambiar handler: ya no abre el modal de anulación con motivo. En su lugar abre un modal de confirmación simple (ver punto 2).
  - El botón "Editar" (L1091–1098) se mantiene tal cual.
- Eliminar:
  - Helper `isPagoAnulado(p)` (L52–54) y todos sus usos.
  - Clase CSS condicional `pago-row--anulado` (L1060) y la regla CSS asociada (en el archivo `.module.css` o globals si existe).
  - Badge "Anulado"/"Activo" en la fila (L1079–1081).
  - Cualquier filtro/orden por `estado` (si existe en la barra de filtros — TICKET-027).
- Estado y modal:
  - Eliminar `cancelTarget`, `cancelReason` (L162–163) y `openCancelModal()` (L424–427).
  - Eliminar el modal de anulación con textarea (L1261–1320).
  - Reemplazar por un modal simple `DeleteConfirmModal`:
    - Título: "Eliminar pago"
    - Cuerpo: "¿Eliminar este pago? Esta acción no se puede deshacer."
    - CTAs: "Cancelar" (gris) y "Eliminar" (rojo).
- Handler:
  - Reemplazar `handleCancelPago()` (L496–516) por `handleDeletePago(id)` que llama al nuevo `deletePago(id)` y, en éxito, elimina la fila de la lista local y muestra `AlertBanner` verde "Pago eliminado correctamente."
  - Si el backend devuelve error, mostrar `AlertBanner` rojo con `e.message`.

### 2. Cliente API — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- Renombrar `cancelPago(id, motivo)` (L520–524) → `deletePago(id)`:
  ```ts
  export async function deletePago(id: string): Promise<void> {
    await request(`/api/pagos/${id}`, { method: 'DELETE' });
  }
  ```
- Eliminar el body con `{ motivo }`.
- Buscar todas las llamadas a `cancelPago` en `frontend/` y reemplazar por `deletePago`.

### 3. Tipos / consumers

- Si el tipo `Pago` (en `lib/api.ts` o `types.ts`) declara `estado?: 'activo' | 'anulado'`, mantenerlo opcional para no romper la lectura de filas históricas (Sheets puede tener filas viejas con `estado='anulado'` que no se mostrarán como tales pero existen). No filtrar por estado en el cliente: el backend ya excluye anulados del listado activo.
- Verificar que ningún componente use `estado === 'anulado'` para renderizado.

## Archivos a modificar

- [frontend/src/app/pagos/page.tsx](../frontend/src/app/pagos/page.tsx)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- CSS asociado a `pago-row--anulado` (buscar en `.module.css` o `globals.css`).
- Cualquier test/snapshot que referencie "Anular", `cancelPago` o el modal de motivo.

## Criterios de aceptación

- [ ] La fila de "Últimos pagos" muestra dos botones: **Editar** y **Eliminar** (rojo). No hay botón "Anular".
- [ ] Click en "Eliminar" abre un modal con confirmación textual sin campo de motivo.
- [ ] Al confirmar, la fila desaparece del listado y aparece `AlertBanner` verde "Pago eliminado correctamente.".
- [ ] No queda en el bundle JS ninguna referencia a `cancelPago`, `isPagoAnulado`, `pago-row--anulado` ni al modal de anulación con motivo.
- [ ] El badge "Anulado" no aparece en ninguna fila.
- [ ] `npm run typecheck` y `npm run lint` (o equivalentes) pasan.

## Notas

- No tocar el formulario de registro/edición de pagos: la edición sigue funcionando igual (mismo botón "Editar", misma API `PUT /api/pagos/:id`).
- Confirmar que el modal de confirmación reutiliza un patrón existente si lo hay (buscar `Modal` en `frontend/src/components/`); si no, crear uno simple inline.
- Mantener accesibilidad: foco al abrir modal, ESC para cerrar, ENTER para confirmar.
