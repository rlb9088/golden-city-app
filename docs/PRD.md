# PRD — Golden City Backoffice MVP

> **Versión**: 1.2  
> **Última actualización**: 2026-04-20  
> **Estado**: En desarrollo activo

---

## 1. Visión del Producto

Golden City Backoffice es un sistema de caja en tiempo real diseñado para un negocio de entretenimiento (casa de apuestas/gaming). Permite registrar pagos a usuarios (jugadores), controlar ingresos por agente, registrar gastos operativos, conciliar saldos bancarios y visualizar el balance global del negocio — todo persistido en Google Sheets como base de datos.

### Objetivo Principal
Sustituir hojas de cálculo manuales por un backoffice web rápido, trazable y con mínima fricción operativa, permitiendo que múltiples agentes y un administrador gestionen la caja del negocio en tiempo real.

---

## 2. Usuarios y Roles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Admin** | Dueño o supervisor del negocio | Todo: pagos, ingresos, gastos, bancos, balance, configuración, auditoría |
| **Agente** | Operador de caja | Solo: registrar pagos. Ver balance propio (futuro) |

### Usuarios finales del sistema (Jugadores)
Los "usuarios" dentro del contexto de pagos son los **jugadores** que reciben dinero. No son usuarios del sistema — son entidades registradas en la tabla `config_usuarios` para autocompletado y validación.

---

## 3. Módulos del MVP

### 3.1 Pagos (Core — Prioridad Máxima)
**Propósito**: Registrar cada pago realizado a un jugador.

**Campos**:
- `usuario` — nombre del jugador (texto libre con autocompletado desde config)
- `caja` — caja desde la que se paga (select)
- `banco` — banco destino (select)
- `monto` — cantidad en soles (S/)
- `tipo` — tipo de pago: Transferencia, Efectivo, Yape, Plin, Tarjeta (select)
- `comprobante_url` — referencia a imagen del voucher (opcional)
- `fecha_comprobante` — fecha/hora extraída del voucher (datetime, manual u OCR)
- `fecha_registro` — timestamp automático del servidor (timezone Lima)
- `agente` — usuario del sistema que registra (automático desde auth)

**Reglas de negocio**:
- Todo pago resta del balance del agente
- El monto debe ser > 0
- El usuario puede no existir en la tabla de config (se muestra warning no bloqueante)
- El comprobante es opcional pero recomendado
- OCR auto-rellena monto y fecha si se sube imagen

**Estado**: ✅ Implementado (formulario, tabla, OCR, validación, auditoría)

---

### 3.2 Ingresos
**Propósito**: Registrar la asignación de dinero (carga de caja) a un agente.

**Campos**:
- `agente` — agente que recibe el dinero (select)
- `banco` — banco de origen (select)
- `monto` — cantidad asignada (S/)
- `fecha_movimiento` — fecha/hora del movimiento (datetime-local)
- `fecha_registro` — timestamp del servidor

**Reglas de negocio**:
- Solo admin puede crear ingresos
- Todo ingreso suma al balance del agente
- El monto debe ser > 0

**Estado**: ✅ Implementado

---

### 3.3 Gastos
**Propósito**: Registrar gastos operativos del negocio.

**Campos**:
- `concepto` — descripción del gasto (texto libre)
- `categoria` — categoría principal (select: Operativo, Personal, Servicios, Otros)
- `subcategoria` — subcategoría (select dinámico según categoría)
- `banco` — banco afectado (select)
- `monto` — cantidad del gasto (S/)
- `fecha_gasto` — fecha del gasto (date)
- `fecha_registro` — timestamp del servidor

**Reglas de negocio**:
- Solo admin puede crear gastos
- Todo gasto resta del balance global
- Categorías y subcategorías configurables desde admin

**Estado**: ✅ Implementado

---

### 3.4 Bancos (Saldos Bancarios)
**Propósito**: Registrar el saldo de cierre diario de cada cuenta bancaria.

**Campos**:
- `banco` — nombre del banco (select)
- `saldo` — saldo del día (S/)
- `fecha` — fecha del cierre (date)

**Reglas de negocio**:
- Solo admin puede registrar saldos
- Lógica de **upsert**: si ya existe registro para banco+fecha, se sobrescribe y se registra en auditoría
- Se muestra advertencia visual cuando se va a sobrescribir un saldo existente
- El balance global usa el **último saldo registrado** por cada banco

**Estado**: ✅ Implementado

---

### 3.5 Balance / Dashboard
**Propósito**: Vista consolidada del estado financiero del negocio en tiempo real.

