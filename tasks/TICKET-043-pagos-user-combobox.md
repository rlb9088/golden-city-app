# TICKET-043: Pagos — Autocomplete de usuario requiere mínimo 2 caracteres

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 7 - Bugfix post-UAT
> **Esfuerzo**: ~2h
> **Prioridad**: P2 — UX degradada con lista grande de usuarios

---

## Problema

En la sección Pagos, al hacer clic en el campo "Usuario" se despliega inmediatamente la lista completa de todos los usuarios cargados en configuración. Con 162+ usuarios, la lista es inusable: ocupa toda la pantalla y no hay forma de navegar rápido.

La ayuda contextual debe aparecer solo cuando el operador haya escrito al menos **2 caracteres**.

---

## Causa Raíz

- `frontend/src/app/pagos/page.tsx:498-523`: usa un `<datalist>` HTML nativo con **todas** las opciones renderizadas incondicionalmente.
- El elemento `<datalist>` no soporta un umbral mínimo de caracteres; el navegador muestra todas las opciones al primer clic o tecla.
- No hay JavaScript que controle el umbral.

---

## Solución

Reemplazar `<datalist>` con un **combobox controlado** implementado sin librerías externas, usando el design system existente (`globals.css`).

### Comportamiento esperado

- Input vacío o 1 carácter → sin dropdown (o dropdown oculto).
- ≥2 caracteres → mostrar máximo **20** coincidencias filtradas (case-insensitive, partial match).
- Navegación con teclado: `↑` / `↓` mueve la selección, `Enter` confirma, `Esc` cierra.
- Click en opción → selecciona y cierra el dropdown.
- Click fuera del componente → cierra el dropdown.
- En mobile: mismo comportamiento (touch-friendly).

### Implementación

1. En `frontend/src/app/pagos/page.tsx`:
   - Reemplazar el `<input list="...">` + `<datalist>` por un `<input>` sin `list` + un `<ul>` de sugerencias renderizado condicionalmente.
   - Estado local: `[query, setQuery]` para el texto, `[suggestions, setSuggestions]` para el array filtrado, `[open, setOpen]` para la visibilidad.
   - `suggestions = query.length >= 2 ? usuarios.filter(u => u.toLowerCase().includes(query.toLowerCase())).slice(0, 20) : []`
   - El `<ul>` solo se renderiza si `open && suggestions.length > 0`.
2. Accesibilidad mínima: `role="listbox"` en el `<ul>`, `role="option"` en cada `<li>`, `aria-expanded` en el input.
3. Aplicar las mismas clases CSS del design system (`.dropdown`, `.dropdown-item` si existen, o definir en `pagos.css`).
4. Evaluar si el mismo patrón aplica a otros comboboxes de la misma página (banco, agente) y aplicar si corresponde.

---

## Archivos

- `frontend/src/app/pagos/page.tsx` — reemplazar datalist por combobox controlado
- `frontend/src/app/pagos/pagos.css` — estilos del dropdown si no existen en globals.css

## Dependencias

- Ninguna bloqueante.

## Criterios de Aceptación

- [ ] Al dar focus al campo sin texto: no se muestra ninguna sugerencia.
- [ ] Con 1 carácter: no se muestra ninguna sugerencia.
- [ ] Con ≥2 caracteres: se muestran hasta 20 coincidencias relevantes.
- [ ] Navegación con teclado funciona (↑↓ Enter Esc).
- [ ] Click en sugerencia rellena el campo y cierra el dropdown.
- [ ] Click fuera del componente cierra el dropdown.
- [ ] El campo sigue enviando el valor correcto al formulario de pago.
- [ ] Funciona correctamente en mobile (pantalla <768px).

## Definición de Terminado

- Campo usuario en pagos es usable con 162+ usuarios.
- Sin regresiones en el flujo de creación de pagos.
