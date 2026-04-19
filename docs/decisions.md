# Decisiones Técnicas — Golden City Backoffice

> **Versión**: 1.5  
> **Última actualización**: 2026-04-19

Este documento registra las decisiones técnicas clave del proyecto, con su contexto, alternativas evaluadas y razón de la elección. Se actualiza conforme evoluciona el proyecto.

---

## ADR-001: Google Sheets como Base de Datos

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-05  

### Contexto
El negocio ya opera con hojas de cálculo para llevar la contabilidad. La barrera de adopción debe ser mínima. El MVP necesita estar operativo rápidamente.

### Alternativas evaluadas
| Opción | Pros | Contras |
|--------|------|---------|
| PostgreSQL | Robusto, relacional, escalable | Requiere hosting, migración, más setup |
| SQLite | Sin servidor, rápido | No compartible, no visible para el dueño |
| Firebase Firestore | Serverless, real-time | Vendor lock-in, más complejidad |
| **Google Sheets** | Familiar, visible, gratis, auditable visualmente | Rate limits, no relacional, lento para volumen alto |

### Decisión
Usar Google Sheets API v4 como base de datos no relacional del MVP. Cada "tabla" es una hoja del spreadsheet.

### Consecuencias
- El dueño puede ver los datos directamente en Google Sheets
- Hay un límite de ~100 requests/100 segundos/usuario
- No hay transacciones atómicas — escritura secuencial
- Se implementa un **fallback in-memory** para desarrollo sin credenciales

### Mitigaciones
- El repository abstrae ambos modos (Sheets / in-memory)
- Para volúmen futuro, migrar a PostgreSQL cambiando solo el repository layer

---

## ADR-002: Express.js (no Next.js API Routes) para el Backend

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-05  

### Contexto
Next.js ofrece API Routes integradas, pero el backend tiene lógica compleja (OCR, auditoría, cálculos financieros).

### Decisión
Backend separado con Express.js. Frontend y backend corren como procesos independientes.

### Razones
- Separación clara de responsabilidades
- Express permite middleware chain más flexible
- El backend puede desplegarse independientemente
- Más fácil de testear la API sin el frontend
- Patrón Controller → Service → Repository más limpio en Express

### Consecuencias
- CORS necesario entre puertos 3000 y 3001
- Dos procesos que gestionar en desarrollo
- No hay SSR data fetching nativo (todo es client-side fetch)

---

## ADR-003: Vanilla CSS vs TailwindCSS

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Decisión
Vanilla CSS con un design system basado en CSS custom properties (variables).

### Razones
- Control total sobre el design system
- Sin dependencia de build tools extra
- Tema dark premium con gradientes y animaciones personalizadas
- Archivos CSS separados por componente/página (mantenibilidad)
- Consistencia con las reglas del agente que especifican "Estilos: Vanilla CSS"

### Implementación
- `globals.css` contiene: reset, variables, components (botones, inputs, tablas, badges, animaciones)
- Cada página/componente tiene su propio `.css`

---

## ADR-004: Autenticación MVP con Headers HTTP

**Estado**: ⛔ **Superseded por ADR-014**  
**Fecha**: 2026-04-08  
**Reemplazado**: 2026-04-16

Este ADR está reemplazado. Ver ADR-014 para la implementación de JWT en producción.

---

## ADR-005: OCR con Google Vision + Tesseract.js Fallback

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Contexto
Los agentes suben fotos de comprobantes bancarios (vouchers) para agilizar el registro de pagos. Se necesita extraer monto y fecha automáticamente.

### Decisión
Pipeline de 3 niveles:
1. **Google Cloud Vision API** (mejor precisión, costo por uso)
2. **Tesseract.js** (fallback gratuito, menor precisión)
3. **Mock** (en desarrollo, sin credenciales)

### Razones
- Vision API es el estándar para OCR de alta calidad
- Si Vision falla (facturación no activa, error de red), Tesseract.js responde localmente
- El mock permite desarrollo offline sin dependencias externas
- Nunca es bloqueante: si OCR falla, el agente ingresa datos manualmente

### Implementación
- Las imágenes se redimensionan a max 1200px en el frontend antes de enviar
- El backend recibe base64.
- Regex financiero extrae montos y fechas del texto crudo
- Discrepancias entre OCR e input manual generan warnings (nunca bloquean)

---

