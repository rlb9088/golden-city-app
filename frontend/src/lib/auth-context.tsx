'use client';

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
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
  type AuthUser,
  type StoredAuthSession,
} from '@/lib/api';

const AUTH_INVALID_EVENT = 'golden-city:auth-invalid';
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000;

interface AuthContextType {
  session: AuthUser | null;
  token: string | null;
  user: string;
  role: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  token: null,
  user: '',
  role: 'agent',
  isAdmin: false,
  isAuthenticated: false,
  isReady: false,
  login: async () => ({
    userId: '',
    username: '',
    role: 'agent',
    nombre: '',
  }),
  logout: () => {},
});

function readStoredAccessToken() {
  return getStoredSession()?.accessToken ?? null;
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
  const [session, setSession] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const syncSessionFromStorage = useEffectEvent((storedSession: StoredAuthSession | null) => {
    setToken(storedSession?.accessToken ?? null);
    setSession(storedSession?.user ?? null);
  });

  useEffect(() => {
    if (!token) {
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
        setSession(response.data);
      } catch {
        if (cancelled) {
          return;
        }
        clearStoredSession();
        setToken(null);
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
      setSession(null);
      setIsReady(true);
    };

    window.addEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authLogin(username, password);
    persistStoredSession(response.data);
    setToken(response.data.accessToken);
    setSession(response.data.user);
    setIsReady(true);
    return response.data.user;
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setSession(null);
    setIsReady(true);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        token,
        user: session?.nombre || session?.username || '',
        role: session?.role || 'agent',
        isAdmin: session?.role === 'admin',
        isAuthenticated: Boolean(session && token),
        isReady,
        login,
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
