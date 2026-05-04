# Estado del Proyecto - Golden City Backoffice

## Actualizacion: 2026-05-05 - Sprint 17 CERRADO

Sprint 17 de "Totales por caja e indicadores derivados de Balance" quedo completado al 100% (T-093 a T-101). El patron base de totales por caja, los 4 modulos full-stack, los 6 indicadores de Balance, las 2 variaciones de caja, el detalle por caja y la documentacion final quedaron implementados y documentados.

### Alcance del Sprint 17
- 4 modulos nuevos de "totales por caja" (Depositos, Retiros, Bonos, Retiros no pagados): registro UPSERT por (fecha + caja_id), admin-only en POST y GET, replican el patron de Bancos.
- 6 indicadores nuevos en Balance: depositos reales, retiros reales y balance ingresos en versiones dia y acumulada.
- 2 indicadores de variacion de caja: diaria y acumulada.
- 2 cuadros de detalle en Balance: balance por caja (dia y acumulado).
- Documentacion final (T-101): PRD, architecture, decisions, state.md, BACKLOG.md.

### Estado del Sprint
- T-093 completado: schema central, setupSheets idempotente, documentacion y backlog actualizados.
- T-094 completado: backend + frontend de `depositos-totales`, admin-only en POST/GET, UPSERT por `(fecha, caja_id)` y auditoria de create/overwrite.
- T-095 completado: backend + frontend de `retiros-totales`, admin-only en POST/GET, UPSERT por `(fecha, caja_id)`.
- T-096 completado: backend + frontend de `bonos-totales`, admin-only en POST/GET, UPSERT por `(fecha, caja_id)`.
- T-097 completado: backend + frontend de `retiros-no-pagados`, admin-only en POST/GET, UPSERT por `(fecha, caja_id)`.
- T-098 completado: balance global expone los 6 indicadores diarios/acumulados de ingresos reales.
- T-099 completado: balance ahora expone la variacion de caja del dia y acumulada con cache por request y smoke de 60 dias.
- T-100 completado: balance expone el detalle de ingresos por caja para dia y acumulado, con cajas huérfanas marcadas y render responsive.
- T-101 completado: PRD, architecture, decisions, state.md y BACKLOG.md sincronizados con el cierre del sprint.
- Validacion completada: `backend npm test` (176/176), `frontend npm run typecheck`, `frontend npm run lint`, `frontend npm run build`.
- Commit: 03494a5. Push a main -> Railway + Vercel en deploy.

## Actualizacion: 2026-05-02 - Sprint 16 CERRADO

Sprint 16 completado al 100% (T-083 -> T-092). 152/152 tests passing. Commit: 28663af. Push a main -> Railway + Vercel en deploy.

### Resumen de cambios Sprint 16
- T-083/084: `cajaDisponible` y `balanceAcumulado` con suma de gastos; frontend actualizado.
- T-085: Hard delete fisico con auditoria en pagos, ingresos y gastos.
- T-086/087/088: Frontend reemplaza "Anular" por "Eliminar" en los 3 modulos.
- T-089: Keep-alive Railway: `GET /api/health`, `railway.json`, `HEALTHCHECK` en Dockerfile.
- T-090: Retry/backoff 5 intentos (250->4000ms), warmup 30s, `BackendStatusBanner` con 3 estados.
- T-091/092: Deteccion de duplicados (ventana 10min, 4 campos), modal de confirmacion, bypass `X-Confirm-Duplicate: true`.

### Estado de produccion
- Backend: Railway (deploy en curso tras push)
- Frontend: Vercel (deploy en curso tras push)
- Tests: 152/152 pass
- Deuda tecnica activa: T-057 (CI/CD headers legacy), T-058 (backup procedure)

## Documentacion del Proyecto
- `docs/PRD.md` - Product Requirements Document
- `docs/architecture.md` - Arquitectura completa (v1.12)
- `docs/tech-stack.md` - Stack tecnologico
- `docs/decisions.md` - Decisiones tecnicas / ADRs
- `tasks/BACKLOG.md` - Indice del backlog (T-098 completado)
- `tasks/TICKET-*.md` - tickets del proyecto

## Notas Tecnicas
- TypeScript en frontend, JavaScript CommonJS en backend
- Persistencia dual: Google Sheets (prod) / in-memory (dev)
- Auth por JWT en backend
- Verificacion E2E automatizada disponible en `backend/scripts/verifySheetsE2E.js`
