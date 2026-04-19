# TICKET-052: Sincronizar documentación tras tickets 40-46 + 047-054

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 10 — Migración de almacenamiento / cierre de documentación
> **Esfuerzo estimado**: ~2h
> **Prioridad**: P2 — Deuda documental acumulada

---

## Problema

La documentación quedó desincronizada respecto al código:

- `docs/architecture.md` reporta como pendientes comprobantes (TICKET-044), edición en Configuración (TICKET-040), bancos FK (TICKET-041), importación batch (TICKET-042) — todos implementados.
- `docs/architecture.md` §5.4 describe Google Drive como la solución de comprobantes; TICKET-051 la reemplaza por R2.
- `docs/decisions.md` tiene ADR-018 "🔴 Pendiente de implementación"; ya está implementado y pronto será superseded.
- No hay ADRs documentando: edición en Configuración (040), FK de propietario en bancos (041), batch append (042 — sí tiene ADR-019), R2 (051), identidad unificada (047), banco_id (048).
- `tasks/BACKLOG.md` muestra Sprint 7 y Sprint 8 como 🔴 Pendientes cuando están completos.

---

## Acciones

### `docs/architecture.md`

1. **§5 Servicios externos**:
   - Eliminar §5.4 "Google Drive API v3 (pendiente)".
   - Añadir §5.4 "Cloudflare R2" con propósito, autenticación (S3-compatible), operaciones (PutObject), variables de entorno.
2. **§8 Estado de Implementación**:
   - Comprobantes → ✅ Completo (R2, key en `comprobante_file_id`).
   - Configuración → ✅ Completo (incluye edición).
   - Paginación → ✅ Completo si TICKET-045 también se ejecutó; si no, dejar 🟡 con referencia.
   - Refresh tokens → ✅ Completo tras TICKET-046.
3. **§9 Pendientes arquitectónicos**:
   - Borrar items 1–7 ya resueltos.
   - Añadir pendientes reales del nuevo sprint (047–054) sólo mientras sigan abiertos.
4. **§1 Diagrama**: añadir "Cloudflare R2 (archivos)" en la capa de servicios externos; eliminar referencia a Drive.
5. **Versión y fecha**: bump a 1.4, fecha actual.

### `docs/decisions.md`

1. **ADR-018** (Drive) → marcar `⛔ Superseded por ADR-020`.
2. **ADR-020** (nuevo) — "Cloudflare R2 como almacenamiento de comprobantes":
   - Contexto, alternativas (Drive descartado por rol genuino de almacén de objetos; S3 AWS descartado por costo; R2 elegido por precio/egress/coherencia).
   - Decisión, consecuencias, mitigaciones.
3. **ADR-021** (nuevo) — "Identidad unificada en `config_agentes`":
   - Contexto (dos fuentes duplicadas), decisión (tabla única), consecuencias, migración (TICKET-054).
4. **ADR-022** (nuevo) — "`banco_id` como FK en movimientos":
   - Contexto (string libre insuficiente para scoping), decisión, migración (TICKET-053).
5. **Registro de cambios** actualizado con fechas reales.

### `tasks/BACKLOG.md`

1. Marcar Sprint 7 (040–044) y Sprint 8 (045–046) como ✅ Completados.
2. Consolidar Sprint 9 / 10 con tickets 047–054.
3. Actualizar tabla resumen (totales, completados, pendientes).

### `.env.example`

- Quitar `DRIVE_RECEIPTS_FOLDER_ID` (ya lo hace TICKET-051, verificar).
- Confirmar que `R2_*` están presentes y documentadas.

---

## Archivos

- `docs/architecture.md`
- `docs/decisions.md`
- `tasks/BACKLOG.md`
- `.env.example`

## Dependencias

- Debe ejecutarse **al cierre** de 047–054 (o al menos tras TICKET-051).

## Criterios de Aceptación

- [ ] `architecture.md` refleja el estado real del sistema (R2 activo, Drive removido, tickets 40–46 y 047–054 reflejados).
- [ ] `decisions.md` tiene ADR-018 superseded y ADR-020/021/022 añadidos.
- [ ] `BACKLOG.md` muestra los sprints 7/8 como ✅ y los sprints 9/10 correctamente listados.
- [ ] `.env.example` sin variables obsoletas.

## Definición de Terminado

- La documentación cuenta la misma historia que el código.
- Cualquier persona nueva en el proyecto puede leer arquitectura/decisiones/backlog y entender el estado real.
