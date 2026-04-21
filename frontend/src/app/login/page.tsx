'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AlertBanner from '@/components/AlertBanner';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isReady } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace('/balance');
    }
  }, [isAuthenticated, isReady, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Completa usuario y contrasena.');
      return;
    }

    try {
      setSubmitting(true);
      await login(username.trim(), password);
      router.replace('/balance');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesion.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <span className="auth-eyebrow">Golden City</span>
          <h1 className="page-title">Verificando sesion</h1>
          <p className="page-subtitle">Comprobando si ya existe una sesion valida.</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <span className="auth-eyebrow">Golden City</span>
          <h1 className="page-title">Redirigiendo</h1>
          <p className="page-subtitle">Tu sesion ya esta activa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-visual-orb auth-visual-orb--one" />
        <div className="auth-visual-orb auth-visual-orb--two" />
        <div className="auth-visual-copy">
          <span className="auth-eyebrow">Golden City Backoffice</span>
          <h1 className="auth-hero">
            Sistema de gestión de cajas
            <span className="auth-hero-accent">Golden City</span>
          </h1>
          <p className="auth-hero-copy">Ten el control de tu caja en tiempo real, desde donde estés.</p>
          <div className="auth-hero-stats">
            <div>
              <strong>Registra</strong>
              <span>tus pagos en segundos</span>
            </div>
            <div>
              <strong>Controla</strong>
              <span>tu caja al día</span>
            </div>
            <div>
              <strong>Supervisa</strong>
              <span>agentes y bancos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card card">
        <div className="auth-card-header">
          <span className="auth-eyebrow">Inicio de sesion</span>
          <h2 className="page-title">Bienvenido</h2>
          <p className="page-subtitle">Usa tus credenciales para entrar al panel.</p>
        </div>

        {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            <span className="label">Usuario</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Tu usuario"
              required
            />
          </label>

          <label className="field-group">
            <span className="label">Contrasena</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Tu contraseña"
              required
            />
          </label>

          <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
