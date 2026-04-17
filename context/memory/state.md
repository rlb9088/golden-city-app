# Estado del Proyecto - Golden City Backoffice

## Fecha: 2026-04-16

## Hitos Completados
- [x] Todas las skills requeridas instaladas (10 en total)
- [x] Inicializacion de proyecto Next.js + Express
- [x] Backend: 7 modulos completos (pagos, ingresos, gastos, bancos, balance, config, OCR)
- [x] Frontend: 6 paginas completas (balance, pagos, ingresos, gastos, bancos, configuracion)
- [x] Design system dark premium implementado + responsive
- [x] OCR pipeline con Google Vision + Tesseract.js fallback
- [x] Auditoria en toda mutacion
- [x] Documentacion completa del proyecto (PRD, arquitectura, tech-stack, decisiones, backlog)
- [x] Google Sheets real verificado end-to-end con reporte documentado
- [x] Error handling robusto (AppError hierarchy, retry, error handler global)
- [x] Validacion referencial no bloqueante en pagos, ingresos y gastos
- [x] UX resilience (timeout, retry frontend, health polling, skeletons)
- [x] Responsive design (sidebar mobile, hamburger, backdrop)

## Estado Actual
- 25 de 31 tickets completados
- El sistema funciona end-to-end contra Google Sheets real
- Bug conocido: removeFromTable no borra de Sheets (TICKET-031)

## Proximos Pasos
1. Fix removeFromTable bug (TICKET-031) - P1
2. Guia de setup (TICKET-026) - P1
3. Filtros en pagos (TICKET-027) - P2
4. Anulacion/edicion registros (TICKET-028) - P2
5. Interfaz de auditoria (TICKET-029) - P2
6. Autenticacion JWT (TICKET-030) - P1

## Documentacion del Proyecto
- `docs/PRD.md` - Product Requirements Document
- `docs/architecture.md` - Arquitectura completa (v1.1)
- `docs/tech-stack.md` - Stack tecnologico
- `docs/decisions.md` - Decisiones tecnicas / 13 ADRs (v1.1)
- `tasks/BACKLOG.md` - Indice del backlog
- `tasks/TICKET-*.md` - 31 tickets (25 completados, 6 pendientes)

## Notas Tecnicas
- TypeScript en frontend, JavaScript CommonJS en backend
- Persistencia dual: Google Sheets (prod) / in-memory (dev)
- Auth por headers (placeholder) - requiere JWT para produccion
- Verificacion E2E automatizada disponible en `backend/scripts/verifySheetsE2E.js`
- Bug: config.service.js::removeFromTable() solo borra de seed data, no de Sheets

## Deuda Tecnica (menor)
- Headers de tablas definidos en 2 sitios (config.service.js y sheetsSchema.js)
- console.log DEBUG en ocr.service.js no gateado por NODE_ENV
- driveInstance creada pero no usada en sheetsClient.js
- bancos.service.js no valida referencia del banco en config
