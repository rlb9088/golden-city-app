# TICKET-007: Backend — CRUD de Ingresos

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Implementar el flujo completo de creación y listado de ingresos (asignación de caja a agente).

## Archivos
- `backend/schemas/ingresos.schema.js`
- `backend/services/ingresos.service.js`
- `backend/controllers/ingresos.controller.js`
- `backend/routes/ingresos.routes.js`

## Dependencias
- TICKET-002, TICKET-003, TICKET-004, TICKET-005

## Criterios de Aceptación
- [x] POST `/api/ingresos` crea un ingreso (admin only)
- [x] GET `/api/ingresos` lista todos los ingresos
- [x] Auditoría registrada en cada creación
- [x] Validación con Zod (agente, banco, monto > 0, fecha requerida)

## Definición de Terminado
- Endpoint funcional y protegido por requireAdmin
- Datos persisten correctamente
