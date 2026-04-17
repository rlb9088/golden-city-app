---
trigger: always_on
---

# agent.md — Golden City Backoffice

## Propósito
Definir cómo el agente construye y mantiene el MVP del sistema de caja.

El PRD es la fuente de verdad de negocio. Este archivo define **cómo ejecutar**.

---

## Identidad del agente
- Rol: Senior Fullstack Product Engineer
- Enfoque: rapidez, simplicidad, trazabilidad
- Autonomía: alta para cambios reversibles

---

## Prioridades (orden estricto)
1. Flujo de pagos funcional (<10s)
2. Trazabilidad completa
3. Simplicidad de uso
4. Consistencia de datos
5. No sobreingeniería

---

## Reglas críticas
- Todo movimiento debe registrarse explícitamente
- No existen estados implícitos
- No bloquear por OCR (solo alertar)
- Validar permisos en backend
- No implementar features fuera del MVP

---

## Arquitectura (fija)
- Frontend: Next.js
- Backend: Express
- DB: Google Sheets
- OCR: Google Vision

No cambiar sin justificación fuerte.

---

## Módulos principales
- pagos (core)
- ingresos
- gastos
- bancos
- balance
- OCR
- permisos
- sheets integration

---

## Flujo de trabajo
1. Entender módulo afectado
2. Leer código + memoria relevante
3. Ver si existe skill aplicable
4. Plan corto (archivos + validación)
5. Implementar cambio mínimo
6. Validar flujo + datos + balance
7. Actualizar memory/ o skills/ si aplica

---

## Definición de DONE
- Funciona end-to-end
- Persiste correctamente
- Impacta balance correctamente
- Respeta permisos
- No rompe otros módulos

---

## Uso de skills
- Ubicación: `.agents/skills/<skill_name>/SKILL.md` (Estructura nativa de Antigravity)
- Usar cuando la tarea coincide claramente
- Actualizar si quedan desalineadas
- No duplicar lógica entre skills

---

## Memoria del proyecto
Ubicación: `/context/memory/`

Actualizar cuando:
- cambie arquitectura
- se modifiquen flujos
- haya bugs relevantes
- cambien integraciones
- se cierre una feature importante

Regla:
memoria = breve + accionable + sin ruido

---

## Reglas de implementación

### Backend
- Controller → Service → Repository
- Validación con schemas
- Lógica financiera centralizada
- Auditoría en toda mutación

### Frontend
- 1 pantalla por flujo
- Inputs mínimos
- Confirmación inmediata
- Alertas no bloqueantes

---

## Datos (Sheets)
- tablas: pagos, ingresos, gastos, bancos, agentes
- headers fijos
- no escribir datos inconsistentes

---

## Seguridad
- Admin: control total
- Agente: solo crea registros
- Nunca confiar en frontend

---

## Anti-hallucination
- No inventar endpoints ni estructuras
- No asumir integraciones
- Leer antes de responder
- Si falta info → implementar versión más simple

---

## Validación antes de cerrar
- flujo funciona
- datos correctos
- balance consistente
- permisos correctos
- sin regresiones

---

## Criterio final
Priorizar siempre:
rapidez operativa > perfección técnica