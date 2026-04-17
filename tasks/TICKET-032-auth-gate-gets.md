# TICKET-032: Proteger GETs financieros con autenticación JWT

> **Estado**: 🟢 COMPLETADO  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Blocker (seguridad crítica)  
> **Tipo**: Security

---

## Problema

Actualmente, los endpoints de lectura de datos financieros **no requieren autenticación**:
- `GET /api/pagos` — público, cualquiera lee todos los pagos
- `GET /api/ingresos` — público
- `GET /api/gastos` — público
- `GET /api/bancos` — público
- `GET /api/balance` y `GET /api/balance/:agente` — público
- `GET /api/config` — público (ok, necesario para dropdowns al hacer login)

Esto permite a cualquiera con la URL acceder a datos financieros sensibles **sin credenciales**.

El TICKET-030 (JWT auth) requería "Endpoints protegidos rechazan requests sin token" — esto contradice ese criterio.

---

## Solución

### Backend
Agregar middleware `verifyToken` a todos los GET de movimientos/balance:

1. **routes/pagos.routes.js**: cambiar `router.get('/', controller.getAll)` a `router.get('/', verifyToken, requireAuth, controller.getAll)`
2. **routes/ingresos.routes.js**: igual
3. **routes/gastos.routes.js**: igual
4. **routes/bancos.routes.js**: igual
5. **routes/balance.routes.js**: igual (ambos endpoints)
6. **routes/config.routes.js**: dejar `GET /api/config` público (necesario para dropdowns login), proteger `GET /api/config/:table` (ya lo está)

### Frontend
- Ya envía Bearer token en todos los requests ([lib/api.ts:101-114](../frontend/src/lib/api.ts#L101-L114))
- `BackendStatusBanner` ya detecta 401 y redirige a login
- Sin cambios necesarios

### Excepciones (sin auth)
- `GET /api/health` — ok público
- `POST /api/auth/login` — ok público
- `GET /api/config` — ok público (selectores en login)

---

## Archivos

Backend routes afectadas:
- `backend/routes/pagos.routes.js` — línea 9
- `backend/routes/ingresos.routes.js` — línea 9
- `backend/routes/gastos.routes.js` — línea 9
- `backend/routes/bancos.routes.js` — línea 9
- `backend/routes/balance.routes.js` — líneas 5-6

---

## Criterios de Aceptación

- [x] GET /api/pagos retorna 401 sin token válido
- [x] GET /api/ingresos retorna 401 sin token
- [x] GET /api/gastos retorna 401 sin token
- [x] GET /api/bancos retorna 401 sin token
- [x] GET /api/balance retorna 401 sin token
- [x] GET /api/balance/:agente retorna 401 sin token
- [x] GET /api/config sigue siendo público (dropdowns)
- [x] GET /api/config/:table requiere admin
- [x] Frontend sigue funcionando (ya envía token)
- [x] Requests autenticados con token válido funcionan normalmente

---

## Definición de Terminado

MVP ahora tiene credenciales reales (JWT); es incoherente dejar leer datos sin auth.
