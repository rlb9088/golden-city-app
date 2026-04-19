# TICKET-055 — Ejecución de migraciones pre-producción

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 11 — Pre-producción  
> **Prioridad**: P0 — Bloqueante. Producción no puede lanzarse sin esto.  
> **Esfuerzo estimado**: ~2h  
> **Dependencias**: TICKET-047, 048, 053, 054 (código completo y disponible)  
> **Depende de**: Acceso a credenciales del Google Sheet de producción

---

## Contexto

Los scripts de migración fueron creados en TICKET-053 y TICKET-054 y están listos para ejecutarse. Son operaciones one-shot que normalizan los datos históricos en Google Sheets antes de que la nueva lógica de scoping y autenticación entre en producción.

- `migrateAuthUsersToAgentes.js`: transfiere usuarios de `config_auth_users` a `config_agentes` con la nueva estructura (username, password_hash, role, activo).
- `migrateBancoId.js`: mapea el campo `banco` (texto libre) a `banco_id` (FK a `config_bancos`) en pagos, ingresos, gastos y bancos.

Ambos scripts tienen modo `--dry-run` (solo reporta, sin escrituras) y `--commit` (aplica cambios). Son idempotentes.

---

## Orden de ejecución obligatorio

```
1. Verificar esquema de Sheets
2. Migración auth (TICKET-054 script)  ← primero
3. Migración banco_id (TICKET-053 script)
4. Verificar auditoría
```

---

## Pasos detallados

### 1. Verificar que el esquema de producción está actualizado

```bash
cd backend
node scripts/verifySheetsSetup.js
```

Confirmar que las hojas `config_agentes` (con columnas: id, nombre, username, password_hash, role, activo) y `config_bancos` (con propietario_id) existen y tienen los headers correctos.

### 2. Migración auth: config_auth_users → config_agentes

**Dry-run:**
```bash
node scripts/migrateAuthUsersToAgentes.js --dry-run
```

Revisar el archivo `migrateAuthUsersToAgentes.report.json` generado:
- `match: "A"`: usuario encontrado en `config_agentes` por nombre → se enriquece con datos auth.
- `match: "B"`: usuario sin agente correspondiente → se creará un agente nuevo.
- `ambiguous`: múltiples agentes con el mismo nombre → requiere resolución manual antes de continuar.

Si hay casos `ambiguous`: resolver manualmente en la hoja de producción antes de ejecutar `--commit`.

**Commit (solo si dry-run sin blockers):**
```bash
node scripts/migrateAuthUsersToAgentes.js --commit
```

**Verificar:** intentar login con al menos una credencial de admin migrada. El endpoint `POST /api/auth/login` debe responder con JWT.

### 3. Migración banco_id en registros históricos

**Dry-run:**
```bash
node scripts/migrateBancoId.js --dry-run
```

Revisar `migrateBancoId.report.json`:
- `resolved`: filas donde el banco fue identificado de forma unívoca.
- `ambiguous`: mismo nombre de banco con múltiples propietarios → requiere asignación manual de `banco_id` en Sheets.
- `empty`: registros sin coincidencia → dejar vacío o asignar manualmente.

Si hay `ambiguous` que importen: asignar `banco_id` manualmente en la hoja antes de continuar.

**Commit:**
```bash
node scripts/migrateBancoId.js --commit
```

### 4. Verificar eventos de auditoría

Abrir la hoja `audit` en Google Sheets y confirmar que existen eventos:
- `action: 'migration_auth'` (de TICKET-054 script)
- `action: 'migration_banco_id'` (de TICKET-053 script)

---

## Criterios de aceptación

- [x] `verifySheetsSetup.js` pasa sin errores contra producción
- [x] Dry-run de auth migration sin casos `ambiguous` bloqueantes
- [x] Auth migration ejecutada en `--commit`; login con credencial migrada exitoso
- [x] Dry-run de banco_id migration revisado; casos ambiguos resueltos o documentados
- [x] banco_id migration ejecutada en `--commit`
- [x] Eventos de migración visibles en hoja `audit`
- [x] TICKET-056 puede proceder

---

## Notas

- Los scripts no tocan la hoja `audit` de forma disruptiva; solo agregan eventos `action: 'migration_*'`.
- Si el script de auth migration falla en `--commit`, se puede reintentar: es idempotente (omite agentes ya migrados).
- La hoja `config_auth_users` no se elimina automáticamente. Queda renombrada a `config_auth_users_deprecated` como respaldo.
