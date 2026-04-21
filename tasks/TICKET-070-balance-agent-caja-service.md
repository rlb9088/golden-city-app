# TICKET-070 — Backend: función `getAgentCajaAt` en `balance.service`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: —

---

## Contexto

Los agentes (no admin) necesitan ver su saldo personal en la pestaña Balance. Hoy `balance.service.js` solo tiene `getAgentBalance(agente)` que calcula un simple `ingresos - pagos` acumulado sin manejo de fecha, sin desglose por banco y sin movimiento diario.

Se necesita una función `getAgentCajaAt({ agente, fecha })` que implemente la semántica de "cierre de día" para el agente: saldo acumulado al cierre de la fecha elegida (o al momento actual), más el desglose por banco y el bloque de movimiento diario.

## Alcance

Agregar en [backend/services/balance.service.js](../backend/services/balance.service.js) la función `getAgentCajaAt({ agente, fecha })` y exportarla.

### Fórmula

```
saldo_cierre(fecha) = sum(ingresos del agente hasta fecha inclusive)
                    − sum(pagos del agente hasta fecha inclusive)

montoInicial     = saldo_cierre(fecha − 1)
pagosDia         = sum(pagos del agente con fecha_comprobante === fecha)
saldoTotal       = montoInicial − pagosDia
```

- "Ingresos del agente" = filas de `ingresos` donde `agente` coincide (case-insensitive) con el nombre del agente.
- "Pagos del agente" = filas de `pagos` donde `agente` coincide.
- Solo `banco_id` que pertenecen al agente (filtrar por `config_bancos.propietario_id` del agente, no todos los `agentBankIds` globales).
- Excluir filas con `estado = 'anulado'` (usar helper `isActivo` existente).
- Modo "ahora" (sin fecha): `targetDate = todayLima()`, misma lógica.

### Estructura de retorno

```js
{
  fecha: 'YYYY-MM-DD' | null,   // null en modo ahora
  agente: 'nombre del agente',
  total: number,                 // saldo_cierre total (suma de todos los bancos)
  movimiento: {
    montoInicial: number,        // saldo_cierre(fecha-1)
    pagosDia: number,            // pagos exactos del día
    saldoTotal: number,          // montoInicial - pagosDia
  },
  bancos: [                      // desglose por banco del agente
    { banco_id: string, banco: string, saldo: number }
  ]
}
```

### Implementación

1. Reutilizar `loadBalanceContext()`, `resolveRequestedDate()`, `subtractOneDay()`, `aggregateIngresosByBank()`, `aggregatePagosByBank()`, `parseAmount()`, `isActivo()`, `normalizeLookup()` que ya existen en el mismo archivo.
2. Obtener los `banco_id` del agente específico filtrando `config_bancos` donde `propietario_id` coincida con el agente (usar `getTable('bancos')` / context ya cargado).
3. Para el desglose por banco: agrupar `ingresos - pagos` por `banco_id` del agente, igual que hace `buildCajasDetalle` pero para un solo agente.
4. Para `montoInicial`: calcular la misma suma acumulada pero con `targetDate = subtractOneDay(fecha)`.
5. Para `pagosDia`: usar `aggregatePagosByBank(..., { exactDate: true })` filtrando por el agente.

### Cambios en archivos

- **[backend/services/balance.service.js](../backend/services/balance.service.js)**: agregar función `getAgentCajaAt` y añadirla a `module.exports`.

No se crea ninguna ruta ni controller en este ticket.

## Criterios de aceptación

- [ ] `getAgentCajaAt({ agente, fecha })` existe y es exportada.
- [ ] Devuelve la estructura de retorno completa para un agente con movimientos.
- [ ] Devuelve `total: 0` y `bancos: []` para un agente sin movimientos.
- [ ] Anulados excluidos.
- [ ] Modo fecha y modo ahora funcionan.
- [ ] No rompe las funciones existentes (`getBalanceAt`, `getAgentBalance`, etc.).

## Notas

- El campo `agente` en `ingresos`/`pagos` almacena el `nombre` del agente (ver `ingresos.service.js:236`). La comparación debe ser case-insensitive via `normalizeLookup`.
- No filtrar `allowedBankIds` por el set global de agent banks; filtrar solo los bancos propios del agente usando `config_bancos`.
