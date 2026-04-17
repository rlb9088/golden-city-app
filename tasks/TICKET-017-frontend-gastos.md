# TICKET-017: Frontend — Página de Gastos

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Crear la página de registro de gastos operativos con categorías dinámicas.

## Archivos
- `frontend/src/app/gastos/page.tsx + gastos.css`

## Dependencias
- TICKET-013, TICKET-008

## Criterios de Aceptación
- [x] Formulario: fecha, concepto, categoría (select), subcategoría (select dinámico), banco, monto
- [x] Subcategorías se actualizan al cambiar categoría
- [x] Solo visible para admin
- [x] Tabla de últimos gastos
- [x] Focus en concepto después de submit

## Definición de Terminado
- Gastos se registran correctamente y se reflejan en el balance global
