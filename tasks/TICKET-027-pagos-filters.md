# TICKET-027: Filtros y búsqueda en tablas de pagos

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 4 — Funcionalidad  
> **Esfuerzo**: ~3h  
> **Prioridad**: P2  
> **Completado en**: 2026-04-16

---

## Objetivo
Agregar filtros de fecha, agente, banco y búsqueda por usuario en la tabla de pagos para encontrar registros rápidamente.

## Acciones
### Backend
1. Agregar parámetros de filtro en GET `/api/pagos`: `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&banco=X&usuario=X`
2. Filtrar en el service antes de retornar

### Frontend
1. Agregar barra de filtros encima de la tabla de pagos
2. Filtros: rango de fecha (desde/hasta), agente (select), banco (select), búsqueda libre (usuario)
3. Aplicar filtros al llamar la API
4. Mostrar contador de resultados filtrados

## Archivos probables
- `backend/services/pagos.service.js` — método getFiltered()
- `backend/controllers/pagos.controller.js` — leer query params
- `frontend/src/app/pagos/page.tsx` — UI de filtros
- `frontend/src/app/pagos/pagos.css` — estilos de filtros
- `frontend/src/lib/api.ts` — agregar params a getPagos()

## Dependencias
- TICKET-015

## Criterios de Aceptación
- [ ] Filtro por rango de fecha funciona
- [ ] Filtro por agente funciona
- [ ] Filtro por banco funciona
- [ ] Búsqueda por nombre de usuario funciona (parcial, case-insensitive)
- [ ] Los filtros se combinan (AND)
- [ ] Contador muestra "X de Y resultados"

## Definición de Terminado
- Tabla de pagos es navegable incluso con muchos registros
