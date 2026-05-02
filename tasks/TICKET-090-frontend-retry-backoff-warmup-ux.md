# TICKET-090 — Frontend: retry/backoff robusto y UX al despertar el backend

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 16 — Ajustes de balance, eliminación y estabilidad
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna (no bloquea ni se bloquea con TICKET-089)

---

## Contexto

Hoy [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) hace 2 reintentos con delay fijo de 250 ms y timeout de 10 s; cuando Railway tarda 10–20 s en responder en frío, el cliente cae a error y el `BackendStatusBanner` muestra "No podemos conectar con el backend" antes de que el servidor termine de despertar. Aunque TICKET-089 reduce el cold-start del backend, este ticket hace que el cliente sea tolerante a la primera ventana de arranque y comunique al usuario con un copy adecuado ("Conectando…", no "error").

## Alcance

### 1. Retry y backoff exponencial — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

- Reemplazar las constantes y la lógica de retry actuales:
  ```ts
  const DEFAULT_TIMEOUT_MS = 10_000;
  const RETRY_DELAY_MS = 250;
  // y `retries = 2` dentro de request()
  ```
  por:
  ```ts
  const DEFAULT_TIMEOUT_MS = 15_000;
  const WARMUP_TIMEOUT_MS = 30_000; // primer request tras carga
  const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000]; // 5 intentos
  ```
- En `request()`:
  - Tomar el delay de `RETRY_DELAYS_MS[attempt]` con fallback al último valor si attempt > length.
  - Aplicar backoff exponencial **solo** sobre errores de red/timeout (mantener el filtro `retryable` actual L201–202).
  - Detectar el "primer request" del lifecycle (flag módulo: `let hasWarmedUp = false;`) y usar `WARMUP_TIMEOUT_MS` mientras `hasWarmedUp === false`. Marcar `true` tras el primer 2xx.

### 2. Health check adaptativo

- En `checkBackendHealth()` (L368–384) y la constante `HEALTH_POLL_MS`:
  - Durante el primer minuto desde `mount` del provider/banner, hacer poll cada **5 s**.
  - Después, volver al `HEALTH_POLL_MS = 20_000` actual.
  - Implementar con un timer que tras 60 s resetea el intervalo.

### 3. UX del banner — `frontend/src/components/BackendStatusBanner.tsx`

- Introducir tres estados visuales:
  - `connected` (oculto, comportamiento actual).
  - `warmup`: visible amarillo, copy "Conectando con el servidor (puede tardar unos segundos la primera vez)…", sin CTA. Se muestra cuando el primer health check aún no responde 200 y el cliente todavía está dentro de la ventana de retries.
  - `error`: visible rojo, copy actual "No podemos conectar con el backend. Reintentaremos automáticamente." Solo cuando se agotaron los retries y el último error fue de red.
- Diferenciar los dos estados por timing: si `attempts < RETRY_DELAYS_MS.length` y el error fue de red → `warmup`; si se agotó → `error`.

### 4. Mensajes en `request()` y consumers

- Asegurar que el mensaje "No se pudo conectar con el backend." (L210) se devuelve solo cuando se agotan los reintentos. Mientras hay reintentos en curso, el código que muestra el toast/alerta no debería mostrar nada (el banner se encarga del feedback de conexión).
- Revisar páginas que llamen a `request()` y muestren el error inmediatamente (pagos, ingresos, gastos, balance) para que ignoren errores de red transitorios mientras el banner esté en `warmup`.

### 5. Tests

- Añadir o extender tests de [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) (`__tests__/api.test.ts` si existe) cubriendo:
  - Backoff exponencial con `RETRY_DELAYS_MS` (mock de `setTimeout`/`fetch`).
  - Primer request usa `WARMUP_TIMEOUT_MS`; segundo usa `DEFAULT_TIMEOUT_MS`.
  - Tras 5 reintentos fallidos, `request()` arroja con el mensaje esperado.

## Archivos a modificar

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)
- [frontend/src/components/BackendStatusBanner.tsx](../frontend/src/components/BackendStatusBanner.tsx)
- Cualquier consumer que mapee errores de red a alertas visibles (pagos/ingresos/gastos/balance).
- Tests asociados.

## Criterios de aceptación

- [ ] Con backend "dormido" (simular con `chrome devtools network throttling` + delay artificial de 12 s en `/api/health` la primera vez), el cliente no muestra error rojo: muestra el banner amarillo "Conectando…" hasta que el backend responde, luego desaparece.
- [ ] El primer request tras un page-load tolera hasta ~30 s antes de fallar definitivamente.
- [ ] Tras agotar los 5 reintentos, sí se muestra el banner rojo "No podemos conectar…".
- [ ] El `HEALTH_POLL` baja a 5 s durante el primer minuto y luego vuelve a 20 s.
- [ ] Tests verdes; `npm run typecheck` y `npm run lint` pasan.

## Notas

- No usar librerías externas para el retry (ej: `axios-retry`, `p-retry`); seguir con el `request()` interno.
- Mantener compatibilidad con AbortController y refresh-tokens (TICKET-046): el flujo de refresh debe seguir funcionando dentro del retry loop.
- Si el banner ya parpadea con la lógica actual al hacer hot reload en dev, validar que el nuevo flujo no empeora ese comportamiento.
