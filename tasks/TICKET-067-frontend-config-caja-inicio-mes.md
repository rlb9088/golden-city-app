# TICKET-067 — UI Configuración: editor de `caja_inicio_mes`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 13 — Rediseño módulo Balance
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1.5h
> **Dependencias**: TICKET-060, TICKET-065

---

## Contexto

El valor estático "Caja total al inicio de mes" alimenta el cálculo de Balance acumulado. Debe ser editable por admin desde [frontend/src/app/configuracion/page.tsx](../frontend/src/app/configuracion/page.tsx).

## Alcance

1. Nueva sección "Ajustes generales" en Configuración.
2. Campo numérico + campo fecha_efectiva + botón "Guardar".
3. Al guardar → `PUT /api/config/settings/caja_inicio_mes`.
4. Mostrar valor actual cargado al montar.
5. Feedback con `AlertBanner` (success/error).
6. Admin-only (página ya es admin).

## Criterios de aceptación

- [ ] Valor se lee y se actualiza correctamente.
- [ ] Validación: número ≥ 0, fecha válida.
- [ ] Cambios auditados en `audit` (backend ya lo hace en TICKET-060).

## Notas

- Si en el futuro surgen más settings, esta sección puede generalizarse como tabla key/value.
