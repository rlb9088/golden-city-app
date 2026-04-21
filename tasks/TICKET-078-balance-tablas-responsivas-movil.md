# TICKET-078 — Balance: tablas responsivas en móvil (nombre + valor sin scroll horizontal)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2.5h
> **Dependencias**: ninguna

---

## Contexto

En dispositivos móviles, las tablas de la sección Balance (tanto admin como agente) requieren mucho scroll horizontal para ver el valor junto al nombre de cada fila. La causa es `.table { min-width: 640px }` en [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) (líneas 288-289), que mantiene todas las tablas en su ancho completo independientemente del viewport. El wrapper `.table-container` tiene `overflow-x: auto` lo que habilita el scroll, pero el ideal es que nombre y valor aparezcan visibles juntos sin necesidad de desplazarse.

## Tablas afectadas

| ID tabla | Vista | Columnas actuales | Archivo |
|----------|-------|-------------------|---------|
| `#agent-balance-table` | Admin | Agente / Total / Detalle | [balance/page.tsx:412-446](../frontend/src/app/balance/page.tsx) |
| `#admin-banks-table` | Admin | Banco / Saldo | [balance/page.tsx:463-483](../frontend/src/app/balance/page.tsx) |
| `#expense-breakdown-table` | Admin | Categoria / Total / Detalle | [balance/page.tsx:500-532](../frontend/src/app/balance/page.tsx) |
| `#mi-caja-movement-table` | Agente | Concepto / Monto | [MiCajaView.tsx:259-293](../frontend/src/app/balance/MiCajaView.tsx) |
| `#mi-caja-banks-table` | Agente | Banco / Saldo | [MiCajaView.tsx:34-55](../frontend/src/app/balance/MiCajaView.tsx) |

## Alcance

### 1. CSS mobile (breakpoint ≤ 768px)

En [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) añadir bajo `@media (max-width: 768px)`:

- Eliminar el `min-width` de `.table` y `.balance-nested-table`.
- Para tablas de 2 columnas (`Banco/Saldo`, `Concepto/Monto`): `table-layout: fixed; width: 100%` con `word-break: break-word` en las celdas de nombre. La columna de valor queda alineada a la derecha con ancho fijo (`width: 40%`).

### 2. Columna "Detalle" colapsable en móvil

Para las tablas con 3 columnas (Agente/Categoría con columna Detalle):
- La columna `Detalle` se oculta del encabezado en móvil (`display: none` en el `<th>` de esa columna).
- El contenido del detalle se mueve a una segunda fila (`<tr class="detail-row">`) debajo de la fila principal, visible dentro de un `<details><summary>Ver detalle</summary>...</details>`.
- En desktop no cambia nada: la columna Detalle sigue siendo la 3ª columna normal.

### 3. Ajustes de markup en page.tsx y MiCajaView.tsx

Solo los cambios de estructura mínima para soportar la segunda fila de detalle (si se opta por la fila colapsable). Aplicar la clase `detail-row` y el wrapper `<details>` en los puntos indicados.

## Archivos a modificar

- [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) — media queries, clases de responsive layout y `.detail-row`.
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) — markup de tablas con 3 columnas (detalle colapsable).
- [frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx) — markup de tablas (si aplica).

## Criterios de aceptación

- [ ] En viewport ≤ 768px (Chrome DevTools iPhone SE 375px y Android 412px), en las 5 tablas el nombre y el valor/total son visibles en la misma fila sin scroll horizontal.
- [ ] Las tablas de 3 columnas muestran el Detalle dentro de un toggle colapsable debajo de cada fila.
- [ ] En desktop (>768px) no hay ningún cambio visual ni funcional.
- [ ] QA manual en Chrome DevTools: emulación iPhone SE (375px), Pixel 5 (393px) y Galaxy S20 (412px).

## Notas

- No se tocan tablas fuera de la sección Balance.
- Preferir soluciones CSS puras sin JavaScript adicional para el layout de celdas.
- El elemento nativo `<details>/<summary>` no requiere JS y es accesible por teclado.
