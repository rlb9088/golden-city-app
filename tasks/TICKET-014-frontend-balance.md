# TICKET-014: Frontend — Dashboard de Balance

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~3h  
> **Prioridad**: P0 — Core

---

## Objetivo
Crear la página de dashboard con vista consolidada del estado financiero.

## Archivos
- `frontend/src/app/balance/page.tsx + balance.css`
- `frontend/src/components/StatsCard.tsx + .css`
- `frontend/src/components/AlertBanner.tsx + .css`

## Dependencias
- TICKET-013 (design system), TICKET-010 (backend balance)

## Criterios de Aceptación
- [x] 4 StatsCards: Balance Global, Total Cajas, Total Bancos, Total Gastos
- [x] Tabla de balance por agente (ingresos, pagos, balance neto)
- [x] Tabla de saldos bancarios actuales
- [x] Skeleton loading mientras carga
- [x] Botón de actualización manual
- [x] Colores dinámicos según positivo/negativo
- [x] Home (/) redirige a /balance

## Definición de Terminado
- Dashboard refleja datos reales del backend
- Se actualiza correctamente al agregar datos en otros módulos