## ADR-006: Patrón Controller → Service → Repository

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Decisión
El backend sigue un patrón de 3 capas estricto.

### Responsabilidades

| Capa | Responsabilidad | No hace |
|------|----------------|---------|
| **Controller** | Maneja req/res, delega a service | No contiene lógica de negocio |
| **Service** | Lógica de negocio, cálculos, auditoría | No accede a req/res |
| **Repository** | Abstracción de persistencia (Sheets/memory) | No conoce reglas de negocio |

### Razones
- Facilita testing (cada capa testeable independientemente)
- Permite cambiar la base de datos sin tocar la lógica
- Separación clara de concerns

---

## ADR-007: Timezone Lima (America/Lima UTC-5)

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Decisión
Todas las fechas y horas del sistema usan timezone `America/Lima` (UTC-5).

### Implementación
- `config/timezone.js` centraliza `nowLima()` y `todayLima()`
- Frontend usa `Intl.DateTimeFormat` con timezone Lima para formateo
- Las fechas se almacenan en formato ISO con hora de Lima

### Razón
El negocio opera en Lima, Perú. Usar UTC causaría confusión en los reportes de cierre diario.

---

## ADR-008: Validación con Zod en Backend

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Decisión
Usar Zod para validar todas las entradas de escritura en el backend.

### Implementación
- Un schema Zod por entidad (pagos, ingresos, gastos, bancos)
- Middleware `validate.middleware.js` genérico que aplica cualquier schema
- Errores devueltos con formato `{ error: 'Datos inválidos', details: [{ field, message }] }`

### Razones
- Type-safe, composable, buen soporte TypeScript
- Mensajes de error claros en español
- Lightweight y sin dependencias

---

## ADR-009: IDs Basados en Timestamp

**Estado**: ⚠️ Aceptable para MVP  
**Fecha**: 2026-04-08  

### Decisión
Los IDs se generan como `{PREFIJO}-{Date.now()}-{counter}`, donde el counter se resetea al reiniciar el servidor.

### Razones
- Simple, sin dependencias
- En Google Sheets no hay autoincrement
- El timestamp proporciona unicidad razonable

### Riesgos
- Si el servidor se reinicia, los counters empiezan de 0 — posible colisión teórica (mitigada por el timestamp en ms)
- No son UUIDs estándar

### Plan futuro
Para producción robusta, considerar `crypto.randomUUID()` o `nanoid`.

---

## ADR-010: Seed Data en Configuración

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-08  

### Decisión
Las tablas de configuración tienen datos por defecto (seed) que se muestran cuando la tabla en Sheets está vacía.

### Implementación
- `config.service.js` contiene un objeto `SEED_DATA` con datos iniciales por tabla
- Si `getAll()` retorna vacío, se devuelve el seed data
- Al agregar datos reales, el seed se ignora

### Razones
- Permite usar la app inmediatamente sin configurar Google Sheets
- Facilita desarrollo y demos
- No se escribe seed en Sheets automáticamente (no contamina datos reales)

---

## ADR-011: Error Handling con Jerarquía de Errores + Retry

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Implementar una jerarquía de clases de error (`AppError`) con error handler global en Express y retry con backoff exponencial en el repository.

### Implementación
- `utils/appError.js`: 7 clases — AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, RateLimitError, ExternalServiceError, ValidationError
- `middleware/errorHandler.js`: error handler global con logging JSON estructurado, serialización segura, stack trace solo en development
- `sheetsRepository.js`: retry (max 3 intentos) con backoff exponencial (250ms base) para errores transitorios (429, 500, 502, 503, 504, ECONNRESET, ETIMEDOUT)
- Errores de Sheets API se normalizan a clases AppError apropiadas

### Razones
- Errores operacionales vs programáticos claramente separados
- El frontend recibe mensajes en español, no stack traces
- Rate limits de Google Sheets se manejan automáticamente
- Logs estructurados permiten diagnóstico sin acceso al código

---

## ADR-012: Validación Referencial No Bloqueante

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Validar que los valores de campos FK (banco, caja, tipo, agente) existan en las tablas de configuración. Si no existen, generar **warning no bloqueante** (el registro se crea igualmente).

