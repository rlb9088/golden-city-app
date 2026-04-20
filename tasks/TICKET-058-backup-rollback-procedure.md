# TICKET-058 — Procedimiento de backup y rollback (Sheets + R2)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 12 — Estabilización post-deploy
> **Prioridad**: P1
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna

---

## Contexto

Con el sistema en producción y a punto de operar con datos reales, no existe un procedimiento documentado para:

- Respaldar el spreadsheet productivo de Google Sheets de forma periódica.
- Respaldar (o versionar) los objetos del bucket de Cloudflare R2.
- Restaurar cualquiera de los dos en caso de corrupción, borrado accidental o necesidad de auditoría histórica.

Railway sí ofrece rollback de deploys vía dashboard (cubre el código), pero **no** cubre los datos. Una corrupción en una hoja (por ejemplo, un import batch mal formado o un usuario eliminando una fila desde la UI de Sheets) hoy no tiene plan de recuperación.

## Alcance

### A. Google Sheets
1. Definir cadencia de backup (sugerido: diario automático + manual antes de cada migración).
2. Documentar mecanismo:
   - Opción 1: Google Drive — habilitar versiones del spreadsheet (nativo, retención 30 días).
   - Opción 2: Script `scripts/backupSheets.mjs` que exporte todas las hojas a CSV/JSON y los suba a R2 bajo `backups/sheets/YYYY-MM-DD/`.
   - Opción 3: Apps Script con trigger diario que duplique el spreadsheet en una carpeta `backups/`.
3. Procedimiento de restore: cómo importar un snapshot a un spreadsheet limpio sin romper IDs ni auditoría.

### B. Cloudflare R2
1. Activar versionado del bucket (si Cloudflare lo expone) o configurar replicación a un bucket secundario.
2. Documentar política de retención (sugerido: 90 días).
3. Procedimiento de restore: cómo recuperar un objeto borrado y reasociarlo al `comprobante_file_id` correspondiente.

### C. Documentación
- Nueva sección en `docs/DEPLOY.md` (o un nuevo `docs/operations.md`) con:
  - Frecuencia, responsable y ubicación de los backups.
  - Procedimiento de restore paso a paso.
  - Pruebas de restore recomendadas (al menos un dry-run trimestral).

## Criterios de aceptación

- [ ] Mecanismo de backup de Sheets implementado y documentado.
- [ ] Mecanismo de backup/versionado de R2 implementado y documentado.
- [ ] Procedimiento de restore probado al menos una vez (dry-run).
- [ ] Sección de operaciones añadida a la documentación.
- [ ] Nuevas variables de entorno (si aplica) registradas en `tech-stack.md` y `DEPLOY.md`.

## Notas

- Priorizar la opción más simple que cubra el caso (versionado nativo + export semanal puede ser suficiente).
- No introducir dependencias pesadas: los scripts pueden vivir en `scripts/` y ejecutarse vía cron de GitHub Actions.
- Antes de ejecutar este ticket, validar con el dueño del producto la sensibilidad de los datos para definir retención.
