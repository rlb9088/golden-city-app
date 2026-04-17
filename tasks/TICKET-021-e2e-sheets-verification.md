# TICKET-021: Verificacion end-to-end con Google Sheets real

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 3 - Integracion  
> **Esfuerzo**: ~3h  
> **Prioridad**: P0 - Blocker para produccion

---

## Objetivo
Probar todos los flujos del sistema contra Google Sheets real, identificar y corregir issues de integracion.

## Acciones
1. Arrancar backend con credenciales configuradas
2. Probar cada flujo:
   - Crear pago -> verificar en hoja `pagos`
   - Crear ingreso -> verificar en hoja `ingresos`
   - Crear gasto -> verificar en hoja `gastos`
   - Upsert banco -> verificar en hoja `bancos`
   - Verificar auditoria en hoja `audit`
   - Verificar balance global desde dashboard
3. Probar config CRUD:
   - Agregar agente desde UI -> verificar en `config_agentes`
   - Importar usuarios masivamente -> verificar en `config_usuarios`
4. Probar OCR con comprobante real

## Archivos probables (correcciones)
- `backend/repositories/sheetsRepository.js` - ajustes de lectura/escritura
- `backend/services/*.service.js` - fixes de formato, parseo y auditoria

## Dependencias
- TICKET-020

## Criterios de Aceptacion
- [x] Todos los modulos leen/escriben correctamente en Sheets
- [x] Las fechas se almacenan en formato consistente
- [x] Los montos se parsean correctamente como numeros
- [x] La formula de balance cuadra con los datos en Sheets
- [x] No hay errores de autenticacion ni rate limiting

## Definicion de Terminado
- Log de pruebas documentado con resultados: [`TICKET-021-e2e-sheets-verification-results.md`](./TICKET-021-e2e-sheets-verification-results.md)
- Todos los flujos pasan sin errores en Google Sheets real

---

## Validacion Ejecutada

- Escritura y lectura en `pagos`, `ingresos`, `gastos` y `bancos`
- Auditoria en `audit` con delta esperado de 8 filas
- Balance global consistente con el delta esperado
- CRUD de configuracion con `config_agentes` y `config_usuarios`
- OCR verificado con un comprobante de control local
