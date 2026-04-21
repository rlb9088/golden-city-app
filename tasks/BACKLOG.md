# Backlog - Golden City Backoffice MVP

> **Ultima actualizacion**: 2026-04-21

---

## Resumen del Backlog

| Total | Completados | En progreso/Parcial | Pendientes |
|-------|-------------|---------------------|------------|
| 76 | 57 | 0 | 19 |

---

## Sprint 0 - Setup (✅ Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 001 | [Inicializacion del repo](./TICKET-001-init-repo.md) | ✅ | ~2h |
| 002 | [Sheets Repository](./TICKET-002-sheets-repository.md) | ✅ | ~2h |
| 003 | [Middleware auth + validacion](./TICKET-003-middleware-auth-validation.md) | ✅ | ~1h |
| 004 | [Servicio de auditoria](./TICKET-004-audit-service.md) | ✅ | ~1h |
| 005 | [Timezone helper](./TICKET-005-timezone-helper.md) | ✅ | ~30min |

---

## Sprint 1 - Core (✅ Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 006 | [Backend Pagos CRUD](./TICKET-006-backend-pagos.md) | ✅ | ~3h |
| 007 | [Backend Ingresos CRUD](./TICKET-007-backend-ingresos.md) | ✅ | ~2h |
| 008 | [Backend Gastos CRUD](./TICKET-008-backend-gastos.md) | ✅ | ~2h |
| 009 | [Backend Bancos (upsert)](./TICKET-009-backend-bancos.md) | ✅ | ~2h |
| 010 | [Backend Balance engine](./TICKET-010-backend-balance.md) | ✅ | ~2h |
| 011 | [Backend Config CRUD + seed](./TICKET-011-backend-config.md) | ✅ | ~3h |
| 013 | [Frontend Design system + layout](./TICKET-013-frontend-design-system.md) | ✅ | ~3h |
| 014 | [Frontend Dashboard balance](./TICKET-014-frontend-balance.md) | ✅ | ~3h |
| 016 | [Frontend Ingresos](./TICKET-016-frontend-ingresos.md) | ✅ | ~2h |
| 017 | [Frontend Gastos](./TICKET-017-frontend-gastos.md) | ✅ | ~2h |
| 018 | [Frontend Bancos](./TICKET-018-frontend-bancos.md) | ✅ | ~2h |
| 019 | [Frontend Configuracion](./TICKET-019-frontend-config.md) | ✅ | ~3h |

---

## Sprint 2 - OCR (✅ Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 012 | [Backend OCR pipeline](./TICKET-012-backend-ocr.md) | ✅ | ~4h |
| 015 | [Frontend Pagos + OCR](./TICKET-015-frontend-pagos-ocr.md) | ✅ | ~4h |

---

## Sprint 3 - Integracion y Hardening (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 020 | [Preparar Google Sheets](./TICKET-020-sheets-setup.md) | ✅ | ~2h | P0 |
| 021 | [Verificacion E2E con Sheets](./TICKET-021-e2e-sheets-verification.md) | ✅ | ~3h | P0 |
| 022 | [Error handling robusto](./TICKET-022-error-handling.md) | ✅ | ~3h | P1 |
| 023 | [Validacion referencial](./TICKET-023-referential-validation.md) | ✅ | ~2h | P1 |
| 024 | [Loading states y UX feedback](./TICKET-024-ux-loading-feedback.md) | ✅ | ~2h | P2 |
| 025 | [Responsive design](./TICKET-025-responsive-design.md) | ✅ | ~3h | P2 |
| 026 | [Guia de setup](./TICKET-026-setup-guide.md) | ✅ | ~2h | P1 |
| 031 | [Fix removeFromTable (bug)](./TICKET-031-fix-remove-config.md) | ✅ | ~2h | P1 |

---

## Sprint 4 - Funcionalidad Avanzada (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 027 | [Filtros en tabla de pagos](./TICKET-027-pagos-filters.md) | ✅ | ~3h | P2 |
| 028 | [Anulacion / edicion registros](./TICKET-028-anulacion-edicion.md) | ✅ | ~4h | P2 |
| 029 | [Interfaz de auditoria](./TICKET-029-audit-ui.md) | ✅ | ~2h | P2 |

---

## Sprint 5 - Seguridad (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 030 | [Autenticacion JWT](./TICKET-030-auth-jwt.md) | ✅ | ~4h | P1 |

---

