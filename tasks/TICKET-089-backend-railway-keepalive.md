# TICKET-089 — Backend: keep-alive y arranque rápido en Railway

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2.5h
> **Dependencias**: ninguna

---

## Contexto

Usuarios reportan demoras de varios segundos al abrir la app y, en algunos casos, el banner "No podemos conectar con el backend" antes de que Railway termine de despertar el contenedor. La causa principal es el **cold start** del plan Railway free, agravado por:

1. No hay healthcheck declarativo: Railway no detecta cuándo el contenedor está realmente listo.
2. [docker-entrypoint.sh](../docker-entrypoint.sh) no usa `exec` para Node, por lo que el proceso no recibe señales correctamente y Railway puede tardar en marcar el contenedor como sano.
3. No hay un mecanismo externo que mantenga el contenedor caliente.

Este ticket aplica una solución de tres frentes (configuración Railway + Dockerfile + cron externo) para reducir el cold start y la incidencia del mensaje de error. La parte de UX en frontend se aborda en TICKET-090.

## Alcance

### 1. Healthcheck declarativo en Railway

- Crear (o actualizar) [railway.json](../railway.json) en la raíz con la configuración:
  ```json
  {
    "$schema": "https://railway.app/railway.schema.json",
    "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
    "deploy": {
      "healthcheckPath": "/api/health",
      "healthcheckTimeout": 30,
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 3
    }
  }
  ```
- Si el repo ya tiene `railway.json`, fusionar respetando claves existentes.
- Documentar en `docs/DEPLOY.md` que el healthcheck apunta a `/api/health`.

### 2. `HEALTHCHECK` en Dockerfile

- En [Dockerfile](../Dockerfile), añadir antes del `CMD`/`ENTRYPOINT`:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
  ```
  (Usar `wget` ya disponible en `node:20-alpine`; si se prefiere `curl`, instalarlo en la etapa final con `RUN apk add --no-cache curl`.)
- Verificar que el puerto efectivo del backend dentro del contenedor sea `3001` (revisar `backend/index.js` y la variable `PORT`). Ajustar el comando si fuera distinto.

### 3. Arranque PID 1 con `exec` — [docker-entrypoint.sh](../docker-entrypoint.sh)

- Asegurar que la última instrucción que arranca el backend use `exec node ...` para que Node herede PID 1 y reciba `SIGTERM`/`SIGINT` directamente.
- Si el script arranca dos procesos (backend + frontend) con `wait`, mantenerlo pero usar `exec` en al menos el frontal y delegar señales con `trap`/`kill -TERM` al backend; alternativamente separar en dos contenedores si Railway lo permite.
- Verificar que el contenedor responde a `docker stop` en menos de 10 s (smoke local con `docker run` + `docker stop`).

### 4. Endpoint `/api/health` robusto — [backend/index.js](../backend/index.js)

- Confirmar que el handler L85–98 responde 200 en menos de 200 ms incluso bajo carga inicial (no debe consultar Sheets ni hacer I/O externo).
- Devolver JSON mínimo: `{ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }`.
- No incluir información sensible.

### 5. Cron externo (keep-alive)

- Documentar en un nuevo archivo [docs/keep-alive.md](../docs/keep-alive.md) (o sección en `docs/DEPLOY.md`):
  - Crear cuenta en https://cron-job.org (o equivalente gratuito).
  - Configurar un job HTTP GET cada 5 minutos a `https://<railway-domain>/api/health`.
  - Usar User-Agent descriptivo: `appgolden-keepalive/1.0`.
  - Incluir capturas o pasos detallados.
- Añadir variable `ALLOW_HEALTH_PROBE=true` (opcional) y filtrar en el endpoint para no devolver detalles cuando la petición no porta el header esperado, si se considera necesario por seguridad.

### 6. Métricas / verificación

- Tras desplegar, simular cold start: parar/desplegar de nuevo y medir tiempo del primer GET `/api/health` desde un cliente externo. Registrar el resultado en `docs/keep-alive.md`.
- Objetivo: primer request tras 30 min de inactividad < 3 s.

## Archivos a modificar

- [Dockerfile](../Dockerfile)
- [docker-entrypoint.sh](../docker-entrypoint.sh)
- [railway.json](../railway.json) (crear si no existe)
- [backend/index.js](../backend/index.js) (revisar handler `/api/health`)
- [docs/DEPLOY.md](../docs/DEPLOY.md)
- [docs/keep-alive.md](../docs/keep-alive.md) (nuevo)

## Criterios de aceptación

- [ ] `railway.json` con `healthcheckPath=/api/health` y timeout 30 s desplegado en producción.
- [ ] `docker build .` produce una imagen con `HEALTHCHECK` declarativo (`docker inspect` lo muestra).
- [ ] `docker stop` sobre el contenedor finaliza en < 10 s (señal recibida por Node).
- [ ] `GET /api/health` responde 200 en < 200 ms con body JSON mínimo.
- [ ] `docs/keep-alive.md` documenta el setup de cron-job.org paso a paso.
- [ ] Smoke en producción: tras 30 min de inactividad, primer request < 3 s.

## Notas

- Si el plan Railway free deja de cumplir SLA tras estos cambios, el siguiente paso (no en este ticket) sería evaluar upgrade a un plan pagado o migrar a Fly.io / Render.
- No exponer información sensible en `/api/health`.
- Mantener cualquier middleware de rate-limit (TICKET-034) compatible: `/api/health` debería estar excluido o tener un límite generoso para no bloquear al cron.
