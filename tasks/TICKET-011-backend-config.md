# TICKET-011: Backend — Configuración CRUD + seed data

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~3h  
> **Prioridad**: P1

---

## Objetivo
Implementar el CRUD completo de tablas de configuración (agentes, bancos, cajas, categorías, tipos_pago, usuarios) con seed data por defecto.

## Archivos
- `backend/services/config.service.js`
- `backend/controllers/config.controller.js`
- `backend/routes/config.routes.js`

## Dependencias
- TICKET-002, TICKET-003

## Criterios de Aceptación
- [x] GET `/api/config` retorna toda la configuración para selects del frontend
- [x] GET `/api/config/:table` retorna datos de una tabla (admin)
- [x] POST `/api/config/:table` agrega registro (admin)
- [x] POST `/api/config/:table/import` importa batch (admin)
- [x] DELETE `/api/config/:table/:id` elimina registro (admin)
- [x] Seed data se muestra cuando la tabla está vacía
- [x] 6 tablas configurables: agentes, categorias, bancos, cajas, tipos_pago, usuarios

## Definición de Terminado
- Todas las tablas de config son editables desde el frontend
- Seed data permite uso inmediato sin configurar Sheets
