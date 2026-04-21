# TICKET-077 — Fix: calendario nativo en Balance (desktop)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P1
> **Esfuerzo estimado**: ~0.5h
> **Dependencias**: ninguna

---

## Contexto

En la sección de Balance, el input de fecha en desktop obliga a digitar la fecha manualmente sin mostrar ningún calendario. En móvil sí aparece el picker nativo del navegador. La causa es `appearance: none` en [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) (línea 47), que elimina el ícono y el comportamiento nativo del calendar picker en desktop; en móvil el navegador lo sobreescribe con su propio overlay.

## Alcance

1. En [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) (selector `.balance-date-field input`, líneas 46-54):
   - Quitar la línea `appearance: none;`.
   - Estilizar el indicador nativo para que sea coherente con el tema oscuro:
     ```css
     .balance-date-field input::-webkit-calendar-picker-indicator {
       filter: invert(1) opacity(0.7);
       cursor: pointer;
     }
     ```

2. Si `showPicker()` no está disponible en todos los browsers objetivo, añadir en [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) (líneas 327-333) y [frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx) (líneas 212-218) un handler de click que llame a `e.currentTarget.showPicker?.()` para forzar la apertura en desktop Chrome/Edge cuando el usuario hace clic en el contenedor del campo.

3. Verificar que las reglas de `:focus` existentes (líneas 56-60 de `balance.css`) siguen funcionando.

## Archivos a modificar

- [frontend/src/app/balance/balance.css](../frontend/src/app/balance/balance.css) — eliminar `appearance: none`, añadir estilo del indicador.
- [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) — (si aplica) click handler.
- [frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx) — (si aplica) click handler.

## Criterios de aceptación

- [ ] En Chrome/Edge desktop al hacer click en el input de fecha aparece el calendario nativo.
- [ ] El ícono del calendario es visible sobre fondo oscuro.
- [ ] En Chrome Android y Safari iOS sigue funcionando el picker nativo (sin regresión).
- [ ] El estado `:focus` sigue mostrando el borde dorado del tema.

## Notas

- No introducir librerías de terceros de datepicker; el input nativo `type="date"` es suficiente.
- El cambio afecta tanto la vista admin como la vista agente (MiCajaView), porque ambas tienen el mismo input con la misma clase CSS.
