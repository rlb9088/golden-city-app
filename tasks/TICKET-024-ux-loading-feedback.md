# TICKET-024: Frontend — Loading states y feedback UX mejorado

> **Estado**: 🔲 PENDIENTE  
> **Sprint**: 3 — Polish  
> **Esfuerzo**: ~2h  
> **Prioridad**: P2

---

## Objetivo
Mejorar los estados de carga, feedback de acciones y manejo de errores de red en el frontend.

## Acciones
1. Agregar skeleton loaders a todas las tablas (no solo balance)
2. Agregar indicador de conexión al backend (banner si API no responde)
3. Retry automático en errores de red (1 retry antes de mostrar error)
4. Timeout de 10s en llamadas API con mensaje claro
5. Deshabilitar botones submit durante carga de config (evitar envíos sin selects)
6. Mejorar AlertBanner con autoDismiss configurable por tipo

## Archivos probables
- `frontend/src/lib/api.ts` — timeout, retry
- `frontend/src/components/AlertBanner.tsx` — autoDismiss mejorado
- `frontend/src/app/*/page.tsx` — skeleton loaders
- `frontend/src/app/globals.css` — skeleton animation styles

## Dependencias
- Ninguna (mejora independiente)

## Criterios de Aceptación
- [ ] Skeleton loaders visibles mientras cargan datos
- [ ] Errores de red muestran mensaje amigable con opción de reintentar
- [ ] Botón submit deshabilitado hasta que config esté cargada
- [ ] Alertas de success se auto-ocultan después de 4s
- [ ] Alertas de error persisten hasta dismiss manual

## Definición de Terminado
- La app se siente robusta y responsiva incluso con latencia alta
