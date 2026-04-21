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

export interface ConfigAgent {
  id: string;
  nombre: string;
  username: string;
  role: string;
  activo: boolean;
}

export interface ConfigBanco {
  id: string;
  nombre: string;
  propietario?: string;
  propietario_id?: string;
}

export interface ConfigSetting {
  key: string;
  value: string | number;
  fecha_efectiva: string;
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
  banco_id: string;
  banco: string;
  monto: string | number;
  tipo: string;
  comprobante_url?: string;
  comprobante_file_id?: string;
  fecha_comprobante?: string;
  fecha_registro?: string;
  agente?: string;
}

export interface IngresoRecord {
  id: string;
  estado?: string;
  agente: string;
  banco_id: string;
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
  banco_id: string;
  banco: string;
  monto: string | number;
  fecha_gasto: string;
  fecha_registro?: string;
}

export interface BancoRecord {
  id: string;
  fecha: string;
  banco_id: string;
  banco: string;
  saldo: string | number;
  propietario_id?: string;
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

async function request<T>(endpoint: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await performRequest<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError && error.kind === 'http' && error.status === 401) {
        if (!allowRefresh) {
          notifyAuthInvalid();
          throw error;
        }

        const refreshedSession = await refreshStoredSession();
        if (refreshedSession?.accessToken) {
          return request<T>(endpoint, options, false);
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
  const response = await request<{
    status: string;
  data: {
    bancos: string[];
    agentes: string[];
    usuarios: string[];
    categorias: Record<string, string[]>;
    tipos_pago: string[];
    cajas: string[];
    // Full config structure matching backend
    agentes_full: ConfigAgent[];
    bancos_full: ConfigBanco[];
    cajas_full: Record<string, string>[];
    categorias_full: Record<string, string>[];
    usuarios_full: Record<string, string>[];
    tipos_pago_full: Record<string, string>[];
    };
  }>('/api/config');

  return response.data;
}

// Config CRUD
export async function getTableData(table: string) {
  return request<{ status: string; data: Record<string, string>[] }>(`/api/config/${table}`);
}

export async function addTableRow(table: string, data: Record<string, unknown>) {
  return request<{ status: string; data: Record<string, string> }>(`/api/config/${table}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTableRow(table: string, id: string, data: Record<string, unknown>) {
  return request<{ status: string; data: Record<string, string> }>(`/api/config/${table}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removeTableRow(table: string, id: string) {
  return request<{ status: string; data: { status: string; id: string } }>(`/api/config/${table}/${id}`, {
    method: 'DELETE',
  });
}

export async function importTableBatch(table: string, items: Record<string, unknown>[]) {
  return request<{ status: string; data: Record<string, string>[]; count: number }>(`/api/config/${table}/import`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function changeAgentPassword(id: string, password: string) {
  return request<{ status: string; data: Record<string, string> }>(`/api/config/agentes/${encodeURIComponent(id)}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

export async function getSetting(key: string) {
  return request<{ status: string; data: ConfigSetting }>(`/api/config/settings/${encodeURIComponent(key)}`);
}

export async function updateSetting(key: string, value: string | number, fechaEfectiva: string) {
  return request<{ status: string; data: ConfigSetting }>(`/api/config/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({
      value,
      fecha_efectiva: fechaEfectiva,
    }),
  });
}

// Pagos
export async function createPago(data: {
  usuario: string;
  caja: string;
  banco_id: string;
  agente_id?: string;
  monto: number;
  tipo: string;
  comprobante_url?: string;
  comprobante_base64?: string;
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
  banco_id: string;
  monto?: number;
  tipo?: string;
  comprobante_url?: string;
  comprobante_file_id?: string;
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
export async function createIngreso(data: { agente: string; banco_id: string; monto: number; fecha_movimiento: string }) {
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
  banco_id: string;
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
  banco_id: string;
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
  banco_id: string;
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
export async function createBanco(data: { banco_id: string; saldo: number; fecha: string }) {
  return request<{ status: string; data: BancoRecord & { overwritten?: boolean; warnings?: string[] }; overwritten?: boolean }>('/api/bancos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface BancosFilters {
  agente?: string;
  limit?: number;
  offset?: number;
}

export async function getBancos(filters: BancosFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: PaginatedResponse<BancoRecord> }>(`/api/bancos${suffix}`);
}

export async function getScopedBancos(agenteId?: string) {
  const params = new URLSearchParams();
  if (agenteId && String(agenteId).trim()) {
    params.set('agente_id', String(agenteId));
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ status: string; data: ConfigBanco[] }>(`/api/bancos/scoped${suffix}`);
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

export interface BalanceBankDetail {
  banco_id: string;
  banco: string;
  saldo: number;
}

export interface BalanceAgentDetail {
  agente: string;
  bancos: BalanceBankDetail[];
}

export interface BalanceExpenseDetail {
  categoria: string;
  subcategoria: string;
  monto: number;
}

export interface BalanceSnapshot {
  fecha: string | null;
  bancosAdmin: {
    total: number;
    detalle: BalanceBankDetail[];
  };
  cajasAgentes: {
    total: number;
    detalle: BalanceAgentDetail[];
  };
  totalGastos: {
    total: number;
    detalle: BalanceExpenseDetail[];
  };
  balanceDia: number;
  balanceAcumulado: number;
  cajaInicioMes: number;
}

export interface MiCajaMovimiento {
  montoInicial: number;
  pagosDia: number;
  saldoTotal: number;
}

export interface MiCajaSnapshot {
  fecha: string | null;
  agente: string;
  total: number;
  movimiento: MiCajaMovimiento;
  bancos: BalanceBankDetail[];
}

/** @deprecated Use BalanceSnapshot instead. */
export type GlobalBalance = BalanceSnapshot;

export async function getBalance(fecha?: string): Promise<{ data: BalanceSnapshot }> {
  const params = new URLSearchParams();
  if (fecha && String(fecha).trim()) {
    params.set('fecha', String(fecha).trim());
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ data: BalanceSnapshot }>(`/api/balance${suffix}`);
}

export async function getAgentBalance(agente: string) {
  return request<{ status: string; data: AgentBalance }>(`/api/balance/${encodeURIComponent(agente)}`);
}

export async function getMiCaja(fecha?: string): Promise<{ data: MiCajaSnapshot }> {
  const params = new URLSearchParams();
  if (fecha && String(fecha).trim()) {
    params.set('fecha', String(fecha).trim());
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ data: MiCajaSnapshot }>(`/api/balance/mi-caja${suffix}`);
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
