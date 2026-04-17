'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { getConfig, createIngreso, getIngresos, updateIngreso, cancelIngreso, type IngresoRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDateTime, getNowLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import './ingresos.css';

function isAnulado(record: IngresoRecord) {
  return String(record.estado ?? '').trim().toLowerCase() === 'anulado';
}

function toDateTimeLocalValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoWithTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (isoWithTime) return `${isoWithTime[1]}T${isoWithTime[2]}`;
  return trimmed.length >= 16 ? trimmed.slice(0, 16) : trimmed;
}

const PAGE_SIZE = 50;

export default function IngresosPage() {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<{ bancos: string[]; agentes: string[] } | null>(null);
  const [ingresos, setIngresos] = useState<IngresoRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ type: 'edit' | 'cancel'; id: string } | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const [agente, setAgente] = useState('');
  const [banco, setBanco] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaMovimiento, setFechaMovimiento] = useState(getNowLima());
  const [editingIngreso, setEditingIngreso] = useState<IngresoRecord | null>(null);
  const [editForm, setEditForm] = useState({ agente: '', banco: '', monto: '', fecha_movimiento: '' });
  const [cancelTarget, setCancelTarget] = useState<IngresoRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const montoRef = useRef<HTMLInputElement>(null);
  const currentPageRef = useRef(0);

  const loadIngresosPage = useCallback(async (page: number) => {
    const safePage = Math.max(page, 0);
    const res = await getIngresos({ limit: PAGE_SIZE, offset: safePage * PAGE_SIZE });
    setIngresos(res.data.items);
    setPagination(res.data.pagination);
    currentPageRef.current = safePage;
    return res.data;
  }, []);

  const refreshIngresos = useCallback(async () => {
    await loadIngresosPage(currentPageRef.current);
  }, [loadIngresosPage]);

  const openEditModal = useCallback((ingreso: IngresoRecord) => {
    setEditingIngreso(ingreso);
    setEditForm({
      agente: ingreso.agente || '',
      banco: ingreso.banco || '',
      monto: String(ingreso.monto ?? ''),
      fecha_movimiento: toDateTimeLocalValue(ingreso.fecha_movimiento || ''),
    });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingIngreso(null);
  }, []);

  const openCancelModal = useCallback((ingreso: IngresoRecord) => {
    setCancelTarget(ingreso);
    setCancelReason('');
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelTarget(null);
    setCancelReason('');
  }, []);

  const handleUpdateIngreso = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingIngreso) return;

    const parsedMonto = parseFloat(editForm.monto);
    if (!editForm.agente.trim() || !editForm.banco.trim() || !editForm.fecha_movimiento.trim() || !Number.isFinite(parsedMonto) || parsedMonto <= 0) {
      setAlert({ type: 'error', message: 'Completa agente, banco, fecha y monto válidos' });
      return;
    }

    try {
      setActionLoading({ type: 'edit', id: editingIngreso.id });
      await updateIngreso(editingIngreso.id, {
        agente: editForm.agente.trim(),
        banco: editForm.banco.trim(),
        monto: parsedMonto,
        fecha_movimiento: editForm.fecha_movimiento.trim(),
      });
      setAlert({ type: 'success', message: 'Ingreso actualizado correctamente' });
      closeEditModal();
      await refreshIngresos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al editar ingreso' });
    } finally {
      setActionLoading(null);
    }
  }, [closeEditModal, editForm, editingIngreso, refreshIngresos]);

  const handleCancelIngreso = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelTarget) return;

    if (!cancelReason.trim()) {
      setAlert({ type: 'error', message: 'Escribe un motivo para anular el ingreso' });
      return;
    }

    try {
      setActionLoading({ type: 'cancel', id: cancelTarget.id });
      await cancelIngreso(cancelTarget.id, cancelReason.trim());
      setAlert({ type: 'success', message: 'Ingreso anulado correctamente' });
      closeCancelModal();
      await refreshIngresos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al anular ingreso' });
    } finally {
      setActionLoading(null);
    }
  }, [cancelReason, cancelTarget, closeCancelModal, refreshIngresos]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [configRes, ingresosRes] = await Promise.all([getConfig(), loadIngresosPage(0)]);
        setConfig(configRes);
        setIngresos(ingresosRes.items);
        setAgente((current) => current || configRes.agentes[0] || '');
        setBanco((current) => current || configRes.bancos[0] || '');
      } catch (err) {
        setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [loadIngresosPage]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || loading) {
      return;
    }

    void loadIngresosPage(currentPageRef.current - 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadIngresosPage, loading, pagination.offset]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || loading) {
      return;
    }

    void loadIngresosPage(currentPageRef.current + 1).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadIngresosPage, loading, pagination.hasMore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || parseFloat(monto) <= 0) {
      setAlert({ type: 'error', message: 'Ingresa un monto válido' });
      return;
    }
    try {
      setSubmitting(true);
      const response = await createIngreso({ agente, banco, monto: parseFloat(monto), fecha_movimiento: fechaMovimiento });
      const warningMessage = response.warnings?.length
        ? `Ingreso registrado con observaciones: ${response.warnings.join(' • ')}`
        : '';
      setAlert(
        warningMessage
          ? { type: 'warning', message: warningMessage }
          : { type: 'success', message: `Ingreso de ${formatCurrency(parseFloat(monto))} registrado para ${agente}` },
      );
      setMonto('');
      setFechaMovimiento(getNowLima());
      montoRef.current?.focus();
      currentPageRef.current = 0;
      await refreshIngresos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar ingreso' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="ingresos-page">
        <div className="page-header"><h1 className="page-title">💰 Ingresos a Caja</h1></div>
        <AlertBanner type="warning" message="Solo los administradores pueden gestionar ingresos" autoDismiss={0} />
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">💰 Ingresos</h1>
            <p className="page-subtitle">Cargando...</p>
          </div>
        </div>
        <div className="card skeleton-form">
          <div className="skeleton-form-row">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton-field">
                <span className="skeleton-line skeleton-label" />
                <span className="skeleton-line skeleton-input" />
              </div>
            ))}
          </div>
          <div className="skeleton-card" style={{ height: '48px', width: '180px' }} />
        </div>
        <div className="mt-lg">
          <TableSkeleton columns={7} rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="ingresos-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Ingresos a Caja</h1>
          <p className="page-subtitle">Asignar dinero a agentes</p>
        </div>
        <span className="badge badge-green">{ingresos.length} de {pagination.total} registros</span>
      </div>

      <form className="card" onSubmit={handleSubmit} id="ingreso-form">
        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="agente-select">Agente</label>
            <select className="select" id="agente-select" value={agente} onChange={(e) => setAgente(e.target.value)}>
              {config.agentes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="banco-ingreso">Banco</label>
            <select className="select" id="banco-ingreso" value={banco} onChange={(e) => setBanco(e.target.value)}>
              {config.bancos.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="monto-ingreso">Monto (S/)</label>
            <input ref={montoRef} className="input" id="monto-ingreso" type="number" step="0.01" min="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="fecha-movimiento">Fecha y Hora del Ingreso</label>
            <input className="input" id="fecha-movimiento" type="datetime-local"
              value={fechaMovimiento} onChange={(e) => setFechaMovimiento(e.target.value)} required />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting || loading || !config} id="submit-ingreso">
            {submitting ? '⏳ Registrando...' : '✅ Registrar Ingreso'}
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {ingresos.length === 0 ? (
          <div className="empty-state card"><div className="empty-state-icon">💰</div><p>No hay ingresos registrados</p></div>
        ) : (
          <div className="table-container">
            <table className="table" id="ingresos-table">
              <thead><tr><th>Fecha Movimiento</th><th>Agente</th><th>Banco</th><th>Estado</th><th style={{textAlign:'right'}}>Monto</th><th>Registrado</th>{isAdmin && <th style={{textAlign:'right'}}>Acciones</th>}</tr></thead>
              <tbody>
                {ingresos.map((i, idx) => (
                  <tr key={i.id || idx} className={isAnulado(i) ? 'mov-row mov-row--anulado' : 'mov-row'}>
                    <td><strong>{formatDateTime(i.fecha_movimiento)}</strong></td>
                    <td><strong>{i.agente}</strong></td>
                    <td><span className="badge badge-blue">{i.banco}</span></td>
                    <td><span className={`badge ${isAnulado(i) ? 'badge-red' : 'badge-green'}`}>{isAnulado(i) ? 'Anulado' : 'Activo'}</span></td>
                    <td className="text-right"><span className={`amount ${isAnulado(i) ? 'amount-muted' : 'amount-positive'}`}>{formatCurrency(i.monto)}</span></td>
                    <td className="text-muted" style={{fontSize:'0.75rem'}}>{formatDateTime(i.fecha_registro || '')}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="row-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(i)} disabled={Boolean(actionLoading)}>Editar</button>
                          {!isAnulado(i) ? (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => openCancelModal(i)} disabled={Boolean(actionLoading)}>Anular</button>
                          ) : (
                            <span className="text-muted">Sin acciones</span>
                          )}
                        </div>
                      </td>
                    )}
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

      {isAdmin && editingIngreso && (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="edit-ingreso-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="edit-ingreso-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>
                  Editar ingreso
                </h3>
                <p className="page-subtitle" style={{ margin: 0 }}>Conserva trazabilidad completa al actualizar el registro.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeEditModal}>Cerrar</button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateIngreso}>
              <div className="modal-grid">
                <label className="field-group">
                  <span className="label">Agente</span>
                  <select className="select" value={editForm.agente} onChange={(e) => setEditForm((current) => ({ ...current, agente: e.target.value }))} required>
                    {config.agentes.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Banco</span>
                  <select className="select" value={editForm.banco} onChange={(e) => setEditForm((current) => ({ ...current, banco: e.target.value }))} required>
                    {config.bancos.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Monto</span>
                  <input className="input" type="number" min="0.01" step="0.01" value={editForm.monto} onChange={(e) => setEditForm((current) => ({ ...current, monto: e.target.value }))} required />
                </label>
                <label className="field-group">
                  <span className="label">Fecha movimiento</span>
                  <input className="input" type="datetime-local" value={editForm.fecha_movimiento} onChange={(e) => setEditForm((current) => ({ ...current, fecha_movimiento: e.target.value }))} required />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(actionLoading)}>
                  {actionLoading?.type === 'edit' && actionLoading.id === editingIngreso.id ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && cancelTarget && (
        <div className="modal-overlay" role="presentation" onClick={closeCancelModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="cancel-ingreso-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="cancel-ingreso-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>
                  Anular ingreso
                </h3>
                <p className="page-subtitle" style={{ margin: 0 }}>El registro no se borrará. Solo cambiará su estado a anulado.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeCancelModal}>Cerrar</button>
            </div>

            <form className="modal-form" onSubmit={handleCancelIngreso}>
              <div className="modal-summary">
                <div>
                  <strong>{cancelTarget.agente}</strong>
                  <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{cancelTarget.banco} · {formatCurrency(cancelTarget.monto)}</p>
                </div>
                <span className="badge badge-red">Anulación administrativa</span>
              </div>
              <label className="field-group">
                <span className="label">Motivo de anulación</span>
                <textarea className="input modal-textarea" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Describe por qué se anula este ingreso" rows={4} required />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeCancelModal} disabled={Boolean(actionLoading)}>Volver</button>
                <button type="submit" className="btn btn-danger" disabled={Boolean(actionLoading)}>
                  {actionLoading?.type === 'cancel' && actionLoading.id === cancelTarget.id ? 'Anulando...' : 'Confirmar anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