### Implementación
- `config.service.js::validateReferences()`: recibe array de checks, busca en tablas config, retorna array de warnings
- Cache de tablas por request (Map) para evitar lecturas duplicadas
- Warnings se registran en auditoría como `action: 'warning'`
- Los services de pagos, ingresos y gastos llaman a `validateReferences()` antes de crear
- El controller incluye `warnings` en la respuesta JSON
- El frontend muestra warnings con AlertBanner tipo 'warning'

### Razones
- No bloquear la operación por datos de config incompletos (priorizar velocidad operativa)
- Mantener trazabilidad de inconsistencias via auditoría
- Permitir al operador decidir si corrige o continúa

---

## ADR-013: Resiliencia Frontend (Timeout, Retry, Health Polling)

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Hacer el frontend resiliente a fallos de red y latencia del backend mediante timeout, retry automático y health polling.

### Implementación
- `api.ts::performRequest()`: timeout de 10s vía AbortController
- `api.ts::request()`: 1 retry automático para errores de red/timeout antes de mostrar error
- `api.ts::ApiError`: errores tipados con `kind` (network, timeout, http, parse) para mensajes amigables
- `BackendStatusBanner.tsx`: polling cada 20s al endpoint `/api/health`, muestra banner rojo persistente si el backend no responde
- `TableSkeleton.tsx`: skeleton loader genérico para tablas mientras cargan datos
- Botones de submit deshabilitados mientras config no ha cargado

### Razones
- Google Sheets API puede tener latencia variable
- En red local (caso de uso MVP), las desconexiones temporales son comunes
- El operador necesita feedback inmediato sobre el estado del sistema

---

## ADR-014: Autenticación JWT + bcrypt

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Reemplazar auth por headers HTTP con JWT basado en credenciales username/password almacenadas en la tabla `config_auth_users` de Google Sheets, con hashing bcrypt.

### Implementación
- ~~Tabla `config_auth_users`~~ → **Supersedido por ADR-021**: la fuente de identidad es ahora `config_agentes` (headers: id, nombre, username, password_hash, role, activo)
- Bootstrap automático con 2 usuarios: `admin` y `agent` (credenciales configurables vía env)
- Endpoint `POST /api/auth/login`: valida credenciales, retorna JWT firmado
- Middleware `verifyToken`: extrae Bearer token del header `Authorization`, verifica con `jwt.verify()`
- Token expira en 24h (configurable)
- Logout client-side: elimina token de localStorage

### Razones
- Seguridad: credenciales no viajan en cada request (diferente a headers falsos)
- JWT es estándar OAuth2-compatible para futuras integraciones
- Almacenar en Sheets mantiene coherencia con la arquitectura (single source of truth)
- Bootstrap automático facilita demo sin CRUD usuarios manual

### Mitigaciones aplicadas
- `JWT_SECRET` es obligatorio en producción; el fallback inseguro quedó restringido a desarrollo local (TICKET-033).
- Las credenciales bootstrap se exigen por env en producción; los defaults solo existen como ayuda de desarrollo (TICKET-033).
- El login tiene rate-limit específico y el backend aplica Helmet + limiter global moderado (TICKET-034).
- Los GETs financieros quedan protegidos con JWT; solo `/api/config` general permanece público por diseño (TICKET-032).

---

## ADR-015: Soft-delete con campo `estado`

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Implementar anulación/eliminación lógica (soft-delete) mediante campo `estado` en pagos, ingresos y gastos. Las filas nunca se borran; sólo cambian de `estado='activo'` a `estado='anulado'`.

### Implementación
- Cada movimiento (pago/ingreso/gasto) tiene campo `estado` en HEADERS
- Endpoints `DELETE /api/{pagos,ingresos,gastos}/:id` (admin-only) ejecutan `cancel()` service: actualiza `estado='anulado'` + auditoría
- `balance.service.js` filtra (`isPagoActivo()`, etc.) para excluir `estado='anulado'` de cálculos
- Auditoría registra: action='cancel', entidad anterior, motivo de anulación
- Frontend visualiza registros anulados: tachado, gris, badge rojo

### Razones
- Trazabilidad: nunca pierde datos, auditoría completa
- Cumplimiento: registros immutables de transacciones financieras
- Flexibilidad: permite reversar anulaciones en el futuro si es necesario

### Alternativa rechazada
- Hard-delete: pérdida irreversible de datos, imposible auditar reversals

---

## ADR-016: Filtros server-side en listados de pagos

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Implementar filtros en el backend (`GET /api/pagos`) mediante query parameters: `desde`, `hasta`, `agente`, `banco`, `usuario`.

