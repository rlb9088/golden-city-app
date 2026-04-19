# TICKET-050: Scoping de bancos en Ingresos, Gastos y Bancos (saldos)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~3h
> **Prioridad**: P1

---

## Problema

Todas las secciones admin (`/ingresos`, `/gastos`, `/bancos`) muestran la lista completa de bancos sin filtrar por propietario. El requerimiento pide:

- **Ingresos** (admin only): al seleccionar el agente destino, el combo de banco debe filtrarse a los bancos de ese agente.
- **Gastos** (admin only): el combo banco debe mostrar **sólo los bancos del admin logueado**.
- **Bancos (saldos)** (admin only): el combo banco debe mostrar **sólo los bancos del admin logueado**.

---

## Solución

Reusar el endpoint `GET /api/bancos/scoped?agente_id=…` que introduce TICKET-049.

### Frontend

1. **`/ingresos`**:
   - Combo "Agente" ya existe → al cambiar, llamar `GET /api/bancos/scoped?agente_id=<id>` y poblar el combo banco con el resultado.
   - Si no hay agente seleccionado, el combo banco queda deshabilitado con placeholder "Seleccione un agente primero".
2. **`/gastos`**:
   - Al cargar, llamar `GET /api/bancos/scoped` (sin agente_id → devuelve bancos del admin logueado).
   - Combo banco con ese scope.
3. **`/bancos`** (formulario de saldo):
   - Al cargar, llamar `GET /api/bancos/scoped` (sin agente_id → bancos del admin logueado).
   - Combo banco con ese scope.
   - La tabla de saldos (lectura) sigue mostrando todos los saldos (admin tiene visibilidad total).

### Backend

1. **Ingresos POST / PUT**: validar que `banco_id` pertenezca al `agente_id` del ingreso (403 si no).
2. **Gastos POST / PUT**: validar que `banco_id` pertenezca al admin logueado (403 si no).
3. **Bancos POST (saldo)**: validar que `banco_id` pertenezca al admin logueado (403 si no).

---

## Archivos

- `backend/services/{ingresos,gastos,bancos}.service.js` (check de ownership)
- `backend/controllers/{ingresos,gastos,bancos}.controller.js`
- `backend/tests/*.test.js`
- `frontend/src/lib/api.ts`
- `frontend/src/app/{ingresos,gastos,bancos}/page.tsx`

## Dependencias

- **Requiere TICKET-047, TICKET-048, TICKET-049** (endpoint `bancos/scoped` y user.id).

## Criterios de Aceptación

- [ ] Ingresos: combo banco cambia según el agente seleccionado.
- [ ] Gastos: combo banco muestra sólo los bancos del admin logueado.
- [ ] Bancos (saldos): combo banco muestra sólo los bancos del admin logueado.
- [ ] Backend rechaza con 403 operaciones con `banco_id` fuera del scope esperado.
- [ ] Tests cubren cada caso cruzado.

## Definición de Terminado

- Las tres secciones admin respetan el scoping de bancos.
- La tabla de saldos sigue mostrando la vista completa (lectura admin).