## Sprint 6 - Hardening pre-producción (✅ Completado — con deuda menor)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 032 | [Proteger GETs con auth](./TICKET-032-auth-gate-gets.md) | ✅ | ~2h | P0 |
| 033 | [Hardening JWT_SECRET + bootstrap](./TICKET-033-jwt-secret-hardening.md) | ✅ | ~2h | P0 |
| 034 | [Rate-limit + Helmet](./TICKET-034-rate-limit-helmet.md) | ✅ | ~2h | P0 |
| 035 | [Deploy prep (Dockerfile + CI)](./TICKET-035-deploy-prep.md) | ✅ | ~4h | P1 |
| 036 | [Paginación](./TICKET-036-pagination.md) | 🟡 | ~3h | P2 |
| 037 | [Logs centralizados](./TICKET-037-logs-centralization.md) | ✅ | ~2h | P2 |
| 038 | [CI/CD pipeline](./TICKET-038-cicd-pipeline.md) | ✅ | ~3h | P2 |
| 039 | [Refresh tokens](./TICKET-039-refresh-tokens.md) | 🟡 | ~3h | P3 |

> **Notas Sprint 6**:
> - 032, 034, 037, 038: implementados y verificados en código.
> - 036 ✅: paginación unificada completada en todos los listados (TICKET-045).
> - 039 ✅: refresh tokens integrados en frontend (TICKET-046).

---

---

## Sprint 7 - Bugfix post-UAT (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 040 | [Edición de registros en Configuración](./TICKET-040-config-edit.md) | ✅ | ~3h | P1 |
| 041 | [Bancos: propietario como FK a config_agentes](./TICKET-041-bancos-propietario-fk.md) | ✅ | ~2h | P1 |
| 042 | [Importación masiva: batch append Sheets](./TICKET-042-import-batch-sheets.md) | ✅ | ~2h | P0 |
| 043 | [Pagos: autocomplete usuario ≥2 chars](./TICKET-043-pagos-user-combobox.md) | ✅ | ~2h | P2 |
| 044 | [Persistencia de comprobante en Cloudflare R2](./TICKET-044-receipt-storage-drive.md) | ✅ | ~3h | P1 |

---

## Sprint 8 - Deuda técnica post Sprint-6 (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 045 | [Unificar paginación en todos los listados](./TICKET-045-pagination-unification.md) | ✅ | ~3h | P2 |
| 046 | [Refresh tokens: integración frontend](./TICKET-046-refresh-tokens-frontend.md) | ✅ | ~2h | P2 |

---

## Sprint 9 - Identidad unificada y scoping por propietario (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 047 | [Unificar config_agentes como única fuente de identidad](./TICKET-047-unified-identity-agentes.md) | ✅ | ~5h | P0 |
| 048 | [banco_id como FK en pagos/ingresos/gastos/bancos](./TICKET-048-banco-id-fk.md) | ✅ | ~3h | P0 |
| 049 | [Scoping de bancos por propietario en Pagos](./TICKET-049-pagos-bancos-scoping.md) | ✅ | ~3h | P1 |
| 050 | [Scoping bancos en Ingresos/Gastos/Bancos saldos](./TICKET-050-scoping-ingresos-gastos-bancos.md) | ✅ | ~3h | P1 |
| 053 | [Migración histórica de banco_id](./TICKET-053-migracion-banco-id-historico.md) | ✅ | ~2h | P1 |
| 054 | [Migración config_auth_users → config_agentes](./TICKET-054-migracion-auth-users-agentes.md) | ✅ | ~2h | P0 |

---

## Sprint 10 - Migración de almacenamiento y documentación (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 051 | [Migrar comprobantes Drive → Cloudflare R2](./TICKET-051-receipts-r2-migration.md) | ✅ | ~3h | P1 |
| 052 | [Sincronizar documentación tras 40-46 + 047-054](./TICKET-052-docs-sync.md) | ✅ | ~2h | P2 |

---

## Sprint 11 - Pre-producción y Despliegue (✅ Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 055 | [Ejecución de migraciones pre-producción](./TICKET-055-migraciones-preproduccion.md) | ✅ | ~2h | P0 |
| 056 | [Despliegue a producción — Vercel + Railway](./TICKET-056-deploy-produccion.md) | ✅ | ~3h | P0 |

> **Nota Sprint 11**: cerrado. Backend en Railway y frontend en Vercel operativos (commits `02395cc`, `d0c79a6`, `9746cbb`, `1ef30ee`).

---

