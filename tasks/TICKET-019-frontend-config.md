# TICKET-019: Frontend — Página de Configuración Admin

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~3h  
> **Prioridad**: P1

---

## Objetivo
Crear la página de administración con CRUD de todas las tablas de configuración, organizada por tabs.

## Archivos
- `frontend/src/app/configuracion/page.tsx + configuracion.css`

## Dependencias
- TICKET-013, TICKET-011

## Criterios de Aceptación
- [x] 6 tabs: Agentes, Categorías Gastos, Bancos, Cajas, Tipos de Pago, Usuarios
- [x] Formulario de agregar registro por tab
- [x] Botón de eliminar por registro
- [x] Importación masiva de usuarios (textarea, uno por línea)
- [x] Solo accesible para admin
- [x] Tabla genérica reutilizable (componente `Table`)

## Definición de Terminado
- Todas las tablas de config son gestionables desde la UI
- Los cambios se reflejan inmediatamente en los selects de otros módulos
