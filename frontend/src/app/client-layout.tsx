'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import BackendStatusBanner from '@/components/BackendStatusBanner';

function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isReady, isAuthenticated } = useAuth();
  const isLoginRoute = pathname === '/login';

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!isAuthenticated && !isLoginRoute) {
      router.replace('/login');
    }

    if (isAuthenticated && isLoginRoute) {
      router.replace('/balance');
    }
  }, [isAuthenticated, isLoginRoute, isReady, router]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="auth-loading-shell">
        <div className="auth-loading-card card">
          <span className="auth-loading-eyebrow">Golden City</span>
          <h1 className="page-title">Preparando sesión</h1>
          <p className="page-subtitle">Validando credenciales y cargando el panel seguro...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-loading-shell">
        <div className="auth-loading-card card">
          <span className="auth-loading-eyebrow">Golden City</span>
          <h1 className="page-title">Redirigiendo</h1>
          <p className="page-subtitle">Necesitamos iniciar sesión para continuar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label="Abrir menú"
        aria-controls="main-sidebar"
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      <Sidebar
        isMobileOpen={isSidebarOpen}
        onMobileOpenChange={setIsSidebarOpen}
      />
      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <main className="app-content">
        <BackendStatusBanner />
        {children}
      </main>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthLayoutShell>{children}</AuthLayoutShell>
    </AuthProvider>
  );
}
