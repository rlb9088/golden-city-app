# TICKET-053: Migración de registros históricos a `banco_id`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 9 — Identidad y scoping por propietario
> **Esfuerzo estimado**: ~2h
> **Prioridad**: P1 — Mitiga el riesgo de ambigüedad en datos existentes

---

## Problema / Riesgo que mitiga

Al introducir `banco_id` en pagos, ingresos, gastos y bancos (TICKET-048), los registros históricos sólo tienen `banco` (string). Dos agentes pueden tener un banco con el mismo nombre (p. ej. "BBVA de Paolo" vs "BBVA de Juan"), y un pago histórico que dice `banco: "BBVA", agente: "Paolo"` debe mapear al `banco_id` correcto.

Sin esta migración, los registros antiguos quedarían con `banco_id` vacío y romperían reportes, filtros y el scoping por propietario.

---

## Solución

Script one-shot `backend/scripts/migrateBancoId.js` que:

### Estrategia de mapping

Para cada fila en `pagos`, `ingresos`, `gastos`, `bancos` (saldos) sin `banco_id`:

1. Buscar en `config_bancos` el banco que cumpla:
   - `nombre = fila.banco` (case-insensitive, trim)
   - Y (si la hoja tiene `agente` o `agente_id`): `propietario_id = agente.id` correspondiente.
2. Si hay **exactamente una coincidencia** → asignar `banco_id = match.id`.
3. Si hay **cero coincidencias** → dejar `banco_id = ''`, registrar warning en auditoría con contexto (id, fila, banco, agente).
4. Si hay **>1 coincidencia** (ambigüedad no resuelta por agente):
   - Dejar `banco_id = ''`, warning de auditoría explícito.
   - Imprimir reporte a stdout con los IDs ambiguos para revisión manual.

### Ejecución

- `node backend/scripts/migrateBancoId.js --dry-run` (primero, sin escribir): imprime estadísticas y warnings.
- `node backend/scripts/migrateBancoId.js --commit`: aplica los cambios en Sheets.
- Registra un evento `audit` tipo `migration` con conteos (resueltos, vacíos, ambiguos).
- Idempotente: filas con `banco_id` no vacío se saltan.

### Reporte

Al terminar:
```
Migración banco_id:
  pagos:    XX resueltos, Y vacíos, Z ambiguos
  ingresos: XX resueltos, Y vacíos, Z ambiguos
  gastos:   XX resueltos, Y vacíos, Z ambiguos
  bancos:   XX resueltos, Y vacíos, Z ambiguos
```

Los IDs con `banco_id` vacío tras migración se listan en un archivo `backend/scripts/migrateBancoId.report.json` para que el admin revise manualmente.

---

## Archivos

- `backend/scripts/migrateBancoId.js` (nuevo)
- `backend/scripts/migrateBancoId.report.json` (generado, en .gitignore)
- `backend/tests/migrateBancoId.test.js` (tests unitarios de la lógica de mapping)

## Dependencias

- **Requiere TICKET-048** (columna `banco_id` existe en las hojas).
- **Recomendado ejecutar TICKET-047** antes, para que `config_agentes` esté estable (el agente asociado a cada pago se resuelve correctamente).

## Criterios de Aceptación

- [ ] `--dry-run` no escribe en Sheets y produce reporte completo.
- [ ] `--commit` escribe `banco_id` donde la resolución es inequívoca.
- [ ] Idempotente: una segunda ejecución no cambia filas ya migradas.
- [ ] Filas ambiguas o sin match quedan con `banco_id=''` y quedan listadas en el reporte JSON.
- [ ] Evento `audit` de tipo `migration` registrado con conteos.
- [ ] Tests unitarios cubren: match único, cero matches, múltiples matches, registros ya migrados.

## Definición de Terminado

- El 100% de registros resolubles automáticamente tienen `banco_id`.
- Los no resolubles están listados en un reporte accionable por el admin.
- Cero pérdida de datos (las filas sin match conservan el `banco` textual original).
