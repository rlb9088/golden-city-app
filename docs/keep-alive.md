# Keep-Alive — Backend Railway (plan free)

El plan free de Railway duerme el contenedor tras un período de inactividad. Este documento describe el cron externo que lo mantiene caliente y cómo verificar que funciona.

## Endpoint objetivo

```
GET https://<railway-domain>/api/health
```

Respuesta esperada (200 OK):

```json
{ "status": "ok", "uptime": 123.45, "timestamp": "2026-05-02T00:00:00.000Z" }
```

## Setup en cron-job.org

1. Crear cuenta gratuita en [https://cron-job.org](https://cron-job.org).
2. Ir a **Cronjobs → Create cronjob**.
3. Completar los campos:

   | Campo            | Valor                                           |
   |------------------|-------------------------------------------------|
   | Title            | `appgolden-keepalive`                           |
   | URL              | `https://<railway-domain>/api/health`           |
   | Schedule         | Every 5 minutes (`*/5 * * * *`)                 |
   | Request method   | GET                                             |
   | User-Agent       | `appgolden-keepalive/1.0`                       |
   | Timeout          | 30 s                                            |
   | Success codes    | 200                                             |

4. Guardar y activar el job.
5. En la pestaña **History**, verificar que el primer disparo devuelve 200 antes de continuar.

## Verificación de cold start

Procedimiento para medir el tiempo de arranque tras inactividad:

1. Detener o reiniciar el servicio desde el dashboard de Railway (simula cold start).
2. Desde un cliente externo (curl, browser), hacer:
   ```bash
   time curl -s https://<railway-domain>/api/health
   ```
3. Registrar el tiempo de respuesta del primer request.

### Resultados medidos

| Fecha      | Tiempo primer request tras 30 min inactividad | Cumple objetivo (< 3 s) |
|------------|-----------------------------------------------|--------------------------|
| (pendiente de medir tras deploy) | — | — |

## Notas

- El endpoint `/api/health` está excluido del rate limiter global (`skip` en `index.js`), por lo que el cron no genera 429 aunque dispare frecuentemente.
- No incluir credenciales ni tokens en el job: el endpoint es público y no requiere autenticación.
- Si el plan Railway cambia o se migra a Fly.io / Render, actualizar la URL del job en cron-job.org.
