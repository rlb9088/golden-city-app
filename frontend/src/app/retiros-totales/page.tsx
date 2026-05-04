'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRetiroTotal, getConfigCajas, getRetirosTotales, type ConfigCaja, type RetiroTotalRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import './retiros-totales.css';

const PAGE_SIZE = 50;

export default function RetirosTotalesPage() {
  const { isAdmin } = useAuth();
  const [cajas, setCajas] = useState<ConfigCaja[]>([]);
  const [retiros, setRetiros] = useState<RetiroTotalRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const [cajaId, setCajaId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(getTodayLima());
  const currentPageRef = useRef(0);

  const loadRetirosPage = useCallback(async (page: number) => {
    const safePage = Math.max(page, 0);
    const res = await getRetirosTotales({ limit: PAGE_SIZE, offset: safePage * PAGE_SIZE });
    setRetiros(res.data.items);
    setPagination(res.data.pagination);
    currentPageRef.current = safePage;
    return res.data;
  }, []);

  const refreshRetiros = useCallback(async () => {
    await loadRetirosPage(currentPageRef.current);
  }, [loadRetirosPage]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cajasRes, retirosRes] = await Promise.all([getConfigCajas(), loadRetirosPage(0)]);
        setCajas(cajasRes);
        setRetiros(retirosRes.items);
        setCajaId((current) => current || cajasRes[0]?.id || '');
      } catch (err) {
        setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [loadRetirosPage]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || loading) {
      return;
    }

    void loadRetirosPage(currentPageRef.current - 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadRetirosPage, loading, pagination.offset]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || loading) {
      return;
    }

    void loadRetirosPage(currentPageRef.current + 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadRetirosPage, loading, pagination.hasMore]);

  const selectedCaja = cajas.find((item) => item.id === cajaId);
  const existingRecord = retiros.find((item) => item.caja_id === cajaId && item.fecha === fecha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedMonto = Number.parseFloat(monto);
    if (!cajaId.trim() || !Number.isFinite(parsedMonto) || parsedMonto < 0) {
      setAlert({ type: 'error', message: 'Selecciona una caja valida e ingresa un monto valido' });
      return;
    }

    try {
      setSubmitting(true);
      const result = await createRetiroTotal({ caja_id: cajaId, monto: parsedMonto, fecha });
      const cajaNombre = selectedCaja?.nombre || cajaId;
      const msg = result.data?.overwritten
        ? `Monto del dia de ${cajaNombre} actualizado para ${formatDate(fecha)}: ${formatCurrency(parsedMonto)}`
        : `Monto del dia de ${cajaNombre} registrado para ${formatDate(fecha)}: ${formatCurrency(parsedMonto)}`;
      setAlert({ type: 'success', message: msg });
      setMonto('');
      currentPageRef.current = 0;
      await refreshRetiros();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar retiro' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="retiros-totales-page">
        <div className="page-header"><h1 className="page-title">💸 Retiros Totales</h1></div>
        <AlertBanner type="warning" message="Solo los administradores pueden gestionar retiros totales" autoDismiss={0} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in" id="retiros-totales-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">💸 Retiros Totales</h1>
            <p className="page-subtitle">Cargando...</p>
          </div>
        </div>
        <div className="card skeleton-form">
          <div className="skeleton-form-row">
            {[1, 2, 3].map((item) => (
              <div key={item} className="skeleton-field">
                <span className="skeleton-line skeleton-label" />
                <span className="skeleton-line skeleton-input" />
              </div>
            ))}
          </div>
          <div className="skeleton-card" style={{ height: '48px', width: '180px' }} />
        </div>
        <div className="mt-lg">
          <TableSkeleton columns={3} rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="retiros-totales-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Retiros Totales</h1>
          <p className="page-subtitle">Registra el total de retiros del cierre del día por caja.</p>
        </div>
        <span className="badge badge-blue">{retiros.length} de {pagination.total} registros</span>
      </div>

      <form className="card" onSubmit={handleSubmit} id="retiro-total-form">
        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="fecha-retiro-total">Fecha (cierre del día)</label>
            <input
              className="input"
              id="fecha-retiro-total"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="caja-select-retiro-total">Caja</label>
            <select
              className="select"
              id="caja-select-retiro-total"
              value={cajaId}
              onChange={(e) => setCajaId(e.target.value)}
              disabled={cajas.length === 0}
            >
              {cajas.length === 0 ? (
                <option value="">No hay cajas disponibles</option>
              ) : (
                cajas.map((caja) => (
                  <option key={caja.id} value={caja.id}>
                    {caja.nombre}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="monto-input">Monto del día (S/)</label>
            <input
              className="input"
              id="monto-input"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </div>
        {existingRecord && (
          <div className="upsert-warning">
            ⚠️ Ya existe un monto del día de <strong>{formatCurrency(existingRecord.monto)}</strong> para {selectedCaja?.nombre || cajaId} en {formatDate(fecha)}. Se actualizará.
          </div>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting || loading || cajas.length === 0} id="submit-retiro-total">
            {submitting ? '⏳ Guardando...' : existingRecord ? '🔄 Actualizar Monto' : '✅ Registrar Monto'}
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {retiros.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">💸</div>
            <p>No hay retiros totales registrados</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" id="retiros-totales-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Caja</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {retiros.map((retiro, index) => (
                  <tr key={retiro.id || index}>
                    <td><strong>{formatDate(retiro.fecha)}</strong></td>
                    <td><strong>{retiro.caja}</strong></td>
                    <td className="text-right">
                      <span className="amount">{formatCurrency(retiro.monto)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.total > 0 && (
          <PaginationControls
            pagination={pagination}
            loading={loading}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
          />
        )}
      </div>
    </div>
  );
}
