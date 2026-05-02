# TICKET-088 — Frontend Gastos: reemplazar "Anular" por "Eliminar"

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: TICKET-085 (backend hace hard delete sobre `/api/gastos/:id`)

---

## Contexto

Espejando TICKET-086 (Pagos) y TICKET-087 (Ingresos), la tabla de Gastos también debe reemplazar **Anular** por **Eliminar**, sin modal de motivo, sin badge "Anulado" y sin estilos de fila anulada. Es la última de las tres pantallas afectadas por el cambio de modelo en TICKET-085.

## Alcance

### 1. Página — [frontend/src/app/gastos/page.tsx](../frontend/src/app/gastos/page.tsx)

- Reemplazar botón "Anular" → "Eliminar" (rojo).
- Eliminar helper `isGastoAnulado` (si existe), badge "Anulado", clase CSS de fila anulada y filtros por estado.
- Reemplazar el modal de anulación (con textarea de motivo) por un modal de confirmación simple:
  - Título: "Eliminar gasto"
  - Cuerpo: "¿Eliminar este gasto? Esta acción no se puede deshacer."
  - CTAs: "Cancelar" / "Eliminar" (rojo).
- Reemplazar el handler `handleCancelGasto` por `handleDeleteGasto(id)` que llama a `deleteGasto(id)` y, en éxito, elimina la fila localmente y muestra `AlertBanner` verde "Gasto eliminado correctamente.".

### 2. Cliente API — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- Renombrar `cancelGasto(id, motivo)` → `deleteGasto(id)`:
  ```ts
  export async function deleteGasto(id: string): Promise<void> {
    await request(`/api/gastos/${id}`, { method: 'DELETE' });
  }
  ```
- El body deja de enviar `{ motivo }`.

### 3. Tipos / consumers

- Mantener `estado?` opcional en el tipo `Gasto` para no romper lectura de filas históricas.
- Verificar que ningún componente filtra gastos por `estado === 'anulado'` para renderizado.

## Archivos a modificar

- [frontend/src/app/gastos/page.tsx](../frontend/src/app/gastos/page.tsx)
- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- CSS asociado a la fila anulada (buscar `--anulado` en `frontend/src/`).
- Cualquier test/snapshot que referencie "Anular" o `cancelGasto`.

## Criterios de aceptación

- [ ] Tabla de gastos muestra solo botones **Editar** y **Eliminar** (rojo). No hay "Anular".
- [ ] Click en "Eliminar" abre modal de confirmación simple (sin campo motivo) y, al confirmar, la fila desaparece y se muestra `AlertBanner` verde.
- [ ] No quedan referencias a `cancelGasto` ni helpers/clases de "anulado" para gastos.
- [ ] Tras eliminar un gasto, el dashboard de balance refleja la baja del monto (verificar manualmente).
- [ ] `npm run typecheck` y `npm run lint` pasan.

## Notas

- Reutilizar el componente de confirmación creado en TICKET-086 si está parametrizado.
- No tocar el formulario de registro/edición de gastos.
- Si existe una columna "Estado" en la tabla, eliminarla.
- Tras este ticket, ninguna pantalla del producto debería mostrar el verbo "Anular" en pagos/ingresos/gastos.
