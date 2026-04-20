# TICKET-068 — Actualización documentaria del rediseño de Balance

> **Estado**: ✅ COMPLETADO
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P2
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: TICKET-062, TICKET-066

---

## Contexto

La nueva lógica de Balance y la tabla `config_settings` deben quedar reflejadas en la documentación del repo para que el PRD, la arquitectura y las ADRs estén alineadas con el código.

## Alcance

1. **[docs/PRD.md](../docs/PRD.md)**: actualizar la sección de Balance con:
   - Descripción de filtro por fecha.
   - Fórmulas completas de los 5 KPIs.
   - Descripción de los 3 desgloses.
   - Referencia al setting `caja_inicio_mes`.
2. **[docs/architecture.md](../docs/architecture.md)**:
   - Añadir `config_settings` en el modelo de datos (sección 4).
   - Añadir endpoints nuevos (`/api/config/settings/:key`, `/api/balance?fecha=`) en la tabla de sección 3.4.
3. **[docs/decisions.md](../docs/decisions.md)**: nuevo ADR con:
   - Decisión: semántica "cierre de día" + carry-forward bancario.
   - Alternativas consideradas.
   - Consecuencias.
4. Actualizar versión y fecha de los docs afectados.

## Criterios de aceptación

- [ ] PRD describe correctamente la nueva UI y fórmulas.
- [ ] Arquitectura lista los nuevos endpoints y la hoja `config_settings`.
- [ ] ADR nuevo commiteado en `decisions.md`.
- [ ] Links cruzados funcionan.

## Notas

- Revisar también [docs/setup-guide.md](../docs/setup-guide.md) por si es necesario añadir paso de inicialización de `caja_inicio_mes`.
