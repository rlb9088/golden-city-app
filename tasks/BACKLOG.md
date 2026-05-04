# Backlog - Golden City Backoffice MVP

> **Ultima actualizacion**: 2026-05-05 (Sprint 17 cerrado)

---

## Resumen del Backlog

| Total | Completados | En progreso/Parcial | Pendientes |
|-------|-------------|---------------------|------------|
| 101 | 75 | 0 | 26 |

---

## Sprint 0 - Setup (âœ… Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 001 | [Inicializacion del repo](./TICKET-001-init-repo.md) | âœ… | ~2h |
| 002 | [Sheets Repository](./TICKET-002-sheets-repository.md) | âœ… | ~2h |
| 003 | [Middleware auth + validacion](./TICKET-003-middleware-auth-validation.md) | âœ… | ~1h |
| 004 | [Servicio de auditoria](./TICKET-004-audit-service.md) | âœ… | ~1h |
| 005 | [Timezone helper](./TICKET-005-timezone-helper.md) | âœ… | ~30min |

---

## Sprint 1 - Core (âœ… Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 006 | [Backend Pagos CRUD](./TICKET-006-backend-pagos.md) | âœ… | ~3h |
| 007 | [Backend Ingresos CRUD](./TICKET-007-backend-ingresos.md) | âœ… | ~2h |
| 008 | [Backend Gastos CRUD](./TICKET-008-backend-gastos.md) | âœ… | ~2h |
| 009 | [Backend Bancos (upsert)](./TICKET-009-backend-bancos.md) | âœ… | ~2h |
| 010 | [Backend Balance engine](./TICKET-010-backend-balance.md) | âœ… | ~2h |
| 011 | [Backend Config CRUD + seed](./TICKET-011-backend-config.md) | âœ… | ~3h |
| 013 | [Frontend Design system + layout](./TICKET-013-frontend-design-system.md) | âœ… | ~3h |
| 014 | [Frontend Dashboard balance](./TICKET-014-frontend-balance.md) | âœ… | ~3h |
| 016 | [Frontend Ingresos](./TICKET-016-frontend-ingresos.md) | âœ… | ~2h |
| 017 | [Frontend Gastos](./TICKET-017-frontend-gastos.md) | âœ… | ~2h |
| 018 | [Frontend Bancos](./TICKET-018-frontend-bancos.md) | âœ… | ~2h |
| 019 | [Frontend Configuracion](./TICKET-019-frontend-config.md) | âœ… | ~3h |

---

## Sprint 2 - OCR (âœ… Completado)

| # | Ticket | Estado | Esfuerzo |
|---|--------|--------|----------|
| 012 | [Backend OCR pipeline](./TICKET-012-backend-ocr.md) | âœ… | ~4h |
| 015 | [Frontend Pagos + OCR](./TICKET-015-frontend-pagos-ocr.md) | âœ… | ~4h |

---

## Sprint 3 - Integracion y Hardening (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 020 | [Preparar Google Sheets](./TICKET-020-sheets-setup.md) | âœ… | ~2h | P0 |
| 021 | [Verificacion E2E con Sheets](./TICKET-021-e2e-sheets-verification.md) | âœ… | ~3h | P0 |
| 022 | [Error handling robusto](./TICKET-022-error-handling.md) | âœ… | ~3h | P1 |
| 023 | [Validacion referencial](./TICKET-023-referential-validation.md) | âœ… | ~2h | P1 |
| 024 | [Loading states y UX feedback](./TICKET-024-ux-loading-feedback.md) | âœ… | ~2h | P2 |
| 025 | [Responsive design](./TICKET-025-responsive-design.md) | âœ… | ~3h | P2 |
| 026 | [Guia de setup](./TICKET-026-setup-guide.md) | âœ… | ~2h | P1 |
| 031 | [Fix removeFromTable (bug)](./TICKET-031-fix-remove-config.md) | âœ… | ~2h | P1 |

---

## Sprint 4 - Funcionalidad Avanzada (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 027 | [Filtros en tabla de pagos](./TICKET-027-pagos-filters.md) | âœ… | ~3h | P2 |
| 028 | [Anulacion / edicion registros](./TICKET-028-anulacion-edicion.md) | âœ… | ~4h | P2 |
| 029 | [Interfaz de auditoria](./TICKET-029-audit-ui.md) | âœ… | ~2h | P2 |

