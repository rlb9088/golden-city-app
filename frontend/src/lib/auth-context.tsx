'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  authLogin,
  clearStoredSession,
  fetchCurrentSession,
  getStoredSession,
  persistStoredSession,
  refreshStoredSession,
  type AuthUser as ApiAuthUser,
  type StoredAuthSession,
} from '@/lib/api';

export interface AuthUser extends ApiAuthUser {
  id: string;
}

const AUTH_INVALID_EVENT = 'golden-city:auth-invalid';
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000;

interface AuthContextType {
  session: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  role: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  refreshSession: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  token: null,
  refreshToken: null,
  user: null,
  role: 'agent',
  isAdmin: false,
  isAuthenticated: false,
  isReady: false,
  login: async () => ({
    id: '',
    userId: '',
    username: '',
    role: 'agent',
    nombre: '',
  }),
  refreshSession: async () => false,
  logout: () => {},
});

function readStoredAccessToken() {
  return getStoredSession()?.accessToken ?? null;
}

function normalizeUser(user: ApiAuthUser | AuthUser | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const existingId = 'id' in user ? user.id : '';
  return {
    ...user,
    id: existingId || user.userId,
  };
}

function decodeJwtExp(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(padded)) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredAccessToken());
  const [refreshToken, setRefreshToken] = useState<string | null>(() => getStoredSession()?.refreshToken ?? null);
  const [session, setSession] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const syncSessionFromStorage = (storedSession: StoredAuthSession | null) => {
    setToken(storedSession?.accessToken ?? null);
    setRefreshToken(storedSession?.refreshToken ?? null);
    setSession(normalizeUser(storedSession?.user));
  };

  useEffect(() => {
    if (!token) {
      setRefreshToken(null);
      setSession(null);
      setIsReady(true);
      return undefined;
    }

    let cancelled = false;

    const restoreSession = async () => {
      try {
        const response = await fetchCurrentSession();
        if (cancelled) {
          return;
        }
        setSession(normalizeUser(response.data));
      } catch {
        if (cancelled) {
          return;
        }
        clearStoredSession();
        setToken(null);
        setRefreshToken(null);
        setSession(null);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const maybeRefresh = async () => {
      const storedSession = getStoredSession();
      if (!storedSession?.accessToken) {
        return;
      }

      const expiresAt = decodeJwtExp(storedSession.accessToken);
      if (!expiresAt || expiresAt - Date.now() >= REFRESH_THRESHOLD_MS) {
        return;
      }

      const refreshedSession = await refreshStoredSession();
      syncSessionFromStorage(refreshedSession);
    };

    void maybeRefresh();
    const intervalId = window.setInterval(() => {
      void maybeRefresh();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleAuthInvalid = () => {
      clearStoredSession();
      setToken(null);
      setRefreshToken(null);
      setSession(null);
      setIsReady(true);
    };

    window.addEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authLogin(username, password);
    const normalizedUser = normalizeUser(response.data.user);
    persistStoredSession({
      ...response.data,
      user: normalizedUser ?? response.data.user,
    });
    setToken(response.data.accessToken);
    setRefreshToken(response.data.refreshToken);
    setSession(normalizedUser);
    setIsReady(true);
    return normalizedUser as AuthUser;
  };

  const refreshSession = async () => {
    const refreshedSession = await refreshStoredSession();
    if (!refreshedSession) {
      return false;
    }

    syncSessionFromStorage(refreshedSession);
    return true;
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setRefreshToken(null);
    setSession(null);
    setIsReady(true);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        token,
        refreshToken,
        user: session,
        role: session?.role || 'agent',
        isAdmin: session?.role === 'admin',
        isAuthenticated: Boolean(session && token),
        isReady,
        login,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