**Semántica**:
- El dashboard permite filtrar por fecha de cierre.
- Si el campo de fecha se deja vacío, la vista calcula el estado "al momento" usando la fecha actual en timezone Lima.
- Para bancos admin se usa cierre por snapshot diario con carry-forward cuando falta registro para un banco en la fecha elegida.
- `caja_inicio_mes` se lee desde `config_settings` y actúa como la caja base del acumulado mensual.
- Ver ADR-023 en [docs/decisions.md](./decisions.md) para la semántica contable completa.

**Fórmulas**:
```text
BancosAdmin(D) = suma de saldos de bancos admin al cierre de D
CajasAgentes(D) = suma(ingresos <= D) - suma(pagos <= D)
TotalGastos(D) = suma(gastos activos <= D)
GastosDelDia(D) = suma(gastos activos en D)
BalanceDelDia(D) = (BancosAdmin(D) + CajasAgentes(D)) - (BancosAdmin(D-1) + CajasAgentes(D-1)) - GastosDelDia(D)
BalanceAcumulado(D) = (BancosAdmin(D) + CajasAgentes(D)) - TotalGastos(D) - caja_inicio_mes
```

**Vistas**:
- 5 cards de resumen: Bancos admin, Cajas de agentes, Total gastos, Balance del día, Balance acumulado.
- Tabla: Balance por agente con sus bancos desglosados.
- Tabla: Balance por banco admin.
- Tabla: Balance por categoría y subcategoría de gasto.
- Cada tabla debe tener empty state propio cuando no haya datos.

**Estado**: ✅ Implementado

---

La ruta `/balance` muestra dos vistas segun el rol: admin ve el dashboard global y agente ve "Mi Caja" personal.

### 3.6 OCR de Comprobantes
**Propósito**: Extraer automáticamente monto y fecha de imágenes de vouchers/comprobantes bancarios.

**Flujos de provisión de imagen**:
- Drag & drop
- Click para seleccionar archivo
- Ctrl+V (paste desde clipboard)

**Pipeline OCR**:
1. **Google Cloud Vision API** (primario, si hay credenciales)
2. **Tesseract.js** (fallback open-source, si Vision falla)
3. **Mock** (en desarrollo sin credenciales configuradas)

**Extracción**:
- Monto: regex tolerante a formatos peruanos (1,234.50 / 1.234,50)
- Fecha: formatos dd/mm/yyyy, dd-Mes-yyyy, con hora opcional

**Validación cruzada**:
- Si el monto manual difiere del OCR → warning no bloqueante (naranja)
- Si la fecha manual difiere del OCR → warning no bloqueante (naranja)
- Nunca bloquea el registro

**Estado**: ✅ Implementado (con fallback a Tesseract.js)

---

### 3.7 Configuración Admin
**Propósito**: CRUD de las tablas de configuración que alimentan los selects del sistema.

**Tablas configurables**:
| Tabla | Campos | Descripción |
|-------|--------|-------------|
| `config_agentes` | id, nombre | Agentes operadores |
| `config_categorias` | id, categoria, subcategoria | Categorías de gastos |
| `config_bancos` | id, nombre, propietario | Bancos y wallets |
| `config_settings` | key, value, fecha_efectiva, actualizado_por, actualizado_en | Ajustes singulares del sistema |
| `config_cajas` | id, nombre | Puntos de caja |
| `config_tipos_pago` | id, nombre | Métodos de pago |
| `config_usuarios` | id, nombre | Jugadores (para autocompletado) |

**Funcionalidades**:
- Agregar registro individual
- Eliminar registro
- Importación masiva (CSV/texto) para usuarios (jugadores)
- Seed data por defecto cuando las tablas están vacías
- Ajustes singleton en `config_settings` para valores operativos como `caja_inicio_mes`

**Estado**: ✅ Implementado

---

### 3.8 Auditoría (Audit Trail)
**Propósito**: Registrar toda mutación en el sistema de forma inmutable.

**Campos de auditoría**:
- `id` — identificador único
- `action` — tipo: create, update, delete
- `entity` — entidad afectada: pago, ingreso, gasto, banco
- `user` — usuario que realizó la acción
- `timestamp` — fecha/hora ISO
- `changes` — JSON con los datos del cambio

**Reglas**:
- Todo create, update y delete genera un registro de auditoría
- El registro de auditoría es append-only (nunca se modifica ni borra)

**Estado**: ✅ Implementado (backend only, sin interfaz de consulta)

---

### 3.9 Permisos y Autenticación
**Propósito**: Controlar acceso por rol.