---

## Sprint 5 - Seguridad (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 030 | [Autenticacion JWT](./TICKET-030-auth-jwt.md) | âœ… | ~4h | P1 |

---

## Sprint 6 - Hardening pre-producciÃ³n (âœ… Completado â€” con deuda menor)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 032 | [Proteger GETs con auth](./TICKET-032-auth-gate-gets.md) | âœ… | ~2h | P0 |
| 033 | [Hardening JWT_SECRET + bootstrap](./TICKET-033-jwt-secret-hardening.md) | âœ… | ~2h | P0 |
| 034 | [Rate-limit + Helmet](./TICKET-034-rate-limit-helmet.md) | âœ… | ~2h | P0 |
| 035 | [Deploy prep (Dockerfile + CI)](./TICKET-035-deploy-prep.md) | âœ… | ~4h | P1 |
| 036 | [PaginaciÃ³n](./TICKET-036-pagination.md) | ðŸŸ¡ | ~3h | P2 |
| 037 | [Logs centralizados](./TICKET-037-logs-centralization.md) | âœ… | ~2h | P2 |
| 038 | [CI/CD pipeline](./TICKET-038-cicd-pipeline.md) | âœ… | ~3h | P2 |
| 039 | [Refresh tokens](./TICKET-039-refresh-tokens.md) | ðŸŸ¡ | ~3h | P3 |

> **Notas Sprint 6**:
> - 032, 034, 037, 038: implementados y verificados en cÃ³digo.
> - 036 âœ…: paginaciÃ³n unificada completada en todos los listados (TICKET-045).
> - 039 âœ…: refresh tokens integrados en frontend (TICKET-046).

---

---

## Sprint 7 - Bugfix post-UAT (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 040 | [EdiciÃ³n de registros en ConfiguraciÃ³n](./TICKET-040-config-edit.md) | âœ… | ~3h | P1 |
| 041 | [Bancos: propietario como FK a config_agentes](./TICKET-041-bancos-propietario-fk.md) | âœ… | ~2h | P1 |
| 042 | [ImportaciÃ³n masiva: batch append Sheets](./TICKET-042-import-batch-sheets.md) | âœ… | ~2h | P0 |
| 043 | [Pagos: autocomplete usuario â‰¥2 chars](./TICKET-043-pagos-user-combobox.md) | âœ… | ~2h | P2 |
| 044 | [Persistencia de comprobante en Cloudflare R2](./TICKET-044-receipt-storage-drive.md) | âœ… | ~3h | P1 |

---

## Sprint 8 - Deuda tÃ©cnica post Sprint-6 (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 045 | [Unificar paginaciÃ³n en todos los listados](./TICKET-045-pagination-unification.md) | âœ… | ~3h | P2 |
| 046 | [Refresh tokens: integraciÃ³n frontend](./TICKET-046-refresh-tokens-frontend.md) | âœ… | ~2h | P2 |

---

## Sprint 9 - Identidad unificada y scoping por propietario (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 047 | [Unificar config_agentes como Ãºnica fuente de identidad](./TICKET-047-unified-identity-agentes.md) | âœ… | ~5h | P0 |
| 048 | [banco_id como FK en pagos/ingresos/gastos/bancos](./TICKET-048-banco-id-fk.md) | âœ… | ~3h | P0 |
| 049 | [Scoping de bancos por propietario en Pagos](./TICKET-049-pagos-bancos-scoping.md) | âœ… | ~3h | P1 |
| 050 | [Scoping bancos en Ingresos/Gastos/Bancos saldos](./TICKET-050-scoping-ingresos-gastos-bancos.md) | âœ… | ~3h | P1 |
| 053 | [MigraciÃ³n histÃ³rica de banco_id](./TICKET-053-migracion-banco-id-historico.md) | âœ… | ~2h | P1 |
| 054 | [MigraciÃ³n config_auth_users â†’ config_agentes](./TICKET-054-migracion-auth-users-agentes.md) | âœ… | ~2h | P0 |

---

