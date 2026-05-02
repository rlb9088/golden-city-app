'use client';

import { useEffect, useRef, useState } from 'react';
import AlertBanner from './AlertBanner';
import { checkBackendHealth, RETRY_DELAYS_MS } from '@/lib/api';

const HEALTH_POLL_FAST_MS = 5_000;
const HEALTH_POLL_SLOW_MS = 20_000;
const FAST_POLL_DURATION_MS = 60_000;
const WARMUP_FAIL_THRESHOLD = RETRY_DELAYS_MS.length;

type BannerState = 'connected' | 'warmup' | 'error';

export default function BackendStatusBanner() {
  const [bannerState, setBannerState] = useState<BannerState>('connected');
  const failCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const ping = async () => {
      const ok = await checkBackendHealth();
      if (cancelled) return;

      if (ok) {
        failCountRef.current = 0;
        setBannerState('connected');
      } else {
        failCountRef.current += 1;
        setBannerState(failCountRef.current < WARMUP_FAIL_THRESHOLD ? 'warmup' : 'error');
      }
    };

    const startInterval = (ms: number) => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => void ping(), ms);
    };

    void ping();
    startInterval(HEALTH_POLL_FAST_MS);

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) startInterval(HEALTH_POLL_SLOW_MS);
    }, FAST_POLL_DURATION_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.clearTimeout(slowTimer);
    };
  }, []);

  if (bannerState === 'connected') return null;

  if (bannerState === 'warmup') {
    return (
      <AlertBanner
        type="warning"
        message="Conectando con el servidor (puede tardar unos segundos la primera vez)…"
        autoDismiss={0}
      />
    );
  }

  return (
    <AlertBanner
      type="error"
      message="No podemos conectar con el backend. Reintentaremos automáticamente."
      autoDismiss={0}
    />
  );
}
