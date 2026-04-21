# TICKET-082 — Frontend: UI admin para `caja_inicio_mes` por banco de agente (+ lectura en Mi Caja)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: TICKET-081

---

## Contexto

Una vez que el backend expone los endpoints `GET/PUT /api/config/settings/caja_inicio_mes/banco/:bancoId` (TICKET-081), el admin necesita una UI para configurar el monto de arranque de mes de cada banco de agente. El agente solo debe poder consultar ese valor en su vista Mi Caja (modo lectura; no puede editarlo).

## Alcance

### 1. API client — [frontend/src/lib/api.ts](../frontend/src/lib/api.ts)

Añadir dos helpers:
```ts
getCajaInicioMesBanco(bancoId: string): Promise<{ value: number; fecha_efectiva: string | null }>
updateCajaInicioMesBanco(bancoId: string, payload: { value: number; fecha_efectiva: string }): Promise<void>
```

Seguir el mismo patrón que `getSetting` / `updateSetting` existentes en el mismo archivo.

### 2. UI Admin — [frontend/src/app/configuracion/page.tsx](../frontend/src/app/configuracion/page.tsx)

Nueva sección **"Caja inicial por banco de agente"** (añadir después de la sección "Ajustes generales" actual):

- Al montar, cargar la lista de bancos de agentes (filtrar los bancos donde `propietario === 'agente'` del endpoint existente de bancos) y para cada uno llamar a `getCajaInicioMesBanco(banco.id)`.
- Renderizar una lista agrupada por nombre de agente (si disponible) o por nombre de banco.
- Por cada banco: nombre del banco, input numérico `Monto inicial (S/)` (valor ≥ 0), input fecha `Fecha efectiva`, botón "Guardar".
- Al guardar: llamar a `updateCajaInicioMesBanco()` → mostrar `AlertBanner` de éxito o error, mismo patrón que la sección `caja_inicio_mes` global.
- La sección es **visible solo para admin** (la página `configuracion` ya es admin-only; no se necesita guard adicional).

### 3. Vista Agente (solo lectura) — [frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx)

En la tabla de bancos (`#mi-caja-banks-table`, líneas 34-55):
- Añadir una columna o nota debajo del nombre de cada banco que muestre: `Saldo inicial de mes: S/ X.XX` (obtenido de la respuesta de `getAgentCajaAt` o de una llamada a `getCajaInicioMesBanco`).
- Si `fecha_efectiva` es informativa, mostrarla en formato legible: `desde DD/MM/YYYY`.
- No incluir ningún input ni botón de edición para el agente.

## Archivos a modificar

- [frontend/src/lib/api.ts](../frontend/src/lib/api.ts) — helpers `getCajaInicioMesBanco` y `updateCajaInicioMesBanco`.
- [frontend/src/app/configuracion/page.tsx](../frontend/src/app/configuracion/page.tsx) — nueva sección admin.
- [frontend/src/app/balance/MiCajaView.tsx](../frontend/src/app/balance/MiCajaView.tsx) — columna/nota de saldo inicial por banco.

## Criterios de aceptación

- [ ] Admin puede ver y editar el monto inicial de cualquier banco de agente desde Configuración.
- [ ] Al guardar, el AlertBanner confirma éxito o muestra el error del backend.
- [ ] El agente ve en Mi Caja el "Saldo inicial de mes" de cada banco en modo lectura; no hay UI de edición.
- [ ] Tras que el admin modifique el valor, el agente ve el cambio reflejado al refrescar Mi Caja (F5 o botón Actualizar).
- [ ] Responsive: la nueva sección en Configuración funciona en móvil sin scroll horizontal.

## Notas

- No añadir nueva página ni nueva entrada en el sidebar; todo ocurre en `configuracion` (admin) y en `MiCajaView` (agente).
- Si la lista de bancos de agente puede ser larga, considerar cargar con un solo batch al montar la sección (no una llamada por banco).
- Seguir los patrones de estado (`useState`, `useEffect`, `AlertBanner`) ya establecidos en `configuracion/page.tsx` para consistencia.
