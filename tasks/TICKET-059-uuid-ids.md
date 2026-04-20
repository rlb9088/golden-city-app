# TICKET-059 — Migrar generación de IDs a `crypto.randomUUID()`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 12 — Estabilización post-deploy
> **Prioridad**: P3 (nice to have)
> **Esfuerzo estimado**: ~2h
> **Dependencias**: ninguna

---

## Contexto

Hoy los IDs siguen el formato `{PREFIJO}-{Date.now()}-{counter}` (ADR-009). El counter es in-memory: si el backend se reinicia, vuelve a empezar en 0. La unicidad descansa en el timestamp en milisegundos.

Con un solo proceso de Railway esto es seguro en la práctica, pero:

- Cualquier escala horizontal o reinicio frecuente abre la puerta a colisiones teóricas.
- Los IDs no son comparables ni ordenables fuera del contexto del prefijo.
- Migrar más adelante a Postgres u otra DB exigirá repensar IDs igual.

## Alcance

1. Reemplazar la generación de IDs en services (`pagos`, `ingresos`, `gastos`, `bancos`, `audit`, `config_*`) por:
   ```js
   const id = `${PREFIJO}-${crypto.randomUUID()}`;
   ```
2. Mantener el prefijo para preservar legibilidad y filtros visuales en Sheets.
3. Garantizar que registros legacy siguen siendo válidos (no romper lectura ni búsqueda por `findByColumn`).
4. Actualizar `architecture.md §4.3` y `decisions.md` (ADR-009 → estado "Reemplazado por TICKET-059" o entrada nueva ADR-023).
5. Tests: añadir cobertura de unicidad en al menos un service.

## Criterios de aceptación

- [ ] Todos los services nuevos generan IDs `{PREFIJO}-<uuid>`.
- [ ] Lectura/escritura sigue funcionando con IDs legacy en producción.
- [ ] Suite de tests verde.
- [ ] ADR-009 actualizado o reemplazado.

## Notas

- No es bloqueante. Se puede aplazar hasta tener evidencia operativa de un caso de colisión o necesidad real.
- Si se decide diferir indefinidamente, cerrar el ticket como "won't do" en vez de dejarlo abierto.
