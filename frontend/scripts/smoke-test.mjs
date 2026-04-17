import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing expected file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const api = read('src/lib/api.ts');
assert(api.includes('DEFAULT_TIMEOUT_MS = 10_000'), 'API timeout should be 10 seconds');
assert(api.includes('RETRY_DELAY_MS = 250'), 'API retry delay should exist');
assert(api.includes('checkBackendHealth'), 'Backend health check should be exposed');
assert(api.includes('performRequest'), 'Core request helper should exist');

const alertBanner = read('src/components/AlertBanner.tsx');
assert(alertBanner.includes('success: 4000'), 'Success alerts should auto-dismiss after 4s');
assert(alertBanner.includes('error: 0'), 'Error alerts should persist until dismissed');
assert(alertBanner.includes("role={type === 'error' ? 'alert' : 'status'}"), 'Alert ARIA role should reflect severity');

const backendStatus = read('src/components/BackendStatusBanner.tsx');
assert(backendStatus.includes('checkBackendHealth'), 'Backend status banner should ping the backend');

const globals = read('src/app/globals.css');
assert(globals.includes('.skeleton-card'), 'Skeleton styles should exist');
assert(globals.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion support should exist');

const clientLayout = read('src/app/client-layout.tsx');
assert(clientLayout.includes('BackendStatusBanner'), 'Backend status banner should be mounted globally');

const pagos = read('src/app/pagos/page.tsx');
assert(pagos.includes('TableSkeleton'), 'Pagos page should render skeleton tables');
assert(pagos.includes('disabled={submitting || loading || !config}'), 'Pagos submit should be blocked while loading');

const ingresos = read('src/app/ingresos/page.tsx');
assert(ingresos.includes('TableSkeleton'), 'Ingresos page should render skeleton tables');
assert(ingresos.includes('disabled={submitting || loading || !config}'), 'Ingresos submit should be blocked while loading');

const gastos = read('src/app/gastos/page.tsx');
assert(gastos.includes('TableSkeleton'), 'Gastos page should render skeleton tables');
assert(gastos.includes('disabled={submitting || loading || !config}'), 'Gastos submit should be blocked while loading');

const bancos = read('src/app/bancos/page.tsx');
assert(bancos.includes('TableSkeleton'), 'Bancos page should render skeleton tables');
assert(bancos.includes('disabled={submitting || loading || !config}'), 'Bancos submit should be blocked while loading');

const config = read('src/app/configuracion/page.tsx');
assert(config.includes('TableSkeleton'), 'Configuracion page should render skeleton tables');
assert(config.includes('disabled={submitting || loading}'), 'Configuracion actions should be disabled during loading');

console.log('Smoke tests passed.');
