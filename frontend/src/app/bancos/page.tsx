'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig, createBanco, getBancos, getScopedBancos, type BancoRecord, type ConfigBanco } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import './bancos.css';

const PAGE_SIZE = 50;

export default function BancosPage() {
  const { isAdmin, user } = useAuth();
  const [config, setConfig] = useState<{ bancos: string[]; bancos_full: ConfigBanco[] } | null>(null);
  const [scopedBancos, setScopedBancos] = useState<ConfigBanco[]>([]);
  const [bancos, setBancos] = useState<BancoRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const [banco, setBancoSelect] = useState('');
  const [saldo, setSaldo] = useState('');
  const [fecha, setFecha] = useState(getTodayLima());
  const currentPageRef = useRef(0);

  const loadBancosPage = useCallback(async (page: number) => {
    const safePage = Math.max(page, 0);
    const res = await getBancos({ limit: PAGE_SIZE, offset: safePage * PAGE_SIZE });
    setBancos(res.data.items);
    setPagination(res.data.pagination);
    currentPageRef.current = safePage;
    return res.data;
  }, []);

  const refreshBancos = useCallback(async () => {
    await loadBancosPage(currentPageRef.current);
  }, [loadBancosPage]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [configRes, bancosRes] = await Promise.all([getConfig(), loadBancosPage(0)]);
        setConfig(configRes);
        setBancos(bancosRes.items);
        const scopedResponse = await getScopedBancos(user?.id);
        setScopedBancos(scopedResponse.data);
        setBancoSelect(scopedResponse.data[0]?.id || '');
      } catch (err) {
        setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [loadBancosPage, user?.id]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || loading) {
      return;
    }

    void loadBancosPage(currentPageRef.current - 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadBancosPage, loading, pagination.offset]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || loading) {
      return;
    }

    void loadBancosPage(currentPageRef.current + 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadBancosPage, loading, pagination.hasMore]);

  // Check if current fecha+banco already exists
  const existingRecord = bancos.find((b) => b.banco_id === banco && b.fecha === fecha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banco.trim() || !scopedBancos.length || !saldo || parseFloat(saldo) < 0) {
      setAlert({ type: 'error', message: 'Selecciona un banco válido e ingresa un saldo válido' });
      return;
    }
    try {
      setSubmitting(true);
      const result = await createBanco({ banco_id: banco, saldo: parseFloat(saldo), fecha });
      const msg = result.data?.overwritten
        ? `Saldo de ${banco} actualizado para ${formatDate(fecha)}: ${formatCurrency(parseFloat(saldo))}`
        : `Saldo de ${banco} registrado para ${formatDate(fecha)}: ${formatCurrency(parseFloat(saldo))}`;
      setAlert({ type: 'success', message: msg });
      setSaldo('');
      currentPageRef.current = 0;
      await refreshBancos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar saldo' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="bancos-page">
        <div className="page-header"><h1 className="page-title">🏦 Bancos</h1></div>
        <AlertBanner type="warning" message="Solo los administradores pueden gestionar bancos" autoDismiss={0} />
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">🏦 Bancos</h1>
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
    <div className="animate-fade-in" id="bancos-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Saldos Bancarios</h1>
          <p className="page-subtitle">Registro de saldos de cierre diario — 1 registro por banco/día</p>
        </div>
        <span className="badge badge-blue">{bancos.length} de {pagination.total} registros</span>
      </div>

      <form className="card" onSubmit={handleSubmit} id="banco-form">
        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="fecha-banco">Fecha (cierre del día)</label>
            <input className="input" id="fecha-banco" type="date"
              value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="banco-select-page">Banco</label>
            <select className="select" id="banco-select-page" value={banco} onChange={(e) => setBancoSelect(e.target.value)} disabled={scopedBancos.length === 0}>
              {scopedBancos.length === 0 ? (
                <option value="">No hay bancos disponibles</option>
              ) : (
                scopedBancos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)
              )}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="saldo-input">Saldo (S/)</label>
            <input className="input" id="saldo-input" type="number" step="0.01" min="0"
              value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0.00" required />
          </div>
        </div>
        {existingRecord && (
          <div className="upsert-warning">
            ⚠️ Ya existe un saldo de <strong>{formatCurrency(existingRecord.saldo)}</strong> para {banco} en {formatDate(fecha)}. Se actualizará.
          </div>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting || loading || !config} id="submit-banco">
            {submitting ? '⏳ Guardando...' : existingRecord ? '🔄 Actualizar Saldo' : '✅ Registrar Saldo'}
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {bancos.length === 0 ? (
          <div className="empty-state card"><div className="empty-state-icon">🏦</div><p>No hay saldos registrados</p></div>
        ) : (
          <div className="table-container">
            <table className="table" id="bancos-table">
              <thead><tr><th>Fecha</th><th>Banco</th><th style={{textAlign:'right'}}>Saldo</th></tr></thead>
              <tbody>
                {bancos.map((b, idx) => (
                  <tr key={b.id || idx}>
                    <td><strong>{formatDate(b.fecha)}</strong></td>
                    <td><strong>{b.banco}</strong></td>
                    <td className="text-right"><span className="amount">{formatCurrency(b.saldo)}</span></td>
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
