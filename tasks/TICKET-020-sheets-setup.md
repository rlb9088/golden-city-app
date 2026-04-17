# TICKET-020: Preparar Google Sheets con estructura de hojas

> **Estado**: 🔲 PENDIENTE  
> **Sprint**: 3 — Integración  
> **Esfuerzo**: ~2h  
> **Prioridad**: P0 — Blocker para producción

---

## Objetivo
Crear el spreadsheet de Google Sheets con las 11 hojas necesarias, cada una con sus headers correctos. Documentar el proceso paso a paso.

## Acciones
1. Crear un nuevo Google Spreadsheet
2. Crear 11 hojas con los nombres exactos:
   - `pagos`, `ingresos`, `gastos`, `bancos`, `audit`
   - `config_agentes`, `config_categorias`, `config_bancos`, `config_cajas`, `config_tipos_pago`, `config_usuarios`
3. En cada hoja, escribir los headers en la fila 1 según el modelo de datos del PRD
4. Compartir el spreadsheet con el Service Account (email del JSON de credenciales)
5. Copiar el GOOGLE_SHEET_ID de la URL y configurar en `backend/.env`

## Archivos probables
- `backend/.env` — agregar GOOGLE_SHEET_ID
- `docs/setup-guide.md` — (NEW) guía de setup paso a paso

## Dependencias
- Credenciales de Google Cloud (Service Account JSON)

## Criterios de Aceptación
- [ ] Las 11 hojas existen con headers correctos
- [ ] Service Account tiene acceso de editor al spreadsheet
- [ ] Backend arranca y se conecta a Sheets (log: "Connected to Google Sheets API")
- [ ] CRUD básico funciona end-to-end (crear un pago, verificar en Sheets)

## Definición de Terminado
- Backend opera contra Google Sheets real (no in-memory)
- Datos persisten y son visibles en el spreadsheet
