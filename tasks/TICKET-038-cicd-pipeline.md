# TICKET-038: CI/CD Pipeline (GitHub Actions)

> **Estado**: ✅ COMPLETADO  
> **Sprint**: 6 — Hardening  
> **Esfuerzo**: ~3h  
> **Prioridad**: P2 — Medium (automation)  
> **Tipo**: DevOps / CI-CD

---

## Problema

- Tests existen ([backend/tests/](../backend/tests/)) pero nadie los corre automáticamente en push
- Sin garantía de que el código en main es testeado
- Sin automatización de build/deploy
- Riesgo de mergear código roto

---

## Solución

### GitHub Actions Workflow

Crear `.github/workflows/test-and-build.yml`:

```yaml
name: Tests & Build

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      # Backend tests
      - name: Backend — npm install
        run: cd backend && npm ci
      
      - name: Backend — syntax check
        run: cd backend && npm test
      
      # Frontend build
      - name: Frontend — npm install
        run: cd frontend && npm ci
      
      - name: Frontend — build
        run: cd frontend && npm run build
      
      - name: Frontend — linting
        run: cd frontend && npm run lint

  security-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        run: |
          cd backend && npm audit --audit-level=moderate || true
          cd ../frontend && npm audit --audit-level=moderate || true

  docker-build:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [test, security-check]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Configuración para auto-deploy (opcional)

Si uses Render/Railway/Cloud Run, agregar step al final del workflow:

```yaml
  deploy:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: docker-build
    
    steps:
      - name: Deploy to Render
        run: |
          curl -X POST \
            https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_API_KEY }}
```

### Pre-commit Hook (local, opcional)

Crear `.husky/pre-commit` para que developers no hagan push roto:

```bash
#!/bin/sh
cd backend && npm test && cd ../frontend && npm run lint
```

---

## Archivos

- `.github/workflows/test-and-build.yml` (nuevo)
- `.husky/pre-commit` (opcional, para dev experience)
- `backend/package.json` — ya tiene `"test"` script
- `frontend/package.json` — ya tiene `"build"` y `"lint"`
- `.env.example` — documentar que CI corre sin credenciales GCP

---

## Criterios de Aceptación

- [ ] Workflow corre en cada push a main
- [ ] Backend tests pasan (8 suites node:test)
- [ ] Frontend builds sin errores
- [ ] npm audit no bloquea (solo reporte)
- [ ] Docker builds sin errores en main
- [ ] PR bloqueada si tests fallan
- [ ] Status badge en README mostrando build status
- [ ] Logs de CI visibles en GitHub (Actions tab)

---

## Definición de Terminado

Código en main siempre pasa tests; imposible mergear roto.
