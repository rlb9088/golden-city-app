# TICKET-029: Interfaz de auditoría (vista de logs)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 4 — Funcionalidad  
> **Esfuerzo**: ~2h  
> **Prioridad**: P2  
> **Completado en**: 2026-04-16

---

## Objetivo
Crear una página admin para consultar el log de auditoría, con filtros por entidad, acción y usuario.

## Acciones
### Backend
1. GET `/api/audit` — listar registros de auditoría (admin only)
2. Filtros opcionales: `?entity=pago&action=create&user=Admin&desde=X&hasta=X`

### Frontend
1. Nueva página `/audit` (admin only)
2. Tabla con: timestamp, acción, entidad, usuario, detalle (JSON expandible)
3. Filtros: tipo de entidad, acción, usuario, rango de fecha
4. Agregar enlace en el sidebar (admin only)

## Archivos probables
- `backend/routes/audit.routes.js` — (NEW)
- `backend/controllers/audit.controller.js` — (NEW)
- `backend/services/audit.service.js` — getAll(), getFiltered()
- `frontend/src/app/audit/page.tsx` — (NEW)
- `frontend/src/app/audit/audit.css` — (NEW)
- `frontend/src/components/Sidebar.tsx` — agregar link
- `frontend/src/lib/api.ts` — getAuditLogs()

## Dependencias
- TICKET-004

## Criterios de Aceptación
- [ ] Admin puede ver todos los registros de auditoría
- [ ] Filtros por entidad, acción y rango de fecha
- [ ] JSON de cambios es expandible/colapsable
- [ ] Solo accesible para admin
- [ ] Ordenado por timestamp descendente

## Definición de Terminado
- Trazabilidad completa accesible desde la interfaz
