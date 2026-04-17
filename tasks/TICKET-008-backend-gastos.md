# TICKET-008: Backend — CRUD de Gastos

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Implementar el flujo completo de creación y listado de gastos operativos.

## Archivos
- `backend/schemas/gastos.schema.js`
- `backend/services/gastos.service.js`
- `backend/controllers/gastos.controller.js`
- `backend/routes/gastos.routes.js`

## Dependencias
- TICKET-002, TICKET-003, TICKET-004, TICKET-005

## Criterios de Aceptación
- [x] POST `/api/gastos` crea un gasto (admin only)
- [x] GET `/api/gastos` lista todos los gastos
- [x] Categoría y subcategoría incluidas
- [x] Auditoría registrada

## Definición de Terminado
- Endpoint funcional con validación completa
- Gastos restan del balance global