### Implementación
- Query params se normalizan: fechas a formato ISO, valores a lowercase
- `pagos.service.js::getFiltered()` aplica 4 filtros con lógica AND
- Rango de fecha: `normalizeDateOnly()` maneja DD/MM/YYYY e ISO
- Búsqueda de usuario: case-insensitive partial match
- Combinaciones múltiples soportadas (`?desde=2026-04-01&agente=juan`)
- Frontend: form con inputs para cada filtro, envía query string

### Razones
- Performance: filtra en el servidor, no trae 10k filas innecesarias
- Facilita búsqueda diaria por rango/agente
- Interfaz clara en UI con contador de resultados

### Limitación conocida
- Sin paginación (TICKET-036): a muchos registros, sigue trayendo todo

---

## ADR-017: Auditoría consultable vía API

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-16  

### Decisión
Exponer el log de auditoría mediante endpoint `GET /api/audit` (admin-only) con filtros de búsqueda.

### Implementación
- Tabla `audit` en Sheets: id, timestamp, action, entity, user, changes (JSON)
- `audit.service.js::getFiltered()` con 5 filtros: `entity`, `action`, `user`, `desde`, `hasta`
- Búsquedas case-insensitive partial match
- JSON de cambios es parseado y expandible en frontend (`<details>`)
- Resultados ordenados DESC por timestamp

### Razones
- Trazabilidad accesible a admins sin acceso directo a Sheets
- Filtros facilitan investigación de cambios específicos
- JSON expandible permite revisar exactamente qué cambió

---

---

## ADR-018: Almacenamiento de comprobantes en Google Drive

**Estado**: ⛔ Superseded por ADR-020
**Fecha**: 2026-04-17

### Contexto
Los pagos incluyen una imagen de comprobante (voucher bancario). La imagen se procesa con OCR pero no se almacena. La celda `comprobante_url` en Sheets queda con un blob URL temporal del navegador, inútil tras cerrar la sesión.

### Alternativas evaluadas

| Opción | Pros | Contras |
|--------|------|---------|
| Base64 en Sheets | Sin dependencias extra | Celda limitada a ~50k chars; inviable para imágenes |
| Filesystem backend | Simple | Se pierde con redeploy del contenedor; no compartible |
| Cloudinary / S3 | Robusto, CDN | Vendor extra, costo, credenciales adicionales |
| **Google Drive** | Reutiliza SA existente, sin costo extra, coherente con stack | Requiere scope adicional y carpeta compartida manual |

### Decisión
Ver ADR-020 para la solución vigente con Cloudflare R2.

### Reemplazo
- Sustituido por ADR-020

### Consecuencias
- Comprobantes accesibles vía link permanente para admins con acceso a la carpeta
- Requiere paso manual: crear carpeta Drive y compartirla con el SA
- Scope `drive.file` puede requerir actualizar las credenciales del SA

---

## ADR-019: Batch append para importaciones masivas a Sheets

**Estado**: ✅ Vigente
**Fecha**: 2026-04-17

### Contexto
La importación masiva de usuarios (y otras entidades de config) realiza una llamada individual a `values.append` por cada fila. Con 162 usuarios = 162 API calls, superando el límite de ~100 req/100s definido en ADR-001. Solo ~33 registros persisten antes de que el rate-limit aborte el proceso.

### Decisión
Implementar `repo.appendBatch(sheetName, rows[])` que agrupa todas las filas en **una sola llamada** a la Google Sheets API (`values.append` acepta array de arrays). Para payloads muy grandes (>500 filas densas), partir en chunks con delay mínimo entre chunks.

### Razones
- La API de Sheets soporta nativamente múltiples filas en un solo request.
- 1 call vs N calls: elimina el rate-limit como limitante para volúmenes operativos normales.
- La auditoría colapsa a 1 evento con `count`, en lugar de N eventos individuales.

### Consecuencias
- `appendBatch` reemplaza el loop de `append` en `importBatch`.
- El método `append` individual se mantiene para operaciones de fila única.
- Si la operación falla, ninguna fila parcial queda en Sheets (operación atómica desde perspectiva de la API).

---

## ADR-020: Cloudflare R2 como almacenamiento de comprobantes

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-18

