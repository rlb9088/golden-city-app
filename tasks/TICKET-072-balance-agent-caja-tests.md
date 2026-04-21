# TICKET-072 — Backend: tests unitarios de `getAgentCajaAt`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-070, TICKET-071

---

## Contexto

`getAgentCajaAt` implementa lógica de fechas, filtros por agente y desglose por banco. Se necesitan tests que fijen el comportamiento en los casos borde antes de conectar el frontend.

## Alcance

Crear `backend/tests/balance-agent-caja.test.js` usando fixtures in-memory (igual que los tests existentes en `backend/tests/`).

### Casos de prueba obligatorios

1. **Agente sin movimientos** → `total: 0`, `bancos: []`, `movimiento.montoInicial: 0`, `movimiento.pagosDia: 0`, `movimiento.saldoTotal: 0`.

2. **Agente con ingresos en múltiples bancos, sin pagos** → `total = suma ingresos`, bancos desglosados correctamente, `pagosDia: 0`.

3. **Agente con ingresos y pagos en el mismo día (modo ahora)** → `total = ingresos - pagos`, `montoInicial: 0` (sin historial previo), `pagosDia = pagos del día`, `saldoTotal = montoInicial - pagosDia`.

4. **Modo fecha histórica** → pasa `fecha = 'D'`; pagos en D-1 no se cuentan en `pagosDia`; pagos en D sí cuentan; `montoInicial` refleja acumulado hasta D-1.

5. **Anulados excluidos** → ingreso anulado y pago anulado no afectan ningún total.

6. **Agente B no ve datos del agente A** → llamar con `agente = 'B'` cuando los datos son de `'A'` → todo en 0.

7. **Desglose por banco correcto** → agente tiene 2 bancos; cada uno muestra su saldo propio (ingresos de banco1 - pagos de banco1, idem banco2).

8. **`montoInicial` primer día disponible** → sin historial previo (D-1 vacío) → `montoInicial: 0`, `saldoTotal` igual a negativo de `pagosDia`.

9. **Ingresos del día aumentan `total` y desglose pero NO afectan `movimiento.pagosDia`** → `pagosDia` solo cuenta pagos, no ingresos.

### Instrucciones de implementación

- Replicar patrón de `backend/tests/balance-service.test.js` (si existe) o del test más cercano.
- Los fixtures deben ser objetos JS planos con los mismos campos que las hojas reales (`ingresos`, `pagos`, `config_bancos`).
- Mockear `loadBalanceContext` para inyectar fixtures, o llamar a `getAgentCajaAt` con un contexto in-memory si la función acepta `context` opcional (agregar ese parámetro en TICKET-070 si no está).

## Criterios de aceptación

- [ ] `npm test` ejecuta la nueva suite sin errores.
- [ ] Los 9 casos pasan en verde.
- [ ] No se requieren credenciales de Google Sheets para correr los tests.

## Notas

- Si `getAgentCajaAt` no acepta `context` como parámetro opcional, agregar el parámetro en TICKET-070 antes de implementar los tests (igual que `getBancosAdminAt(fecha, context = null)`).
