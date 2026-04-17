const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 250;
const AUTH_INVALID_EVENT = 'golden-city:auth-invalid';
const AUTH_SESSION_KEY = 'gc_auth_session';

export interface AuthUser {
  userId: string;
  username: string;
  role: string;
  nombre: string;
}

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

interface MutationResponse<T> {
  status: string;
  data: T;
  warnings?: string[];
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

interface AuthResponse {
  status: string;
  data: StoredAuthSession;
}

export interface PagoRecord {
  id: string;
  estado?: string;
  usuario: string;
  caja: string;
  banco: string;
  monto: string | number;
  tipo: string;
  comprobante_url?: string;
  fecha_comprobante?: string;
  fecha_registro?: string;
  agente?: string;
}

export interface IngresoRecord {
  id: string;
  estado?: string;
  agente: string;
  banco: string;
  monto: string | number;
  fecha_movimiento: string;
  fecha_registro?: string;
}

export interface GastoRecord {
  id: string;
  estado?: string;
  concepto: string;
  categoria: string;
  subcategoria?: string;
  banco: string;
  monto: string | number;
  fecha_gasto: string;
  fecha_registro?: string;
}

export interface AuditRecord {
  id: string;
  action: string;
  entity: string;
  user: string;
  timestamp: string;
  changes: Record<string, unknown> | string;
}

export class ApiError extends Error {
  kind: 'network' | 'timeout' | 'http' | 'parse';
  status?: number;

  constructor(message: string, kind: 'network' | 'timeout' | 'http' | 'parse', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function getStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function persistStoredSession(session: StoredAuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(AUTH_SESSION_KEY);
}

function notifyAuthInvalid() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const session = getStoredSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }

  return headers;
}

function isRetryableError(error: unknown) {
  return error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout');
}

function toFriendlyNetworkError(error: ApiError) {
  if (error.kind === 'timeout') {
    return new ApiError('La API tardo mas de 10 segundos en responder. Verifica la conexion e intentalo otra vez.', 'timeout');
  }

  return new ApiError('No se pudo conectar con el backend. Verifica tu conexion e intentalo otra vez.', 'network');
}

async function performRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message = payload?.error || `HTTP ${res.status}`;
      throw new ApiError(message, 'http', res.status);
    }

    return res.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La API tardo mas de 10 segundos en responder. Intentalo de nuevo.', 'timeout');
    }

    throw new ApiError('No se pudo conectar con el backend. Intentalo de nuevo.', 'network');
  } finally {
    clearTimeout(timeoutId);
  }
}

let refreshPromise: Promise<StoredAuthSession | null> | null = null;

export async function refreshStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const currentSession = getStoredSession();
    if (!currentSession?.refreshToken) {
      clearStoredSession();
      notifyAuthInvalid();
      return null;
    }

    try {
      const response = await publicRequest<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      });

      persistStoredSession(response.data);
      return response.data;
    } catch {
      clearStoredSession();
      notifyAuthInvalid();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await performRequest<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError && error.kind === 'http' && error.status === 401) {
        const refreshedSession = await refreshStoredSession();
        if (refreshedSession?.accessToken) {
          continue;
        }

        notifyAuthInvalid();
        throw error;
      }

      if (attempt === 0 && isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      if (error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout')) {
        throw toFriendlyNetworkError(error);
      }

      throw error;
    }
  }

  if (lastError instanceof ApiError) {
    throw toFriendlyNetworkError(lastError);
  }

  throw lastError instanceof Error ? lastError : new Error('Error desconocido');
}

