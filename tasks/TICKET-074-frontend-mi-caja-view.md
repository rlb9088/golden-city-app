# TICKET-074 — Frontend: vista "Mi Caja" para agentes en `/balance`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P1
> **Esfuerzo estimado**: ~3h
> **Dependencias**: TICKET-073

---

## Contexto

La pestaña `/balance` hoy muestra "Acceso restringido" a cualquier usuario que no sea admin. Los agentes necesitan ver su vista personal "Mi Caja" dentro de esa misma pestaña.

## Alcance

### 1. Componente `MiCajaView`

Crear `frontend/src/app/balance/MiCajaView.tsx`.

**Props**: ninguna — consume `useAuth()` internamente para obtener el nombre del agente.

**Estructura visual**:

```
┌─ Header ────────────────────────────────────────────┐
│ Título: "Mi Caja"                                   │
│ Subtítulo: modo label (igual que vista admin)       │
│ Date-picker + botón Limpiar (idéntico a vista admin)│
└─────────────────────────────────────────────────────┘

┌─ KPI ───────────────────────┐
│ StatsCard "Mi caja"         │  ← total (variant por signo)
└─────────────────────────────┘

┌─ Sección 1: Movimiento de caja ────────────────────┐
│ Tabla 2 columnas:                                   │
│   Monto inicial del día  │  S/ xxx.xx              │
│   Pagos totales del día  │  S/ xxx.xx              │
│   Saldo total de caja    │  S/ xxx.xx (bold)       │
└─────────────────────────────────────────────────────┘

┌─ Sección 2: Balance por Banco ─────────────────────┐
│ Tabla: Banco | Saldo                                │
│ (empty state si bancos.length === 0)                │
└─────────────────────────────────────────────────────┘
```

**Comportamiento**:
- Al montar: llama `getMiCaja()` (modo ahora).
- Al cambiar fecha: llama `getMiCaja(fecha)` en background (igual que `loadBalance`).
- Loading: mostrar `TableSkeleton` y skeleton cards mientras carga.
- Error: `AlertBanner type="error"`.
- Reutilizar clases CSS de `balance.css`: `balance-section`, `balance-section-title`, `balance-stats`, `table`, `amount`, `amount-positive`, `amount-negative`, `balance-toolbar`, etc.

### 2. Integración en `page.tsx`

En [frontend/src/app/balance/page.tsx](../frontend/src/app/balance/page.tsx) reemplazar el bloque que devuelve el banner "Solo los administradores pueden ver..." por:

```tsx
if (!isAdmin) {
  return <MiCajaView />;
}
```

El resto del archivo (vista admin) permanece sin cambios.

### 3. Lógica de `MiCajaView`

```tsx
const { user } = useAuth();
// Llama getMiCaja(fecha?) de api.ts
// Estado: caja: MiCajaSnapshot | null, loading, error, selectedDate
// handleDateChange / handleClearDate idénticos al patrón de page.tsx
```

## Criterios de aceptación

- [ ] Agente logueado ve "Mi caja" con KPI, bloque Movimiento y tabla de bancos.
- [ ] Date-picker funciona: sin fecha = modo ahora, con fecha = snapshot al cierre.
- [ ] Botón "Limpiar" resetea a modo ahora.
- [ ] Empty state se muestra si el agente no tiene bancos registrados.
- [ ] Loading skeleton visible durante la carga.
- [ ] Admin sigue viendo su vista actual sin cambios (sin regresiones).
- [ ] No errores TypeScript (`tsc --noEmit` limpio).
- [ ] Responsive: se ve correctamente en móvil.

## Notas

- Leer [frontend/AGENTS.md](../frontend/AGENTS.md) antes de implementar: no asumir APIs de Next.js del training data; leer `node_modules/next/dist/docs/` si hay dudas sobre routing o rendering.
- No agregar CSS nuevo si las clases de `balance.css` ya cubren el caso; si se necesita algo nuevo, agregar al final del archivo con prefijo `mi-caja-`.
- El campo `movimiento.pagosDia` representa pagos totales (usar `amount-negative` para diferenciarlo visualmente del monto inicial).
