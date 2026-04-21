# TICKET-075 — Frontend: mostrar "Balance" en el sidebar para agentes

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P2
> **Esfuerzo estimado**: ~30min
> **Dependencias**: TICKET-074

---

## Contexto

El sidebar actualmente oculta el link "Balance" a usuarios que no son admin. Con la vista Mi Caja implementada (TICKET-074), los agentes deben poder acceder a `/balance` desde el menú de navegación.

## Alcance

1. Localizar en el código del sidebar (probablemente `frontend/src/components/Sidebar.tsx` o `frontend/src/app/layout.tsx`) la regla que filtra el link "Balance" solo para admin.
2. Quitar la condición admin-only para ese link, dejándolo visible para todos los usuarios autenticados.
3. El link sigue siendo `/balance` — no se crea una nueva ruta.

### Ejemplo de cambio esperado

Antes:
```tsx
{ href: '/balance', label: 'Balance', icon: '...', adminOnly: true },
```

Después:
```tsx
{ href: '/balance', label: 'Balance', icon: '...' },
```

(La sintaxis exacta depende de cómo esté implementado el sidebar — identificar en el archivo real.)

## Criterios de aceptación

- [ ] Agente logueado ve el link "Balance" en el sidebar.
- [ ] Admin logueado sigue viendo el link "Balance" en el sidebar.
- [ ] Hacer clic en "Balance" como agente → lleva a la vista Mi Caja (TICKET-074).
- [ ] Hacer clic en "Balance" como admin → sigue mostrando el dashboard de administrador.
- [ ] Ningún otro link del sidebar se ve afectado.

## Notas

- Si el sidebar usa un array de items con un flag `adminOnly` o similar, quitar el flag del item "Balance".
- Si usa `isAdmin` inline, reemplazar la condición.
- No modificar ningún otro item del sidebar.
