'use client';

import { useEffect, useState } from 'react';
import AlertBanner from './AlertBanner';
import { checkBackendHealth } from '@/lib/api';

const HEALTH_POLL_MS = 20_000;

export default function BackendStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const ok = await checkBackendHealth();
        if (!cancelled) {
          setIsOnline(ok);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void ping();
    const interval = window.setInterval(() => {
      void ping();
    }, HEALTH_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (checking || isOnline) return null;

  return (
    <AlertBanner
      type="error"
      message="No podemos conectar con el backend. Reintentaremos automáticamente."
      autoDismiss={0}
    />
  );
}
