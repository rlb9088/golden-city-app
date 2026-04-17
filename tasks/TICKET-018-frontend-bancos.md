# TICKET-018: Frontend — Página de Saldos Bancarios

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 1 — Core  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Core

---

## Objetivo
Crear la página de registro de saldos bancarios diarios con warning de upsert.

## Archivos
- `frontend/src/app/bancos/page.tsx + bancos.css`

## Dependencias
- TICKET-013, TICKET-009

## Criterios de Aceptación
- [x] Formulario: fecha, banco (select), saldo
- [x] Warning visual cuando se va a sobrescribir un saldo existente (upsert)
- [x] Botón cambia texto: "Registrar Saldo" → "Actualizar Saldo"
- [x] Solo visible para admin
- [x] Tabla de saldos ordenados por fecha descendente

## Definición de Terminado
- Saldos se registran/actualizan correctamente
- Dashboard refleja último saldo por banco
