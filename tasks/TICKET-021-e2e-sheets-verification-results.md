# TICKET-021 E2E Sheets Verification

- Run at: 2026-04-16T05:14:36
- Mode: Google Sheets
- OCR: ok

## Checks
- [x] Payment stored in pagos
- [x] Income stored in ingresos
- [x] Expense stored in gastos
- [x] Bank upsert stored and overwritten
- [x] Audit sheet captured mutations
- [x] Global balance delta matches expected
- [x] Config agente stored in config_agentes
- [x] Bulk users stored in config_usuarios

## Created Records
- Pago: PAG-1776334467991-1
- Ingreso: ING-1776334469205-1
- Gasto: GAS-1776334469747-1
- Banco: BAN-1776334470567-1
- Config agente: AGE-1776334471942-100
- Config usuarios: USU-1776334472498-100, USU-1776334473040-101

## Deltas
- Audit rows delta: 8
- Global balance delta: 1482.45
- Expected global balance delta: 1482.45

## Notes
- Sheets writes now use RAW values and reads use unformatted values.
- Config writes are audited with the authenticated user.
- OCR parsed amount: 150.5
- OCR parsed date: 2026-04-16