**Implementación actual** (MVP):
- Headers HTTP: `x-role` y `x-user`
- Sin JWT ni sesiones — placeholder para V1
- Validación en backend con middlewares `requireAuth` y `requireAdmin`
- Selector de rol/usuario en el sidebar (dev-friendly)

**Restricciones**:
- Ingresos, Gastos, Bancos, Configuración → solo Admin
- Pagos → cualquier usuario autenticado
- Balance → lectura para todos

**Estado**: ⚠️ Funcional como placeholder. No apto para producción.

---

## 4. Modelo de Datos (Google Sheets)

Cada "tabla" es una hoja (sheet) dentro de un mismo spreadsheet:

| Hoja | Headers |
|------|---------|
| `pagos` | id, usuario, caja, banco, monto, tipo, comprobante_url, fecha_comprobante, fecha_registro, agente |
| `ingresos` | id, agente, banco, monto, fecha_movimiento, fecha_registro |
| `gastos` | id, fecha_gasto, fecha_registro, concepto, categoria, subcategoria, banco, monto |
| `bancos` | id, fecha, banco, saldo |
| `audit` | id, action, entity, user, timestamp, changes |
| `config_agentes` | id, nombre |
| `config_categorias` | id, categoria, subcategoria |
| `config_bancos` | id, nombre, propietario |
| `config_settings` | key, value, fecha_efectiva, actualizado_por, actualizado_en |
| `config_cajas` | id, nombre |
| `config_tipos_pago` | id, nombre |
| `config_usuarios` | id, nombre |

---

## 5. Flujos Operativos Clave

### Flujo de Pago (Operación Principal)
```
Agente abre /pagos
→ (Opcional) Arrastra/pega voucher → OCR extrae monto y fecha
→ Ingresa usuario (autocompletado), selecciona caja, banco, tipo
→ Ingresa/confirma monto y fecha
→ Warnings no bloqueantes si hay discrepancia OCR o usuario desconocido
→ Click "Registrar Pago"
→ Backend valida → persiste en Sheets → registra auditoría
→ Confirmación visual → campo de usuario se enfoca automáticamente para siguiente pago
```
**Meta**: <10 segundos por pago desde que se ingresa el usuario hasta confirmación.

### Flujo de Cierre Diario
```
Admin abre /bancos
→ Para cada banco, ingresa saldo de cierre del día
→ Si ya existía un registro del mismo día/banco, se sobrescribe (upsert)
→ Admin abre /balance para verificar consistencia global
```

### Flujo de Carga de Caja
```
Admin abre /ingresos
→ Selecciona agente, banco, monto
→ Registra ingreso → suma al balance del agente
```

---

## 6. Métricas de Éxito MVP

| Métrica | Objetivo |
|---------|----------|
| Tiempo por pago | < 10 segundos |
| Trazabilidad | 100% de movimientos auditados |
| Consistencia | Balance global = Σ cajas + Σ bancos - Σ gastos |
| Disponibilidad | Funciona offline con in-memory fallback |

---

## 7. Fuera del Alcance MVP

- Autenticación real (JWT, OAuth)
- Multi-tenancy
- Reportes exportables (PDF/Excel)
-Historial de cambios con diff visual
- Notificaciones push
- Móvil nativo
- Conciliación automática banco vs pagos
- Almacenamiento permanente de imágenes de comprobantes
- Paginación de tablas
- Filtros y búsqueda avanzada en listas
- Edición/anulación de registros existentes
- Cierre de caja formal (cuadre de agente)

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Google Sheets API rate limits | Media | Alto | In-memory fallback, batching futuro |
| OCR impreciso | Alta | Bajo | Warning no bloqueante, input manual siempre disponible |
| Auth débil en MVP | Alta | Alto | Solo uso interno, no exponer a internet sin auth real |
| Pérdida de datos por error en Sheets | Baja | Crítico | Auditoría completa permite reconstrucción |
| Concurrencia en escritura a Sheets | Media | Medio | Escritura secuencial, no hay locks |

---

## 9. Evolución Post-MVP

1. **Auth real** — Implementar JWT o integrar con Google OAuth
2. **Filtros y paginación** — Para cuando los datos crezcan
3. **Cierre de caja** — Proceso formal de cuadre por agente/día
4. **Reportes** — Exportación a Excel por rango de fechas
5. **Almacenamiento de comprobantes** — Google Drive o Cloud Storage
6. **Edición y anulación** — Con registro de auditoría del cambio
7. **Conciliación** — Cruce automático entre pagos registrados y movimientos bancarios
