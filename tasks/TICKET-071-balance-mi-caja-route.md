# TICKET-071 — Backend: ruta `GET /api/balance/mi-caja`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1h
> **Dependencias**: TICKET-070

---

## Contexto

Con `getAgentCajaAt` ya implementada (TICKET-070), se necesita exponerla via HTTP para que el frontend pueda consumirla. El endpoint debe identificar al agente desde el token JWT (nunca por query param) para evitar que un agente vea datos de otro.

## Alcance

### 1. Controller — `balance.controller.js`

Agregar handler `getMiCaja` en [backend/controllers/balance.controller.js](../backend/controllers/balance.controller.js):

```js
async function getMiCaja(req, res) {
  const agente = req.auth.user;  // nombre del agente autenticado
  const fecha = req.validatedQuery?.fecha || null;
  const caja = await balanceService.getAgentCajaAt({ agente, fecha });
  res.json({ status: 'success', data: caja });
}
```

- `req.auth.user` = `auth.nombre || auth.username`, ya asignado por `auth.middleware.js:32`.
- No aceptar `agente` por query string ni body — la identidad siempre viene del token.

### 2. Ruta — `balance.routes.js`

En [backend/routes/balance.routes.js](../backend/routes/balance.routes.js) añadir la nueva ruta **antes** de `GET /:agente` para evitar colisión de rutas en Express:

```js
router.get('/mi-caja', verifyToken, requireAuth, validateQuery(balanceQuerySchema), controller.getMiCaja);
```

El orden correcto en el archivo:
```
GET /           → getGlobal
GET /mi-caja    → getMiCaja   ← nueva (debe ir antes de /:agente)
GET /:agente    → getByAgent
```

### 3. Schema

Reutilizar `balanceQuerySchema` existente en [backend/schemas/balance.schema.js](../backend/schemas/balance.schema.js) (ya acepta `fecha` opcional en formato `YYYY-MM-DD`). No se necesitan cambios en el schema.

## Criterios de aceptación

- [ ] `GET /api/balance/mi-caja` sin token → 401.
- [ ] `GET /api/balance/mi-caja` con token válido de agente → 200 con estructura `{ status, data: MiCajaSnapshot }`.
- [ ] `GET /api/balance/mi-caja?fecha=2026-01-15` → responde con snapshot al cierre de esa fecha.
- [ ] `GET /api/balance/mi-caja?fecha=fecha-invalida` → 400 (validación del schema existente).
- [ ] Ruta `GET /api/balance/:agente` sigue funcionando sin cambios.
- [ ] Ruta `GET /api/balance` (admin global) sigue funcionando sin cambios.

## Notas

- Si el `nombre` del usuario admin no tiene registros como agente, el endpoint responderá con `total: 0` y `bancos: []`. Documentado como comportamiento esperado.
- No se requiere middleware `requireAdmin` en esta ruta — cualquier usuario autenticado puede ver su propia caja.
