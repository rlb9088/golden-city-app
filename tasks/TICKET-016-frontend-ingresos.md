# TICKET-016: Frontend — Página de Ingresos

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Crear la página de registro de ingresos (carga de caja a agentes), solo accesible para admin.

## Archivos
- `frontend/src/app/ingresos/page.tsx + ingresos.css`

## Dependencias
- TICKET-013, TICKET-007

## Criterios de Aceptación
- [x] Formulario: agente (select), banco (select), monto, fecha/hora del movimiento
- [x] Solo visible para admin (warning si es agente)
- [x] Tabla de últimos ingresos
- [x] Focus en monto después de submit
- [x] Confirmación visual de éxito

## Definición de Terminado
- Ingresos se registran correctamente y se reflejan en el balance del agente
