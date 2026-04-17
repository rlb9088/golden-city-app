# TICKET-006: Backend — CRUD de Pagos (controller + service + schema + routes)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~3h  
> **Prioridad**: P0 — Core

---

## Objetivo
Implementar el flujo completo de creación y listado de pagos en backend.

## Archivos
- `backend/schemas/pagos.schema.js`
- `backend/services/pagos.service.js`
- `backend/controllers/pagos.controller.js`
- `backend/routes/pagos.routes.js`
- `backend/index.js` (registrar ruta)

## Dependencias
- TICKET-002, TICKET-003, TICKET-004, TICKET-005

## Criterios de Aceptación
- [x] POST `/api/pagos` crea un pago con validación Zod
- [x] GET `/api/pagos` lista todos los pagos
- [x] GET `/api/pagos?agente=X` filtra por agente
- [x] Cada pago genera un registro de auditoría
- [x] IDs únicos con formato PAG-timestamp-counter
- [x] `fecha_registro` usa timezone Lima

## Definición de Terminado
- Endpoint probado con Postman/curl
- Datos persisten en Sheets o in-memory
- Auditoría registrada
