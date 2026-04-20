# TICKET-062 — Rediseño de `balance.service.js` con semántica "cierre de día"

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~5h
> **Dependencias**: TICKET-060, TICKET-061

---

## Contexto

El actual [backend/services/balance.service.js](../backend/services/balance.service.js) calcula totales acumulados sin concepto de "al cierre de una fecha". La nueva especificación requiere:

1. **Filtro de fecha opcional**: al cierre del día elegido, o al momento actual si no se pasa fecha.
2. **Bancos (admin)**: suma de saldos registrados en la hoja `bancos` con `fecha == D` y `banco_id ∈ adminBankIds`. Si la fecha es "hoy/ahora" sin registro, usar `bancos(ayer) + ingresos(hoy, banco_id admin) − gastos(hoy, banco_id admin)`.
3. **Cajas de agentes**: `sum(ingresos hasta D inclusive, agentes) − sum(pagos hasta D inclusive, agentes)`. Equivalente recursivo al enunciado.
4. **Total gastos**: acumulado de gastos activos hasta D inclusive.
5. **Balance del día (D)**: `(bancos(D) + cajas(D)) − (bancos(D-1) + cajas(D-1)) − gastos_del_día(D)`.
6. **Balance acumulado (D)**: `(bancos(D) + cajas(D)) − totalGastos(D) − caja_inicio_mes`.
7. **Desgloses**: por agente+banco del agente, por banco admin, por subcategoría de gasto.

## Alcance

1. Reescribir `balance.service.js` con las siguientes funciones:
   - `getBalanceAt({ fecha })` — retorna objeto completo.
   - Helpers internos: `getBancosAdminAt(fecha)`, `getCajasAgentesAt(fecha)`, `getTotalGastosAt(fecha)`, `getGastosDelDia(fecha)`.
2. **Carry-forward bancario**: si para la fecha D no existe registro de un `banco_id`, usar el más reciente anterior.
3. **Modo "ahora"** (sin fecha): fecha base = hoy (America/Lima). Para bancos admin usa la rama "ayer + movimientos de hoy".
4. Excluir registros con `estado='anulado'` (consistente con la lógica actual).
5. Normalización de fechas con [backend/config/timezone.js](../backend/config/timezone.js).
6. Mantener `getAgentBalance(agente)` para compat con `/api/balance/:agente` (sin cambios de contrato).
7. Estructura de retorno:
   ```js
   {
     fecha: 'YYYY-MM-DD' | null,
     bancosAdmin: { total, detalle: [{ banco_id, banco, saldo }] },
     cajasAgentes: { total, detalle: [{ agente, bancos: [{ banco_id, banco, saldo }] }] },
     totalGastos: { total, detalle: [{ categoria, subcategoria, monto }] },
     balanceDia: number,
     balanceAcumulado: number,
     cajaInicioMes: number,
   }
   ```

## Criterios de aceptación

- [ ] Nueva función retorna todos los campos en ambos modos (fecha / ahora).
- [ ] Carry-forward bancario funciona correctamente cuando falta snapshot.
- [ ] Anulados excluidos en ingresos, pagos y gastos.
- [ ] Fechas respetan timezone Lima.
- [ ] No se rompe `/api/balance/:agente`.

## Notas

- **Supuesto**: "durante el día" = `fecha_movimiento` para ingresos, `fecha_comprobante` para pagos, `fecha_gasto` para gastos. Confirmar con usuario antes de implementar.
- Cajas de agentes: al desglosar por banco del agente, usar el `banco_id` de cada movimiento (ingresos+pagos).