## Sprint 10 - MigraciÃ³n de almacenamiento y documentaciÃ³n (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 051 | [Migrar comprobantes Drive â†’ Cloudflare R2](./TICKET-051-receipts-r2-migration.md) | âœ… | ~3h | P1 |
| 052 | [Sincronizar documentaciÃ³n tras 40-46 + 047-054](./TICKET-052-docs-sync.md) | âœ… | ~2h | P2 |

---

## Sprint 11 - Pre-producciÃ³n y Despliegue (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 055 | [EjecuciÃ³n de migraciones pre-producciÃ³n](./TICKET-055-migraciones-preproduccion.md) | âœ… | ~2h | P0 |
| 056 | [Despliegue a producciÃ³n â€” Vercel + Railway](./TICKET-056-deploy-produccion.md) | âœ… | ~3h | P0 |

> **Nota Sprint 11**: cerrado. Backend en Railway y frontend en Vercel operativos (commits `02395cc`, `d0c79a6`, `9746cbb`, `1ef30ee`).

---

## Sprint 12 - EstabilizaciÃ³n post-deploy (ðŸ”´ Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 057 | [Commitear hotfix migraciÃ³n headers legacy](./TICKET-057-commit-legacy-schema-hotfix.md) | ðŸ”´ | ~30min | P1 |
| 058 | [Backup y rollback de Sheets + R2](./TICKET-058-backup-rollback-procedure.md) | ðŸ”´ | ~2h | P1 |
| 059 | [Migrar IDs a `crypto.randomUUID()`](./TICKET-059-uuid-ids.md) | ðŸ”´ | ~2h | P3 |

> **Nota Sprint 12**: 057 desbloquea CI/CD (cambios pendientes en working tree). 058 recomendado antes de pruebas reales con datos sensibles. 059 opcional.

---

## Sprint 13 - RediseÃ±o mÃ³dulo Balance (ðŸ”´ Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 060 | [Tabla `config_settings` + endpoint `caja_inicio_mes`](./TICKET-060-config-settings-table.md) | ðŸ”´ | ~2h | P0 |
| 061 | [Helper `getAdminBankIds()`](./TICKET-061-admin-bank-ids-helper.md) | ðŸ”´ | ~1.5h | P0 |
| 062 | [RediseÃ±o `balance.service.js` con semÃ¡ntica cierre de dÃ­a](./TICKET-062-balance-service-redesign.md) | ðŸ”´ | ~5h | P0 |
| 063 | [`/api/balance` acepta `?fecha=YYYY-MM-DD`](./TICKET-063-balance-route-date-param.md) | ðŸ”´ | ~1h | P0 |
| 064 | [Tests unitarios de `balance.service`](./TICKET-064-balance-service-tests.md) | ðŸ”´ | ~3h | P0 |
| 065 | [Frontend `lib/api.ts`: tipos + filtro de fecha](./TICKET-065-frontend-api-balance-types.md) | ðŸ”´ | ~1h | P1 |
| 066 | [UI Balance rediseÃ±ada (date-picker + 5 KPIs + 3 desgloses)](./TICKET-066-frontend-balance-ui.md) | ðŸ”´ | ~4h | P1 |
| 067 | [UI ConfiguraciÃ³n: editor `caja_inicio_mes`](./TICKET-067-frontend-config-caja-inicio-mes.md) | ðŸ”´ | ~1.5h | P1 |
| 068 | [ActualizaciÃ³n documentaria del rediseÃ±o](./TICKET-068-docs-balance-redesign.md) | ðŸ”´ | ~1.5h | P2 |
| 069 | [E2E + checklist UAT](./TICKET-069-balance-e2e-uat.md) | âœ… | ~2h | P2 |

> **Nota Sprint 13**: Orden sugerido 060 â†’ 061 â†’ 062 â†’ 063 â†’ 064 â†’ 065 â†’ 066 â†’ 067 â†’ 068 â†’ 069. Antes de ejecutar 061 y 062 validar supuestos pendientes (criterio de "admin" en `config_bancos`, campos de fecha usados para "durante el dÃ­a").

---

