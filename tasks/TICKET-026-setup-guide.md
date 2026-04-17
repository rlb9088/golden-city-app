# TICKET-026: Guía de setup y despliegue

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 3 — Docs  
> **Esfuerzo**: ~2h  
> **Prioridad**: P1  
> **Completado en**: 2026-04-16

---

## Objetivo
Documentar paso a paso cómo configurar el proyecto desde cero, incluyendo Google Cloud, Google Sheets, y despliegue.

## Archivos
- `docs/setup-guide.md` — (NEW)

## Contenido esperado
1. **Pre-requisitos**: Node.js, npm, cuenta Google Cloud
2. **Configuración de Google Cloud**:
   - Crear proyecto
   - Habilitar APIs (Sheets, Vision, Drive)
   - Crear Service Account y descargar JSON
3. **Configuración de Google Sheets**:
   - Crear spreadsheet
   - Crear las 11 hojas con headers
   - Compartir con Service Account
4. **Configuración del proyecto**:
   - Clonar repo
   - Copiar clave JSON a `backend/keys/`
   - Configurar `backend/.env`
   - npm install en frontend y backend
5. **Arranque**:
   - `npm run dev` en backend (puerto 3001)
   - `npm run dev` en frontend (puerto 3000)
6. **Verificación**: health check, crear un pago de prueba
7. **Despliegue** (para futuro): opciones recomendadas

## Dependencias
- TICKET-020

## Criterios de Aceptación
- [ ] Un developer puede seguir la guía y tener el sistema funcionando en <30 min
- [ ] Todos los pasos son verificables (con checks)
- [ ] Screenshots de las pantallas de Google Cloud Console (opcional)

## Definición de Terminado
- Guía probada por alguien que no ha tocado el proyecto antes
