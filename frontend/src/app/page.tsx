'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    router.replace(isAuthenticated ? '/balance' : '/login');
  }, [isAuthenticated, isReady, router]);

  return (
    <div className="auth-loading-shell">
      <div className="auth-loading-card card">
        <span className="auth-loading-eyebrow">Golden City</span>
        <h1 className="page-title">Cargando acceso</h1>
        <p className="page-subtitle">Estamos preparando tu sesión o llevándote al login.</p>
      </div>
    </div>
  );
}