## Sprint 12 - Estabilización post-deploy (🔴 Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 057 | [Commitear hotfix migración headers legacy](./TICKET-057-commit-legacy-schema-hotfix.md) | 🔴 | ~30min | P1 |
| 058 | [Backup y rollback de Sheets + R2](./TICKET-058-backup-rollback-procedure.md) | 🔴 | ~2h | P1 |
| 059 | [Migrar IDs a `crypto.randomUUID()`](./TICKET-059-uuid-ids.md) | 🔴 | ~2h | P3 |

> **Nota Sprint 12**: 057 desbloquea CI/CD (cambios pendientes en working tree). 058 recomendado antes de pruebas reales con datos sensibles. 059 opcional.

---

## Sprint 13 - Rediseño módulo Balance (🔴 Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 060 | [Tabla `config_settings` + endpoint `caja_inicio_mes`](./TICKET-060-config-settings-table.md) | 🔴 | ~2h | P0 |
| 061 | [Helper `getAdminBankIds()`](./TICKET-061-admin-bank-ids-helper.md) | 🔴 | ~1.5h | P0 |
| 062 | [Rediseño `balance.service.js` con semántica cierre de día](./TICKET-062-balance-service-redesign.md) | 🔴 | ~5h | P0 |
| 063 | [`/api/balance` acepta `?fecha=YYYY-MM-DD`](./TICKET-063-balance-route-date-param.md) | 🔴 | ~1h | P0 |
| 064 | [Tests unitarios de `balance.service`](./TICKET-064-balance-service-tests.md) | 🔴 | ~3h | P0 |
| 065 | [Frontend `lib/api.ts`: tipos + filtro de fecha](./TICKET-065-frontend-api-balance-types.md) | 🔴 | ~1h | P1 |
| 066 | [UI Balance rediseñada (date-picker + 5 KPIs + 3 desgloses)](./TICKET-066-frontend-balance-ui.md) | 🔴 | ~4h | P1 |
| 067 | [UI Configuración: editor `caja_inicio_mes`](./TICKET-067-frontend-config-caja-inicio-mes.md) | 🔴 | ~1.5h | P1 |
| 068 | [Actualización documentaria del rediseño](./TICKET-068-docs-balance-redesign.md) | 🔴 | ~1.5h | P2 |
| 069 | [E2E + checklist UAT](./TICKET-069-balance-e2e-uat.md) | ✅ | ~2h | P2 |

> **Nota Sprint 13**: Orden sugerido 060 → 061 → 062 → 063 → 064 → 065 → 066 → 067 → 068 → 069. Antes de ejecutar 061 y 062 validar supuestos pendientes (criterio de "admin" en `config_bancos`, campos de fecha usados para "durante el día").

---

## Sprint 14 - Balance Mi Caja (agente) (🔴 Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 070 | [Backend: `getAgentCajaAt` en `balance.service`](./TICKET-070-balance-agent-caja-service.md) | 🔴 | ~2h | P1 |
| 071 | [Backend: ruta `GET /api/balance/mi-caja`](./TICKET-071-balance-mi-caja-route.md) | 🔴 | ~1h | P1 |
| 072 | [Backend: tests unitarios de `getAgentCajaAt`](./TICKET-072-balance-agent-caja-tests.md) | 🔴 | ~2h | P1 |
| 073 | [Frontend: tipos y cliente `getMiCaja` en `api.ts`](./TICKET-073-frontend-mi-caja-api-types.md) | 🔴 | ~1h | P1 |
| 074 | [Frontend: componente `MiCajaView` + integración en `/balance`](./TICKET-074-frontend-mi-caja-view.md) | 🔴 | ~3h | P1 |
| 075 | [Frontend: mostrar "Balance" en sidebar para agentes](./TICKET-075-sidebar-balance-agentes.md) | 🔴 | ~30min | P2 |
| 076 | [Docs + E2E + UAT "Mi Caja"](./TICKET-076-balance-mi-caja-e2e-docs.md) | 🔴 | ~2h | P2 |

> **Nota Sprint 14**: Orden sugerido 070 → 071 → 072 → 073 → 074 → 075 → 076. Backend (070-072) puede ejecutarse en paralelo con el frontend inicial (073). El 075 depende de 074 para poder probar la navegación. Cerrar 076 solo cuando todos los UAT pasen.

---

## Leyenda

| Simbolo | Significado |
|---------|-------------|
| ✅ | Completado |
| 🔴 | Pendiente |
| ⚠️ | Bloqueado / requiere decision |
| P0 | Blocker - sin esto no funciona |
| P1 | High - necesario para produccion |
| P2 | Medium - mejora significativa |
| P3 | Low - nice to have |