### Contexto
Los comprobantes de pago necesitan persistencia real y un identificador reutilizable. Google Drive funcionaba como idea inicial, pero el caso de uso aquí es el de almacenamiento de objetos y no el de colaboración documental.

### Alternativas evaluadas

| Opción | Pros | Contras |
|--------|------|---------|
| Google Drive | Reutiliza Service Account existente | Modelo de permisos menos natural para archivos de aplicación |
| AWS S3 | Estándar de facto | Costo y egress menos convenientes para el MVP |
| **Cloudflare R2** | S3-compatible, sin egress, coste bajo, simple de integrar | Requiere credenciales y bucket propios |

### Decisión
Usar Cloudflare R2 como almacenamiento persistente de comprobantes. El backend sube el objeto con `PutObject`, guarda la key en `comprobante_file_id` y la URL pública en `comprobante_url`.

### Consecuencias
- Los comprobantes sobreviven al cierre de sesión y al redeploy.
- Se desacopla el almacenamiento de la interfaz del navegador.
- El acceso al archivo depende de `R2_PUBLIC_URL` y de la política del bucket.

### Mitigaciones
- Degradación elegante: si R2 falla, el pago igual se registra y se deja warning.
- La configuración queda centralizada por variables de entorno.

---

## ADR-021: Identidad unificada en `config_agentes`

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-18

### Contexto
La identidad operativa se estaba duplicando entre `config_auth_users` y `config_agentes`. Eso complica el scoping, la migración de datos y el mantenimiento de reglas que dependen del propietario.

### Alternativas evaluadas

| Opción | Pros | Contras |
|--------|------|---------|
| Mantener dos fuentes | Menor cambio inmediato | Duplicación, inconsistencia y más lógica de sincronización |
| **Una sola tabla (`config_agentes`)** | Fuente única, más simple para scoping y migraciones | Requiere migración y ajuste de auth |

### Decisión
`config_agentes` pasa a ser la fuente única de identidad operativa. `config_auth_users` se migra y se elimina como fuente primaria mediante TICKET-054.

### Consecuencias
- Los agentes y la autenticación comparten el mismo registro base.
- Las referencias de propietario quedan alineadas con el resto del modelo.
- El código de scoping deja de depender de duplicación de datos.

### Mitigaciones
- Migración controlada con respaldo de los datos existentes.
- Fallback temporal en lectura mientras se completa la transición.

---

## ADR-022: `banco_id` como FK en movimientos

**Estado**: ✅ Vigente  
**Fecha**: 2026-04-18

### Contexto
Usar el nombre del banco como texto libre no permite scoping fiable ni validación referencial. Tampoco facilita migraciones ni comparaciones consistentes entre movimientos y saldos.

### Alternativas evaluadas

| Opción | Pros | Contras |
|--------|------|---------|
| Texto libre `banco` | Simple de mostrar | Ambiguo, frágil y difícil de validar |
| FK opcional | Más flexible | Mantiene ambigüedad si no se normaliza |
| **`banco_id` como FK** | Determinístico, validable, apto para scoping | Requiere migración y normalización histórica |

### Decisión
Los movimientos y saldos bancarios referencian bancos por `banco_id`. El nombre queda como dato derivado para presentación.

### Consecuencias
- El scoping por propietario es determinista.
- Se simplifican filtros y validaciones.
- El modelo soporta migración histórica sin ambigüedad.

### Mitigaciones
- Migración de datos legacy vía TICKET-053.
- Compatibilidad temporal con registros antiguos durante el rollout.

---

## Registro de Cambios

| Fecha | ADR | Cambio |
|-------|-----|--------|
| 2026-04-15 | 001-010 | Documentación inicial de todas las decisiones existentes |
| 2026-04-16 | 011-013 | ADRs para error handling, validación referencial y resiliencia frontend |
| 2026-04-16 | 004 | ADR-004 marcado Superseded por ADR-014 |
| 2026-04-16 | 014-017 | ADRs para JWT auth, soft-delete estado, filtros pagos, audit UI |
| 2026-04-17 | 018-019 | ADRs para comprobantes en Drive e importación batch; revisión post-UAT Sprint 6 |
| 2026-04-18 | 018, 020-022 | ADR-018 superseded y nuevas decisiones para R2, identidad unificada y `banco_id` FK |
| 2026-04-19 | 014 | ADR-014 actualizado: fuente de identidad migrada de `config_auth_users` a `config_agentes` per ADR-021 |
