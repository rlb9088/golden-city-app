# TICKET-025: Frontend — Responsive design (móvil y tablet)

> **Estado**: ✅ COMPLETADO
> **Sprint**: 3 — Hardening
> **Esfuerzo**: ~3h  
> **Prioridad**: P2

---

## Objetivo
Hacer que el layout funcione correctamente en dispositivos móviles y tablets (sidebar colapsable, tablas scrolleables, formularios adaptables).

## Acciones
1. Sidebar colapsable en mobile (hamburger menu)
2. Media queries para breakpoints: mobile (<768px), tablet (768-1024px)
3. Form-grid responsive (1 columna en mobile)
4. Tablas con scroll horizontal en pantallas pequeñas
5. StatsCards apilados en mobile (1 por fila)
6. Touch-friendly: inputs y botones con tamaño mínimo 44px

## Archivos probables
- `frontend/src/app/globals.css` — media queries globales
- `frontend/src/app/layout.css` — sidebar responsive
- `frontend/src/components/Sidebar.tsx + .css` — hamburger menu
- `frontend/src/app/balance/balance.css` — cards responsive

## Dependencias
- TICKET-013

## Criterios de Aceptación
- [x] Todos los modales y componentes son 100% operativos en pantallas chicas
- [x] Navegación de sidebar colapsable
- [x] Tablas se pueden deslizar o cambiar a vista de card
- [x] Botones tocables en móvil

## Definición de Terminado
- Funcional usable en dispositivos móviles, incluyendo un Sidebar colapsable y tablas responsivas.

---

## Validación Ejecutada
- Variables de respuesta (`--breakpoint-md`, etc.) y reglas @media integradas en `globals.css` y `layout.css`.
- Lógica de Sidebar colapsable con "hamburger icon" y backdrop desarrollada (`frontend/src/components/Sidebar.tsx` + css, y en `client-layout.tsx`).
- Botones accesibles listos `min-height: 48px`.
- Form-grid ahora se adapta de columnas múltiples a 1 sola.
- Tablas wrappeadas en un `.table-container` para permitir scroll-x (overflow).