## Sprint 14 - Balance Mi Caja (agente) (ðŸ”´ Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 070 | [Backend: `getAgentCajaAt` en `balance.service`](./TICKET-070-balance-agent-caja-service.md) | ðŸ”´ | ~2h | P1 |
| 071 | [Backend: ruta `GET /api/balance/mi-caja`](./TICKET-071-balance-mi-caja-route.md) | ðŸ”´ | ~1h | P1 |
| 072 | [Backend: tests unitarios de `getAgentCajaAt`](./TICKET-072-balance-agent-caja-tests.md) | ðŸ”´ | ~2h | P1 |
| 073 | [Frontend: tipos y cliente `getMiCaja` en `api.ts`](./TICKET-073-frontend-mi-caja-api-types.md) | ðŸ”´ | ~1h | P1 |
| 074 | [Frontend: componente `MiCajaView` + integraciÃ³n en `/balance`](./TICKET-074-frontend-mi-caja-view.md) | ðŸ”´ | ~3h | P1 |
| 075 | [Frontend: mostrar "Balance" en sidebar para agentes](./TICKET-075-sidebar-balance-agentes.md) | ðŸ”´ | ~30min | P2 |
| 076 | [Docs + E2E + UAT "Mi Caja"](./TICKET-076-balance-mi-caja-e2e-docs.md) | ðŸ”´ | ~2h | P2 |

> **Nota Sprint 14**: Orden sugerido 070 â†’ 071 â†’ 072 â†’ 073 â†’ 074 â†’ 075 â†’ 076. Backend (070-072) puede ejecutarse en paralelo con el frontend inicial (073). El 075 depende de 074 para poder probar la navegaciÃ³n. Cerrar 076 solo cuando todos los UAT pasen.

---

## Sprint 15 - Ajustes UX & caja por banco (ðŸ”´ Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 077 | [Fix: calendario nativo en Balance (desktop)](./TICKET-077-fix-balance-date-picker-desktop.md) | ðŸ”´ | ~0.5h | P1 |
| 078 | [Balance: tablas responsivas en mÃ³vil](./TICKET-078-balance-tablas-responsivas-movil.md) | ðŸ”´ | ~2.5h | P1 |
| 079 | [OCR: interpretar AM/PM â†’ hora en 24h](./TICKET-079-ocr-hora-am-pm-24h.md) | ðŸ”´ | ~1.5h | P1 |
| 080 | [Login: rediseÃ±o copy e info cards](./TICKET-080-login-copy-redesign.md) | ðŸ”´ | ~1h | P2 |
| 081 | [Backend: `caja_inicio_mes` por banco de agente](./TICKET-081-backend-caja-inicio-mes-por-banco-agente.md) | ðŸ”´ | ~3.5h | P0 |
| 082 | [Frontend: UI `caja_inicio_mes` por banco de agente](./TICKET-082-frontend-caja-inicio-mes-por-banco-agente.md) | ðŸ”´ | ~2h | P1 |

> **Nota Sprint 15**: Los tickets 077-080 son independientes entre sÃ­ y pueden ejecutarse en cualquier orden. El 082 depende del 081. Orden sugerido: 077 â†’ 080 â†’ 079 â†’ 078 â†’ 081 â†’ 082.

---

## Sprint 16 - Ajustes de balance, eliminaciÃ³n y estabilidad (ðŸ”´ Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 083 | [Backend: `cajaDisponible` + suma de gastos en `balanceAcumulado`](./TICKET-083-backend-caja-disponible-balance-acumulado.md) | âœ… | ~2h | P1 |
| 084 | [Frontend: dashboard con "Caja disponible" y nuevo Balance acumulado](./TICKET-084-frontend-caja-disponible-balance-ui.md) | âœ… | ~1.5h | P1 |
| 085 | [Backend: hard delete en Pagos, Ingresos y Gastos](./TICKET-085-backend-hard-delete-pagos-ingresos-gastos.md) | âœ… | ~3h | P1 |
| 086 | [Frontend Pagos: reemplazar "Anular" por "Eliminar"](./TICKET-086-frontend-pagos-eliminar.md) | âœ… | ~2h | P1 |
| 087 | [Frontend Ingresos: reemplazar "Anular" por "Eliminar"](./TICKET-087-frontend-ingresos-eliminar.md) | âœ… | ~1.5h | P1 |
| 088 | [Frontend Gastos: reemplazar "Anular" por "Eliminar"](./TICKET-088-frontend-gastos-eliminar.md) | âœ… | ~1.5h | P1 |
| 089 | [Backend: keep-alive y arranque rÃ¡pido en Railway](./TICKET-089-backend-railway-keepalive.md) | âœ… | ~2.5h | P1 |
| 090 | [Frontend: retry/backoff robusto y UX warmup](./TICKET-090-frontend-retry-backoff-warmup-ux.md) | âœ… | ~2h | P1 |
| 091 | [Backend: detecciÃ³n de pagos duplicados al crear](./TICKET-091-backend-deteccion-pagos-duplicados.md) | âœ… | ~2.5h | P1 |
| 092 | [Frontend: UX anti-duplicados al registrar pago](./TICKET-092-frontend-ux-pagos-duplicados.md) | âœ… | ~2.5h | P1 |

