# TICKET-015: Frontend — Página de Pagos con OCR

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 2 — OCR  
> **Esfuerzo**: ~4h  
> **Prioridad**: P0 — Core

---

## Objetivo
Crear el formulario de registro de pagos con integración OCR, validaciones no bloqueantes y tabla de últimos pagos.

## Archivos
- `frontend/src/app/pagos/page.tsx + pagos.css`
- `frontend/src/components/ReceiptUploader.tsx + .css`

## Dependencias
- TICKET-013 (design system), TICKET-006 (backend pagos), TICKET-012 (backend OCR)

## Criterios de Aceptación
- [x] Formulario con: usuario, caja, banco, monto, tipo, fecha comprobante
- [x] ReceiptUploader: drag&drop, click, paste (Ctrl+V)
- [x] OCR auto-rellena monto y fecha
- [x] Warning si monto OCR ≠ monto manual (umbral > $0.02)
- [x] Warning si fecha OCR ≠ fecha manual (solo comparación de día)
- [x] Warning si usuario no existe en config (no bloqueante)
- [x] Autocompletado de usuario desde config_usuarios (datalist)
- [x] Tabla de últimos pagos con scrollback
- [x] Focus automático en usuario después de submit
- [x] Preview de imagen con botón para quitar
- [x] Badge de monto detectado por OCR sobre la preview

## Definición de Terminado
- Flujo completo de pago funciona end-to-end
- OCR funciona con los 3 modos (Vision, Tesseract, Mock)
- Warnings no bloquean el registro
