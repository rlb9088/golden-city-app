# Backlog - Golden City Backoffice MVP

> **Ultima actualizacion**: 2026-04-16

---

## Resumen del Backlog

| Total | Completados | Pendientes |
|-------|-------------|------------|
| 31 | 31 | 0 |

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

## Sprint 6 - Hardening pre-producción (🔴 Pendiente)

| # | Ticket | Estado | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 032 | [Proteger GETs con auth](./TICKET-032-auth-gate-gets.md) | 🔴 | ~2h | P0 |
| 033 | [Hardening JWT_SECRET + bootstrap](./TICKET-033-jwt-secret-hardening.md) | ✅ | ~2h | P0 |
| 034 | [Rate-limit + Helmet](./TICKET-034-rate-limit-helmet.md) | 🔴 | ~2h | P0 |
| 035 | [Deploy prep (Dockerfile + CI)](./TICKET-035-deploy-prep.md) | ✅ | ~4h | P1 |
| 036 | [Paginación](./TICKET-036-pagination.md) | 🔴 | ~3h | P2 |
| 037 | [Logs centralizados](./TICKET-037-logs-centralization.md) | 🔴 | ~2h | P2 |
| 038 | [CI/CD pipeline](./TICKET-038-cicd-pipeline.md) | 🔴 | ~3h | P2 |
| 039 | [Refresh tokens](./TICKET-039-refresh-tokens.md) | 🔴 | ~3h | P3 |

---

## Orden de Ejecucion Recomendado (Sprint 6)

**Prioritario (bloquea producción)**:
```
TICKET-032 (auth GETs)
TICKET-033 (JWT_SECRET hardening)
TICKET-034 (rate-limit + helmet)
TICKET-035 (deploy prep + Dockerfile)
```

**Importante (antes de abrir a usuarios)**:
```
TICKET-036 (paginación)
TICKET-037 (logs centralizados)
TICKET-038 (CI/CD)
```

**Post-lanzamiento**:
```
TICKET-039 (refresh tokens)
```

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