> **Nota Sprint 16**: âœ… Completado (2026-05-02). Todos los tickets implementados y auditados: balance con `cajaDisponible`, hard delete con auditorÃ­a, eliminaciÃ³n en 3 mÃ³dulos frontend, keep-alive Railway, retry/backoff con warmup UX, y detecciÃ³n de duplicados con modal de confirmaciÃ³n.

---

## Sprint 17 - Totales por caja e indicadores derivados de Balance (âœ… Completado)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 093 | [Foundation: schema y patrÃ³n "totales por caja"](./TICKET-093-foundation-totales-por-caja-schema.md) | âœ… | ~2h | P0 |
| 094 | [MÃ³dulo "DepÃ³sitos Totales" (full-stack)](./TICKET-094-modulo-depositos-totales-fullstack.md) | âœ… | ~5h | P0 |
| 095 | [MÃ³dulo "Retiros Totales" (full-stack)](./TICKET-095-modulo-retiros-totales-fullstack.md) | âœ… | ~3h | P0 |
| 096 | [MÃ³dulo "Bonos Totales" (full-stack)](./TICKET-096-modulo-bonos-totales-fullstack.md) | âœ… | ~3h | P0 |
| 097 | [MÃ³dulo "Retiros No Pagados" (full-stack)](./TICKET-097-modulo-retiros-no-pagados-fullstack.md) | âœ… | ~3h | P0 |
| 098 | [Balance: indicadores dÃ­a/acumulado](./TICKET-098-balance-indicadores-dia-acumulado.md) | âœ… | ~6h | P0 |
| 099 | [Balance: variaciÃ³n de caja dÃ­a y acumulada](./TICKET-099-balance-variacion-caja.md) | âœ… | ~5h | P1 |
| 100 | [Balance: detalle por caja (dÃ­a y acumulado)](./TICKET-100-balance-detalle-por-caja.md) | âœ… | ~4h | P1 |
| 101 | [DocumentaciÃ³n Sprint 17](./TICKET-101-documentacion-sprint-17.md) | âœ… | ~2h | P0 |

> **Nota Sprint 17**: Total ~33h. Orden de ejecuciÃ³n sugerido: 093 â†’ 094 â†’ (095, 096, 097 en paralelo si hay agentes disponibles, todos dependen solo de 094 como referencia de patrÃ³n) â†’ 098 â†’ (099 y 100 pueden ejecutarse en paralelo) â†’ 101 al cierre. TICKET-094 establece el patrÃ³n de implementaciÃ³n que 095/096/097 replican mecÃ¡nicamente. Permisos de los 4 mÃ³dulos nuevos: **admin-only en POST y GET** (mÃ¡s restrictivo que Bancos).
> **Estado final**: Sprint 17 cerrado al 100%. 093-101 completados y validados; el sistema quedó documentado, auditado y con los 4 módulos de totales por caja alineados con Balance.

---

## Leyenda

| Simbolo | Significado |
|---------|-------------|
| âœ… | Completado |
| ðŸ”´ | Pendiente |
| âš ï¸ | Bloqueado / requiere decision |
| P0 | Blocker - sin esto no funciona |
| P1 | High - necesario para produccion |
| P2 | Medium - mejora significativa |
| P3 | Low - nice to have |

