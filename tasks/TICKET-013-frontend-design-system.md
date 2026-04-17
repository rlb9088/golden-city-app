# TICKET-013: Frontend — Design system y layout base

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~3h  
> **Prioridad**: P0 — Blocker

---

## Objetivo
Crear el design system completo (tema dark premium con acentos dorados) y el layout principal (sidebar + content area).

## Archivos
- `frontend/src/app/globals.css` — Variables, reset, componentes base
- `frontend/src/app/layout.tsx` — Root layout con metadata y fonts
- `frontend/src/app/layout.css` — Grid layout
- `frontend/src/app/client-layout.tsx` — Wrapper client-side con providers
- `frontend/src/components/Sidebar.tsx + .css` — Navegación lateral
- `frontend/src/lib/auth-context.tsx` — AuthProvider con localStorage
- `frontend/src/lib/format.ts` — Formateo de moneda y fechas
- `frontend/src/lib/api.ts` — Cliente HTTP con auth headers

## Dependencias
- TICKET-001

## Criterios de Aceptación
- [x] Tema dark premium con colores gold/green/red/blue coherentes
- [x] Sidebar con navegación, logo, selector de rol
- [x] Estilos reutilizables: .btn, .card, .table, .badge, .input, .select
- [x] Animaciones: fadeIn, slideIn, stagger
- [x] Tipografía Inter desde Google Fonts
- [x] Layout responsive (sidebar + content)
- [x] AuthProvider funcional con localStorage
- [x] API client con headers de auth automáticos
- [x] Format helpers para PEN (S/) y timezone Lima

## Definición de Terminado
- Todas las páginas usan el design system consistentemente
- El sidebar cambia de rol y se refleja en las páginas
