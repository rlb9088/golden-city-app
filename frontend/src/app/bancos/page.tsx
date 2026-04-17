'use client';

import { useEffect, useState } from 'react';
import { getConfig, createBanco, getBancos } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import TableSkeleton from '@/components/TableSkeleton';
import './bancos.css';

export default function BancosPage() {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<{ bancos: string[] } | null>(null);
  const [bancos, setBancos] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const [banco, setBancoSelect] = useState('');
  const [saldo, setSaldo] = useState('');
  const [fecha, setFecha] = useState(getTodayLima());

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [configRes, bancosRes] = await Promise.all([getConfig(), getBancos()]);
        setConfig(configRes);
        setBancos(bancosRes.data);
        setBancoSelect((current) => current || configRes.bancos[0] || '');
      } catch (err) {
        setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  // Check if current fecha+banco already exists
  const existingRecord = bancos.find(b => b.banco === banco && b.fecha === fecha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saldo || parseFloat(saldo) < 0) {
      setAlert({ type: 'error', message: 'Ingresa un saldo válido' });
      return;
    }
    try {
      setSubmitting(true);
      const result = await createBanco({ banco, saldo: parseFloat(saldo), fecha });
      const msg = result.data?.overwritten
        ? `Saldo de ${banco} actualizado para ${formatDate(fecha)}: ${formatCurrency(parseFloat(saldo))}`
        : `Saldo de ${banco} registrado para ${formatDate(fecha)}: ${formatCurrency(parseFloat(saldo))}`;
      setAlert({ type: 'success', message: msg });
      setSaldo('');
      const res = await getBancos();
      setBancos(res.data);
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
        <span className="badge badge-blue">{bancos.length} registros</span>
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
            <select className="select" id="banco-select-page" value={banco} onChange={(e) => setBancoSelect(e.target.value)}>
              {config.bancos.map((b) => <option key={b} value={b}>{b}</option>)}
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
                {[...bancos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((b, idx) => (
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
      </div>
    </div>
  );
}
