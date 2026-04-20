# TICKET-061 — Helper `getAdminBankIds()` para distinguir bancos admin vs agentes

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: ninguna

---

## Contexto

El nuevo módulo Balance debe mostrar por separado:
- **Bancos (admin)**: saldos de los bancos cuyo propietario es el administrador.
- **Cajas de agentes**: balance derivado de ingresos/pagos de los agentes.

Hoy `config_bancos` tiene las columnas `propietario` y `propietario_id`, pero no hay un helper centralizado que devuelva el conjunto de `banco_id` cuyo propietario es admin.

## Alcance

1. En [backend/services/bancos.service.js](../backend/services/bancos.service.js) (o nuevo `config.service.js` helper), añadir `getAdminBankIds()` y `getAgentBankIds()`:
   - Lee `config_agentes` para obtener los `id` con `role='admin'`.
   - Lee `config_bancos` y filtra por `propietario_id ∈ adminIds`.
   - Retorna `Set<string>` de `banco_id`.
2. Cachear en memoria con TTL corto (ej. 30s) para evitar refetch por petición.
3. Exponer también `classifyBanco(bancoId)` → `'admin' | 'agente' | 'unknown'`.
4. Tests unitarios con fixtures de `config_agentes` y `config_bancos`.

## Criterios de aceptación

- [ ] Helper disponible e invocable desde `balance.service.js`.
- [ ] Test que cubre: solo admin, solo agentes, banco huérfano (sin `propietario_id`), cache invalidation.
- [ ] Si no hay bancos admin configurados, retorna `Set` vacío sin lanzar.

## Notas

- **Supuesto a validar con el usuario antes de ejecutar**: se identifica admin por `role='admin'` en `config_agentes`. Si la convención es otra (p.ej. `propietario='admin'` literal), ajustar en este ticket.
