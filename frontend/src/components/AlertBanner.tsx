'use client';

import { useEffect, useRef, useState } from 'react';
import './AlertBanner.css';

interface AlertBannerProps {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  onDismiss?: () => void;
  autoDismiss?: number;
}

const icons: Record<AlertBannerProps['type'], string> = {
  success: 'OK',
  warning: '!',
  error: 'X',
  info: 'i',
};

const defaultAutoDismiss: Record<AlertBannerProps['type'], number> = {
  success: 4000,
  warning: 6000,
  error: 0,
  info: 5000,
};

export default function AlertBanner({ type, message, onDismiss, autoDismiss }: AlertBannerProps) {
  const [visible, setVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);
  const dismissDelay = autoDismiss ?? defaultAutoDismiss[type];

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (dismissDelay <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setVisible(false);
      onDismissRef.current?.();
    }, dismissDelay);

    return () => clearTimeout(timer);
  }, [dismissDelay, message, type]);

  if (!visible) return null;

  return (
    <div
      className={`alert-banner alert-banner--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      id={`alert-${type}`}
    >
      <span className="alert-banner-icon">{icons[type]}</span>
      <span className="alert-banner-message">{message}</span>
      <button
        className="alert-banner-close"
        onClick={() => {
          setVisible(false);
          onDismissRef.current?.();
        }}
        aria-label="Cerrar alerta"
      >
        Cerrar
      </button>
    </div>
  );
}