async function publicRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message = payload?.error || `HTTP ${res.status}`;
      throw new ApiError(message, 'http', res.status);
    }

    return res.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La API tardo mas de 10 segundos en responder. Intentalo de nuevo.', 'timeout');
    }

    throw new ApiError('No se pudo conectar con el backend. Intentalo de nuevo.', 'network');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkBackendHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function authLogin(username: string, password: string) {
  return publicRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchCurrentSession() {
  return request<{ status: string; data: AuthUser }>('/api/auth/me');
}

// Config General
export async function getConfig() {
  return request<{
    bancos: string[];
    agentes: string[];
    usuarios: string[];
    categorias: Record<string, string[]>;
    tipos_pago: string[];
    cajas: string[];
    // Full config structure matching backend
    agentes_full: Record<string, string>[];
    bancos_full: Record<string, string>[];
    cajas_full: Record<string, string>[];
    categorias_full: Record<string, string>[];
    usuarios_full: Record<string, string>[];
    tipos_pago_full: Record<string, string>[];
  }>('/api/config');
}

// Config CRUD
export async function getTableData(table: string) {
  return request<{ status: string; data: Record<string, string>[] }>(`/api/config/${table}`);
}

export async function addTableRow(table: string, data: Record<string, string>) {
  return request<{ status: string; data: Record<string, string> }>(`/api/config/${table}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeTableRow(table: string, id: string) {
  return request<{ status: string; data: { status: string; id: string } }>(`/api/config/${table}/${id}`, {
    method: 'DELETE',
  });
}

export async function importTableBatch(table: string, items: Record<string, string>[]) {
  return request<{ status: string; data: Record<string, string>[]; count: number }>(`/api/config/${table}/import`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

// Pagos
export async function createPago(data: {
  usuario: string;
  caja: string;
  banco: string;
  monto: number;
  tipo: string;
  comprobante_url?: string;
  fecha_comprobante?: string;
  }) {
    return request<MutationResponse<Record<string, string>>>('/api/pagos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

export async function updatePago(id: string, data: {
  usuario?: string;
  caja?: string;
  banco?: string;
  monto?: number;
  tipo?: string;
  comprobante_url?: string;
  fecha_comprobante?: string;
}) {
  return request<{ status: string; data: PagoRecord }>(`/api/pagos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelPago(id: string, motivo: string) {
  return request<{ status: string; data: PagoRecord }>(`/api/pagos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ motivo }),
  });
}

export interface PagosFilters {
  agente?: string;
  desde?: string;
  hasta?: string;
  banco?: string;
  usuario?: string;
  limit?: number;
  offset?: number;
}

export async function getPagos(filters: PagosFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: PaginatedResponse<PagoRecord> }>(`/api/pagos${suffix}`);
}

// Ingresos
export async function createIngreso(data: { agente: string; banco: string; monto: number; fecha_movimiento: string }) {
  return request<MutationResponse<Record<string, string>>>('/api/ingresos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface IngresosFilters {
  agente?: string;
  limit?: number;
  offset?: number;
}

export async function getIngresos(filters: IngresosFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: PaginatedResponse<IngresoRecord> }>(`/api/ingresos${suffix}`);
}

export async function updateIngreso(id: string, data: {
  agente?: string;
  banco?: string;
  monto?: number;
  fecha_movimiento?: string;
}) {
  return request<{ status: string; data: IngresoRecord }>(`/api/ingresos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelIngreso(id: string, motivo: string) {
  return request<{ status: string; data: IngresoRecord }>(`/api/ingresos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ motivo }),
  });
}

// Gastos
export async function createGasto(data: {
  concepto: string;
  categoria: string;
  subcategoria?: string;
  banco: string;
  monto: number;
  fecha_gasto: string;
}) {
  return request<MutationResponse<Record<string, string>>>('/api/gastos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface GastosFilters {
  limit?: number;
  offset?: number;
}

export async function getGastos(filters: GastosFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: PaginatedResponse<GastoRecord> }>(`/api/gastos${suffix}`);
}

export async function updateGasto(id: string, data: {
  concepto?: string;
  categoria?: string;
  subcategoria?: string;
  banco?: string;
  monto?: number;
  fecha_gasto?: string;
}) {
  return request<{ status: string; data: GastoRecord }>(`/api/gastos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function cancelGasto(id: string, motivo: string) {
  return request<{ status: string; data: GastoRecord }>(`/api/gastos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ motivo }),
  });
}

// Bancos
export async function createBanco(data: { banco: string; saldo: number; fecha: string }) {
  return request<{ status: string; data: Record<string, string>; overwritten?: boolean }>('/api/bancos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getBancos() {
  return request<{ status: string; data: Record<string, string>[] }>('/api/bancos');
}

export interface AuditFilters {
  entity?: string;
  action?: string;
  user?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: PaginatedResponse<AuditRecord> }>(`/api/audit${suffix}`);
}

// Balance
export interface AgentBalance {
  agente: string;
  ingresos: number;
  pagos: number;
  balance: number;
}

export interface GlobalBalance {
  agents: AgentBalance[];
  bancos: { banco: string; saldo: string }[];
  totalCajas: number;
  totalBancos: number;
  totalGastos: number;
  global: number;
}

export async function getBalance() {
  return request<{ status: string; data: GlobalBalance }>('/api/balance');
}

export async function getAgentBalance(agente: string) {
  return request<{ status: string; data: AgentBalance }>(`/api/balance/${encodeURIComponent(agente)}`);
}

// OCR
export async function analyzeOCR(base64Image: string) {
  return request<{
    status: string;
    data: {
      monto: number | null;
      fecha: string | null;
      isMock?: boolean;
    };
  }>('/api/ocr/analyze', {
    method: 'POST',
    body: JSON.stringify({ image: base64Image }),
  });
}
