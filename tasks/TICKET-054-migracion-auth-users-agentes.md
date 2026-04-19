# TICKET-054: Migración de `config_auth_users` a `config_agentes`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~2h
> **Prioridad**: P0 — Sin esto, al activar TICKET-047 los usuarios existentes pierden acceso

---

## Problema / Riesgos que mitiga

TICKET-047 unifica identidad en `config_agentes`. Antes de ese cambio existen dos fuentes:

- `config_auth_users`: usuarios con login (username, password_hash, role).
- `config_agentes`: agentes operativos (sólo nombre).

Al activar TICKET-047:

- **Riesgo 1**: Los usuarios de `config_auth_users` que no tengan un agente equivalente en `config_agentes` perderían acceso al sistema.
- **Riesgo 2**: El admin actual podría tener que resetear su contraseña tras la unificación si no se mueven los hashes.
- **Riesgo 3**: Hay referencias textuales al "agente" en pagos históricos. Si el matching auth→agente se hace mal, el scoping por propietario (TICKET-049/050) falla.

Este ticket implementa la migración one-shot que elimina estos riesgos.

---

## Solución

Script `backend/scripts/migrateAuthUsersToAgentes.js` con dos modos (`--dry-run`, `--commit`).

### Estrategia de mapping auth→agente

Para cada fila de `config_auth_users`:

1. Buscar en `config_agentes` un agente cuyo `nombre` coincida (case-insensitive, trim) con el `nombre` del auth user.
2. **Caso A — Match único**:
   - Enriquecer el agente con los campos de auth: `username`, `password_hash`, `role`, `activo = true`.
   - Actualizar fila en `config_agentes` preservando el `id` original del agente (para no romper referencias en pagos/bancos).
3. **Caso B — Sin match**:
   - Crear un agente nuevo en `config_agentes` con los datos de auth (`id` nuevo tipo `AG-<timestamp>`).
   - Log en stdout indicando que este usuario entra como agente sin historial operativo.
4. **Caso C — Múltiples matches por nombre**:
   - No decidir automáticamente. Dejar el caso en el reporte y solicitar intervención manual.
   - El admin deberá elegir a cuál de los agentes homónimos se enlaza el user.

### Referencias en datos históricos (pagos/bancos/etc.)

- Pagos, ingresos, gastos hoy guardan `agente` como **texto libre**. Después de la migración, se recomienda pero **no es bloqueante** añadir un `agente_id` canónico (queda como trabajo opcional; mencionarlo en el reporte).
- `config_bancos.propietario_id` ya existe (TICKET-041) y sigue apuntando al `id` del agente, que se preserva por el caso A.

### Post-migración

- Marcar `config_auth_users` como deprecated: renombrar a `config_auth_users_deprecated` (hoja archivada) o limpiar después de verificar. Mantener copia hasta que TICKET-047 esté en producción y estable.
- Evento `audit` tipo `migration_auth` con conteo por caso A/B/C.

### Reporte generado

`backend/scripts/migrateAuthUsersToAgentes.report.json` con:

```json
{
  "updated": [ { "auth_username": "...", "agent_id": "...", "match": "A" } ],
  "created": [ { "auth_username": "...", "agent_id": "AG-..." } ],
  "ambiguous": [ { "auth_username": "...", "candidates": [...] } ]
}
```

---

## Archivos

- `backend/scripts/migrateAuthUsersToAgentes.js` (nuevo)
- `backend/scripts/migrateAuthUsersToAgentes.report.json` (generado; .gitignore)
- `backend/tests/migrateAuthUsersToAgentes.test.js`

## Dependencias

- **Debe ejecutarse antes de desplegar TICKET-047** o inmediatamente después de ampliar el schema de `config_agentes`.
- Requiere que el schema ampliado de `config_agentes` (columnas `username`, `password_hash`, `role`, `activo`) exista en la hoja. TICKET-047 lo añade en el setup.

## Criterios de Aceptación

- [ ] `--dry-run` no escribe; imprime resumen por caso A/B/C.
- [ ] `--commit` ejecuta la migración; idempotente (si un user ya tiene hash en el agente, se salta).
- [ ] El admin actual mantiene su password (no requiere reset).
- [ ] Los agentes previamente existentes conservan su `id` (no se rompen referencias `propietario_id`, ni pagos por nombre).
- [ ] Casos ambiguos quedan listados en el reporte, sin modificación en Sheets.
- [ ] Evento audit `migration_auth` registrado.
- [ ] Tests cubren casos A, B, C, re-ejecución, user sin password_hash.

## Definición de Terminado

- Todos los usuarios activos pueden loguearse tras TICKET-047 sin cambiar credenciales.
- Ningún agente preexistente perdió su `id`.
- Reporte accionable para cualquier caso ambiguo no resuelto.
- `config_auth_users` queda archivada; el runtime ya no la consulta.
