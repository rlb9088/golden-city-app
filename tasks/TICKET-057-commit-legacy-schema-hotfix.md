# TICKET-057 — Commitear hotfix de migración de headers legacy

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 12 — Estabilización post-deploy
> **Prioridad**: P1
> **Esfuerzo estimado**: ~30 min
> **Dependencias**: ninguna

---

## Contexto

Tras el deploy a producción (Sprint 11) se detectó que algunas hojas (`ingresos`, `gastos`, `bancos`) en el spreadsheet productivo tenían headers en el esquema previo a ADR-022 (sin `banco_id`). Para evitar que el backend fallara al leer/escribir, se añadió en `backend/repositories/sheetsRepository.js` una rama de migración automática que detecta esos headers legacy y los reescribe al esquema vigente, junto con un test de cobertura.

Estos cambios **están en el working tree pero nunca se commitearon** (`git status` los marca como modified/untracked). Eso significa que:

- El código publicado en Railway no contiene la migración (se aplicó manualmente o el deploy no incluye el fix).
- CI no valida la migración, lo que arriesga regresiones.
- Cualquier nuevo deploy desde `main` reintroduciría el bug.

## Cambios involucrados (verificar antes de commit)

```
M backend/package.json                              (añade el nuevo test al script `npm test`)
M backend/repositories/sheetsRepository.js          (3 detectores legacy + ramas de migración)
?? backend/tests/sheetsRepository-legacy-schema.test.js
```

## Alcance

1. Revisar el diff completo (`git diff backend/`).
2. Confirmar que el test cubre los tres casos (`ingresos`, `gastos`, `bancos`) y que asume el comportamiento esperado de `ensureSheetSchema`.
3. Ejecutar `npm test` en `backend/` y validar que toda la suite pasa.
4. Commit en `main` con mensaje descriptivo (referenciar los headers legacy migrados).
5. Push y verificar que CI pasa.
6. Confirmar en Railway que el deploy automático queda con el fix integrado (`/api/health` + revisar logs por warning `Migrating legacy ... schema`).

## Criterios de aceptación

- [ ] Working tree limpio en `backend/`.
- [ ] Suite de tests backend verde en CI.
- [ ] Deploy automático de Railway con commit visible en `/api/health` (`build`).
- [ ] Logs de Railway sin errores de schema durante el primer ciclo de lecturas.

## Notas

- Si la suite de tests falla por fixtures, ajustar el test antes de commitear; **no** debilitar la lógica de detección.
- Los detectores son sensibles a longitud y orden de headers; cualquier cambio futuro en `sheetsSchema.js` requiere revisar también estas ramas legacy.
