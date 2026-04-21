'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMiCaja, type BalanceBankDetail, type MiCajaSnapshot } from '@/lib/api';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import StatsCard from '@/components/StatsCard';
import AlertBanner from '@/components/AlertBanner';
import TableSkeleton from '@/components/TableSkeleton';
import './balance.css';

function getVariantByAmount(value: number) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="empty-state balance-empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
}

function BalanceBanksTable({ bancos }: { bancos: BalanceBankDetail[] }) {
  if (bancos.length === 0) {
    return <EmptyState icon="💼" message="No hay bancos registrados para tu caja." />;
  }

  return (
    <div className="table-container">
      <table className="table" id="mi-caja-banks-table">
        <thead>
          <tr>
            <th>Banco</th>
            <th style={{ textAlign: 'right' }}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {bancos.map((bank) => (
            <tr key={bank.banco_id}>
              <td>{bank.banco}</td>
              <td className="text-right">
                <span className={`amount ${bank.saldo >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                  {formatCurrency(bank.saldo)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MiCajaView() {
  const { isReady, user } = useAuth();
  const [caja, setCaja] = useState<MiCajaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const agentName = user?.nombre?.trim() || user?.username?.trim() || 'Agente';

  const loadMiCaja = useCallback(async (fecha?: string, background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getMiCaja(fecha);
      setCaja(response.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mi caja');
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void loadMiCaja();
  }, [isReady, loadMiCaja]);

  const handleDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    setSelectedDate(nextDate);

    if (!isReady) {
      return;
    }

    void loadMiCaja(nextDate || undefined, true);
  }, [isReady, loadMiCaja]);

  const handleClearDate = useCallback(() => {
    setSelectedDate('');

    if (!isReady) {
      return;
    }

    void loadMiCaja(undefined, true);
  }, [isReady, loadMiCaja]);

  if (!isReady) {
    return (
      <div className="animate-fade-in" id="balance-page">
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Mi Caja</h1>
            <p className="page-subtitle">Cargando tu snapshot personal...</p>
          </div>
        </div>
        <div className="balance-stats stagger-children">
          <div className="stats-card skeleton-card" />
        </div>
        <div className="balance-sections">
          <div className="balance-section balance-section--wide">
            <h2 className="balance-section-title">Movimiento de caja</h2>
            <TableSkeleton columns={2} rows={3} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por Banco</h2>
            <TableSkeleton columns={2} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  if (loading && !caja) {
    return (
      <div className="animate-fade-in" id="balance-page">
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Mi Caja</h1>
            <p className="page-subtitle">Cargando tu snapshot personal...</p>
          </div>
        </div>
        <div className="balance-stats stagger-children">
          <div className="stats-card skeleton-card" />
        </div>
        <div className="balance-sections">
          <div className="balance-section balance-section--wide">
            <h2 className="balance-section-title">Movimiento de caja</h2>
            <TableSkeleton columns={2} rows={3} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por Banco</h2>
            <TableSkeleton columns={2} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  if (!caja) {
    return (
      <div className="animate-fade-in" id="balance-page">
        {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Mi Caja</h1>
            <p className="page-subtitle">No fue posible cargar tu caja personal.</p>
          </div>
        </div>
        <AlertBanner
          type="warning"
          message="Intenta actualizar la pagina o vuelve a ejecutar el filtro de fecha."
          autoDismiss={0}
        />
      </div>
    );
  }

  const displayFecha = caja.fecha ? formatDate(caja.fecha) : 'Ahora';
  const modeLabel = caja.fecha ? `Cierre al ${displayFecha}` : 'Modo ahora';
  const isBackgroundRefresh = refreshing && Boolean(caja);
  const movement = caja.movimiento;
  const movimientoTotalVariant = getVariantByAmount(caja.total);

  return (
    <div className="animate-fade-in" id="balance-page">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}

      <div className="page-header balance-page-header">
        <div>
          <h1 className="page-title">Mi Caja</h1>
          <p className="page-subtitle">
            {modeLabel}. Dejar vacio el filtro equivale a tomar el snapshot actual.
          </p>
        </div>

        <div className="balance-toolbar">
          <div className="balance-toolbar-row">
            <label className="balance-date-field">
              <span>Cierre al (dejar vacio = ahora)</span>
              <input
                type="date"
                value={selectedDate}
                max={getTodayLima()}
                onChange={handleDateChange}
                disabled={refreshing}
              />
            </label>
            <button
              className="btn btn-secondary balance-clear-button"
              type="button"
              onClick={handleClearDate}
              disabled={!selectedDate || refreshing}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="balance-meta">
        <span className="balance-mode-pill">{agentName}</span>
        <span className="balance-mode-pill">{modeLabel}</span>
        {isBackgroundRefresh && <span className="balance-mode-pill balance-mode-pill--refresh">Actualizando snapshot...</span>}
      </div>

      <div className="balance-stats stagger-children">
        <StatsCard
          icon="💼"
          label="Mi caja"
          value={caja.total}
          variant={movimientoTotalVariant}
          subtitle={`${caja.bancos.length} banco(s)`}
        />
      </div>

      <div className="balance-sections">
        <section className="balance-section balance-section--wide animate-fade-in">
          <div className="balance-section-header">
            <div>
              <h2 className="balance-section-title">Movimiento de caja</h2>
              <p className="page-subtitle">Resumen diario de tu caja con monto inicial, pagos y saldo total.</p>
            </div>
            <span className="badge badge-blue">1 resumen</span>
          </div>

          <div className="table-container">
            <table className="table" id="mi-caja-movement-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Monto inicial del dia</td>
                  <td className="text-right">
                    <span className={`amount ${movement.montoInicial >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                      {formatCurrency(movement.montoInicial)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Pagos totales del dia</td>
                  <td className="text-right">
                    <span className="amount amount-negative">{formatCurrency(movement.pagosDia)}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Saldo total de caja</strong>
                  </td>
                  <td className="text-right">
                    <span className={`amount ${movement.saldoTotal >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                      <strong>{formatCurrency(movement.saldoTotal)}</strong>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="balance-section animate-fade-in">
          <div className="balance-section-header">
            <div>
              <h2 className="balance-section-title">Balance por Banco</h2>
              <p className="page-subtitle">Detalle de saldos por cada banco asociado a tu caja.</p>
            </div>
            <span className="badge badge-blue">{caja.bancos.length} banco(s)</span>
          </div>

          <BalanceBanksTable bancos={caja.bancos} />
        </section>
      </div>
    </div>
  );
}
