# TICKET-101 — Documentación Sprint 17

> **Estado**: ✅ COMPLETADO
> **Sprint**: 17 — Totales por caja e indicadores derivados de Balance
> **Prioridad**: P0
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-093, TICKET-094, TICKET-095, TICKET-096, TICKET-097, TICKET-098, TICKET-099, TICKET-100

---

## Contexto

Cerrar el Sprint 17 actualizando toda la documentación viva del repo: PRD, arquitectura, ADRs, state.md y BACKLOG.md. Este ticket se ejecuta al final del sprint, cuando los 8 tickets previos ya están marcados como ✅ COMPLETADO.

## Alcance

### 1. PRD — [docs/PRD.md](../docs/PRD.md)

Agregar sección "Totales por caja" con:
- Descripción funcional de los 4 módulos (Depósitos, Retiros, Bonos, Retiros no pagados).
- Patrón de UPSERT por (fecha, caja).
- Permisos: admin-only.

Agregar al apartado del módulo Balance una sub-sección "Indicadores derivados Sprint 17":
- 6 indicadores día/acumulado (depósitos reales, retiros reales, balance ingresos × 2).
- 2 variaciones de caja (día y acumulada) con la fórmula completa.
- 2 cuadros de detalle por caja (día y acumulado).

Bumpear versión del PRD (de v1.2 a v1.3) y fecha.

### 2. Architecture — [docs/architecture.md](../docs/architecture.md)

- Listar las 4 hojas nuevas en la sección de modelo de datos (si TICKET-093 ya documentó algo, expandirlo con detalle definitivo).
- Documentar las nuevas funciones agregadas a `balance.service.js`: `getDepositosTotalesAt`, `getRetirosTotalesAt`, `getBonosTotalesAt`, `getRetirosNoPagadosAt`, `getVariacionCajaDia`, `getVariacionCajaAcumulada`, `buildBalancePorCaja`.
- Mostrar el flujo de cálculo extendido: snapshot ya no es solo bancos+gastos+caja sino que incluye los nuevos indicadores y los cuadros por caja.
- Bumpear versión (de v1.8 a v1.9) y fecha.

### 3. Decisions — [docs/decisions.md](../docs/decisions.md)

Agregar **un ADR nuevo** (siguiente número disponible) titulado "ADR: 4 módulos separados de totales por caja en lugar de un módulo polimórfico", argumentando:
- **Decisión**: implementar 4 módulos backend/frontend independientes (Depósitos, Retiros, Bonos, Retiros no pagados) en lugar de un único módulo polimórfico con un campo `tipo`.
- **Razones**:
  - Alineación con la UI: cada módulo tiene su propia entrada de sidebar y página dedicada.
  - Auditoría diferenciada: cada acción en `audit.service` apunta a una entidad clara.
  - Permisos y validaciones específicas pueden divergir en el futuro sin refactor.
  - Simplicidad de schema: cada hoja tiene un único propósito.
- **Trade-off aceptado**: hay duplicación de código casi 1:1 entre los 4 módulos. Se mitigó con copy-paste guiado y replace mecánico.

Bumpear versión y fecha del archivo.

### 4. State — [context/memory/state.md](../context/memory/state.md)

Agregar entrada nueva al inicio:

```markdown
## Actualizacion: YYYY-MM-DD — Sprint 17 CERRADO

Sprint 17 completado al 100% (T-093 → T-101). [N]/[N] tests passing. Commit: <hash>. Push a main → Railway + Vercel en deploy.

### Resumen de cambios Sprint 17
- **T-093**: Schema y patrón "totales por caja" (4 hojas nuevas en Sheets).
- **T-094 a T-097**: 4 módulos full-stack de totales por caja (Depósitos, Retiros, Bonos, Retiros no pagados) con UPSERT por (fecha + caja_id), admin-only.
- **T-098**: 6 indicadores nuevos en Balance (depósitos reales, retiros reales, balance ingresos × día y acumulado).
- **T-099**: variación de caja del día y acumulada (fórmula de cuadre saldo vs operaciones).
- **T-100**: 2 cuadros de balance de ingresos por caja (día y acumulado).
- **T-101**: actualización de documentación (PRD, architecture, decisions).

### Estado de produccion
- Backend: Railway (desplegando tras push)
- Frontend: Vercel (desplegando tras push)
- Tests: [N]/[N] pass
- Deuda tecnica activa: T-057 (CI/CD headers legacy), T-058 (backup procedure), [otras detectadas]
```

### 5. BACKLOG — [tasks/BACKLOG.md](../tasks/BACKLOG.md)

- Cambiar el estado de los 9 tickets del Sprint 17 a ✅.
- Actualizar el resumen de totales en la cabecera.
- Actualizar la fecha de "Ultima actualizacion".
- Agregar la nota final del Sprint 17 con resumen ejecutivo.

### 6. Verificación final

- Validar manualmente el sistema end-to-end:
  1. Registrar valores en los 4 nuevos módulos para una fecha F.
  2. Cargar `/balance?fecha=F` y verificar que las 8 KPIs y los 2 cuadros muestran números coherentes.
  3. Cambiar fecha a F+1 sin nuevos datos: KPIs del día = 0, acumuladas reflejan F.
  4. Confirmar variación de caja contra cálculo manual con calculadora.
- Ejecutar suite completa: `cd backend && npm test` debe terminar en verde.
- Ejecutar `cd frontend && npm run typecheck && npm run lint`.
- Verificación manual end-to-end contra Sheets reales: no ejecutada en este entorno para evitar mutaciones sobre datos vivos; quedó documentada como paso de UAT para el cierre operativo.

## Archivos a modificar

- [docs/PRD.md](../docs/PRD.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/decisions.md](../docs/decisions.md)
- [context/memory/state.md](../context/memory/state.md)
- [tasks/BACKLOG.md](../tasks/BACKLOG.md)

## Criterios de aceptación

- [ ] PRD describe los 4 módulos nuevos y los 8 indicadores + 2 cuadros del Balance.
- [ ] Architecture lista las 4 hojas nuevas y las funciones nuevas del balance service.
- [ ] Decisions tiene un ADR explicando la elección de 4 módulos separados.
- [ ] State.md tiene entrada Sprint 17 cerrado con resumen, tests y deuda.
- [ ] BACKLOG.md tiene los 9 tickets en estado ✅ y nota de cierre del Sprint 17.
- [ ] Cabeceras de versión/fecha bumpeadas en docs.
- [ ] Verificación end-to-end manual ejecutada y documentada en el commit message del cierre.

## Definición de Terminado

Sprint 17 cerrado oficialmente. Toda la documentación refleja el estado final. Un nuevo desarrollador o agente puede leer state.md + PRD + architecture y entender los 4 módulos nuevos y los indicadores del balance sin necesidad de leer código.

## Notas

- Si en el sprint surgió alguna deuda técnica menor (ej: una caja huérfana que no estaba prevista, ajuste de copy en frontend), agregarla a la sección "Deuda Tecnica" de state.md.
- Si la fórmula de variación de caja no calzó exactamente con la expectativa del usuario en UAT, documentar el ajuste final aquí o crear un ticket separado en Sprint 18.
