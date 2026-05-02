# TICKET-092 — Frontend: UX anti-duplicados al registrar pago

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2.5h
> **Dependencias**: TICKET-091 (backend ya devuelve 409 con `code: 'DUPLICATE_PAGO'` y soporta header `X-Confirm-Duplicate`)

---

## Contexto

Tras TICKET-091 el backend rechaza pagos duplicados con HTTP 409. La UI debe interceptar ese error y darle al usuario una salida clara: cancelar el registro o confirmar que sí desea registrar el pago a pesar del aviso. Adicionalmente, en la tabla "Últimos pagos" se mostrará un badge sutil "posible duplicado" para que el admin pueda detectar fácilmente filas que parezcan repetidas y eliminar una (TICKET-086).

## Alcance

### 1. Cliente API — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- Tipar el error de duplicado:
  ```ts
  export interface DuplicatePagoErrorBody {
    code: 'DUPLICATE_PAGO';
    message: string;
    existing: {
      id: string;
      usuario: string;
      monto: number;
      banco_id: string;
      fecha_comprobante: string;
      fecha_registro: string;
    };
  }
  export class DuplicatePagoError extends Error {
    constructor(public body: DuplicatePagoErrorBody) {
      super(body.message);
      this.name = 'DuplicatePagoError';
    }
  }
  ```
- En `createPago(payload, opts?)`:
  - Aceptar opcional `opts?: { confirmDuplicate?: boolean }`.
  - Si `opts.confirmDuplicate` es `true`, añadir header `X-Confirm-Duplicate: true`.
  - Si la respuesta es 409 con `body.code === 'DUPLICATE_PAGO'`, lanzar `DuplicatePagoError(body)`.
  - Resto de errores → flujo actual.

### 2. Form de registro — [frontend/src/app/pagos/page.tsx](../frontend/src/app/pagos/page.tsx)

- En `handleSubmit` (alrededor de L613–662 — buscar la llamada a `createPago`):
  - Envolver la llamada en `try/catch` específico para `DuplicatePagoError`.
  - Cuando se captura, abrir un modal nuevo `DuplicateConfirmModal` con:
    - Título: "Posible pago duplicado"
    - Cuerpo: "Detectamos un pago con los mismos datos registrado el `<fecha_registro formateada>` (id `<existing.id>`)."
    - Resumen de los datos coincidentes: usuario, monto, banco, fecha comprobante.
    - CTAs:
      - **Cancelar registro** (gris, primaria) — cierra el modal, no inserta nada.
      - **Registrar de todas formas** (rojo, secundaria) — vuelve a llamar a `createPago(payload, { confirmDuplicate: true })`.
- Reset adecuado del form en cada salida (cancel/confirm).

### 3. Indicador "posible duplicado" en Últimos pagos

- En el listado actual de pagos:
  - Calcular en cliente, al renderizar la tabla, una **firma** por fila: `${usuario}|${monto}|${banco_id}|${fecha_comprobante}`.
  - Marcar con un pequeño badge/tag amarillo "posible duplicado" toda fila cuya firma se repita en otra fila visible (más de 1 ocurrencia).
  - Tooltip del badge: "Existen otros pagos con la misma combinación de usuario, monto, banco y fecha. Verifica si alguno debe eliminarse."
- Mantener UX simple: el badge no bloquea ninguna acción; solo informa.

### 4. Componentes reutilizables

- Considerar separar `DuplicateConfirmModal` en `frontend/src/components/` si el patrón se va a usar después; para una primera implementación inline en `pagos/page.tsx` es aceptable.
- Reutilizar `AlertBanner` para mensajes de éxito/error del flujo: tras "Registrar de todas formas" exitoso, mostrar `AlertBanner` warning: "Pago registrado a pesar de la alerta de duplicado.".

### 5. Tests

- Test del helper `createPago` cuando recibe 409 → lanza `DuplicatePagoError` con `body` correcto.
- Test del flujo de UI con un mock que simule 409 + reintento con confirmación.

## Archivos a modificar

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — `DuplicatePagoError`, `createPago(opts)`.
- [frontend/src/app/pagos/page.tsx](../frontend/src/app/pagos/page.tsx) — modal de confirmación, badge "posible duplicado".
- (Opcional) [frontend/src/components/DuplicateConfirmModal.tsx](../frontend/src/components/) — si se separa.
- Tests asociados.

## Criterios de aceptación

- [ ] Al intentar registrar un pago que el backend marca como duplicado (409), aparece un modal con los datos del pago existente y dos CTAs.
- [ ] "Cancelar registro" cierra el modal y no inserta nada (verificar en backend que no llegó el segundo POST sin header).
- [ ] "Registrar de todas formas" reenvía con `X-Confirm-Duplicate: true` y, en éxito, cierra el modal, agrega la fila a "Últimos pagos" y muestra `AlertBanner` warning.
- [ ] En "Últimos pagos", filas con la misma firma muestran el badge "posible duplicado" y su tooltip.
- [ ] Sin duplicado, el form se comporta exactamente igual que antes (no hay regresión).
- [ ] `npm run typecheck` y `npm run lint` pasan.

## Notas

- El badge "posible duplicado" en la tabla se calcula en cliente con los datos visibles (no requiere endpoint nuevo). Si se aplica paginación, el badge sólo refleja duplicados en la página actual; aceptable como heurística.
- Mantener accesibilidad: el modal debe atrapar foco, ESC cierra (= cancelar registro), botón primario marcado correctamente con `aria`.
- No tocar el formulario de edición; el bloqueo anti-duplicado es solo para `create`.
- Si TICKET-090 ya cambió cómo se muestran errores de red, asegurar que el 409 (que **no** es error de red) no se silencie por ese flujo.
