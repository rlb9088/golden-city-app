# Golden City Backoffice

MVP del sistema de caja para Golden City.

## CI/CD

Workflow de GitHub Actions: `.github/workflows/test-and-build.yml`

- Ejecuta `backend/npm test` en pushes y PRs a `main` y `develop`
- Ejecuta `frontend/npm run lint` y `frontend/npm run build`
- Reporta `npm audit` sin bloquear el pipeline
- Valida `docker build` en pushes a `main`

Badge de Actions:
[![Tests & Build](https://github.com/rlb9088/golden-city-app/actions/workflows/test-and-build.yml/badge.svg)](https://github.com/rlb9088/golden-city-app/actions/workflows/test-and-build.yml)

## Estructura
- `/frontend`: Next.js + Vanilla CSS
- `/backend`: Express.js + Google Sheets API
- `/context`: Memoria y habilidades del agente

## Inicio Rápido

## Documentación

- [Guía de setup y despliegue](docs/setup-guide.md)

### Backend
1. `cd backend`
2. `npm install` (ya realizado)
3. Configurar `.env` basado en `.env.example`
4. `npm start` (requiere configurar script en package.json)

### Frontend
1. `cd frontend`
2. `npm install` (ya realizado)
3. `npm run dev`

## Reglas de Oro
- Todo movimiento se registra en Google Sheets.
- Priorizar velocidad operativa sobre perfección técnica.
- Consultar `/context/memory` antes de cambios estructurales.
