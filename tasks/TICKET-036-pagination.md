# TICKET-036: Paginación en listados de movimientos

> **Estado**: 🔴 PENDIENTE  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~3h  
> **Prioridad**: P2 — Medium (ops/escala)  
> **Tipo**: Feature / Performance

---

## Problema

Actualmente todos los GETs traen rangos completos `A:Z` de Google Sheets:
- `GET /api/pagos` — trae TODOS los pagos (sin paginación)
- `GET /api/ingresos` — trae TODOS
- `GET /api/gastos` — trae TODOS
- `GET /api/audit` — trae TODOS

A 1000+ registros:
- Latencia alta (múltiples requests a Sheets API)
- Riesgo de exceder rate-limit de Sheets (100 req/100 seg/usuario)
- Memoria/JSON grandes en red
- UX lenta (tabla tarda segundos en renderizar)

---

## Solución

### Backend

Añadir query params `limit` y `offset` a los GETs:

1. **routes**:
   ```javascript
   router.get('/', verifyToken, requireAuth, controller.getAll);
   ```
   (sin cambios en ruta)

2. **controllers** (ej. pagos.controller.js):
   ```javascript
   async function getAll(req, res, next) {
     try {
       const { agente, desde, hasta, banco, usuario, limit = 50, offset = 0 } = req.query;
       const filters = { agente, desde, hasta, banco, usuario };
       const page = await pagosService.getPagedAndFiltered(filters, limit, offset);
       res.json({ status: 'success', data: page });
     } catch (error) {
       next(error);
     }
   }
   ```

3. **services** (ej. pagos.service.js):
   ```javascript
   async function getPagedAndFiltered(filters = {}, limit = 50, offset = 0) {
     // Validar límites
     limit = Math.min(Math.max(parseInt(limit) || 50, 1), 500); // 1-500
     offset = Math.max(parseInt(offset) || 0, 0);

     // Obtener todos (sin paginación en Sheets, se filtra después)
     let rows = await repo.getAll(SHEET_NAME);
     
     // Aplicar filtros
     rows = filterPagos(rows, filters);

     // Calcular total
     const total = rows.length;

     // Paginar
     const items = rows.slice(offset, offset + limit);

     return {
       items,
       pagination: {
         limit,
         offset,
         total,
         hasMore: offset + limit < total,
       },
     };
   }
   ```

### Frontend

Actualizar llamadas a API para manejar paginación:

1. **lib/api.ts** - agregar a interfaces:
   ```typescript
   interface PagosFilters {
     agente?: string;
     desde?: string;
     hasta?: string;
     banco?: string;
     usuario?: string;
     limit?: number;
     offset?: number;
   }

   async function getPagos(filters?: PagosFilters) {
     // incluyendo limit y offset en query string
   }
   ```

2. **app/pagos/page.tsx** - state para paginación:
   ```typescript
   const [currentPage, setCurrentPage] = useState(0);
   const [pageSize, setPageSize] = useState(50);
   
   async function loadPagos() {
     const response = await getPagos({
       ...filters,
       limit: pageSize,
       offset: currentPage * pageSize,
     });
     setPagos(response.data.items);
     setTotal(response.data.pagination.total);
   }
   ```

3. **Componentes de paginación** (nuevo o mejora de existente):
   ```html
   <div className="pagination">
     <button 
       onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
       disabled={currentPage === 0}
     >
       ← Anterior
     </button>
     <span>{currentPage + 1} de {Math.ceil(total / pageSize)}</span>
     <button 
       onClick={() => setCurrentPage(p => p + 1)}
       disabled={(currentPage + 1) * pageSize >= total}
     >
       Siguiente →
     </button>
   </div>
   ```

### API Response

Nueva estructura:

```json
{
  "status": "success",
  "data": {
    "items": [ /* 50 pagos */ ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 523,
      "hasMore": true
    }
  }
}
```

---

## Archivos

Backend:
- `backend/services/pagos.service.js` — agregar `getPagedAndFiltered()`
- `backend/services/ingresos.service.js` — igual
- `backend/services/gastos.service.js` — igual
- `backend/services/audit.service.js` — igual
- Controllers no cambian (delegation a service)

Frontend:
- `frontend/src/lib/api.ts` — interfaces + parámetros
- `frontend/src/app/pagos/page.tsx` — state + loadPagos() + UI paginación
- `frontend/src/app/ingresos/page.tsx` — igual
- `frontend/src/app/gastos/page.tsx` — igual
- `frontend/src/app/audit/page.tsx` — igual

---

## Criterios de Aceptación

- [ ] `GET /api/pagos?limit=50&offset=0` retorna max 50 items
- [ ] Response incluye `pagination.total`, `hasMore`
- [ ] `offset=100&limit=50` retorna items 100-149 (si existen)
- [ ] Filtros + paginación funcionan combinados (`?desde=2026-04-01&limit=50&offset=0`)
- [ ] Frontend muestra botones Anterior/Siguiente
- [ ] Contador muestra página actual vs total
- [ ] Sin parámetros, default limit=50 offset=0
- [ ] limit máximo capped a 500 (previene abuso)
- [ ] Tests: múltiples páginas, edge cases (offset > total, etc.)

---

## Definición de Terminado

Escala a 5000+ registros sin latencia perceptible.
