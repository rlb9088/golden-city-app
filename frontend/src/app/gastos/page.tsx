'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { getConfig, createGasto, getGastos, getScopedBancos, updateGasto, deleteGasto, isNetworkError, type ConfigBanco, type GastoRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import './gastos.css';

const PAGE_SIZE = 50;

export default function GastosPage() {
  const { isAdmin, user } = useAuth();
  const [config, setConfig] = useState<{ bancos: string[]; bancos_full: ConfigBanco[]; categorias: Record<string, string[]> } | null>(null);
  const [scopedBancos, setScopedBancos] = useState<ConfigBanco[]>([]);
  const [gastos, setGastos] = useState<GastoRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ type: 'edit' | 'delete'; id: string } | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [banco, setBanco] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaGasto, setFechaGasto] = useState(getTodayLima());
  const [editingGasto, setEditingGasto] = useState<GastoRecord | null>(null);
  const [editForm, setEditForm] = useState({
    concepto: '',
    categoria: '',
    subcategoria: '',
    banco: '',
    monto: '',
    fecha_gasto: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<GastoRecord | null>(null);
  const conceptoRef = useRef<HTMLInputElement>(null);
  const currentPageRef = useRef(0);

  const loadGastosPage = useCallback(async (page: number) => {
    const safePage = Math.max(page, 0);
    const res = await getGastos({ limit: PAGE_SIZE, offset: safePage * PAGE_SIZE });
    setGastos(res.data.items);
    setPagination(res.data.pagination);
    currentPageRef.current = safePage;
    return res.data;
  }, []);

  const refreshGastos = useCallback(async () => {
    await loadGastosPage(currentPageRef.current);
  }, [loadGastosPage]);

  const openEditModal = useCallback((gasto: GastoRecord) => {
    setEditingGasto(gasto);
    setEditForm({
      concepto: gasto.concepto || '',
      categoria: gasto.categoria || '',
      subcategoria: gasto.subcategoria || '',
      banco: gasto.banco_id || '',
      monto: String(gasto.monto ?? ''),
      fecha_gasto: gasto.fecha_gasto || '',
    });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingGasto(null);
  }, []);

  const openDeleteModal = useCallback((gasto: GastoRecord) => {
    setDeleteTarget(gasto);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleUpdateGasto = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGasto) return;

    const parsedMonto = parseFloat(editForm.monto);
    if (!editForm.concepto.trim() || !editForm.categoria.trim() || !editForm.banco.trim() || !editForm.fecha_gasto.trim() || !Number.isFinite(parsedMonto) || parsedMonto <= 0) {
      setAlert({ type: 'error', message: 'Completa concepto, categoría, banco, fecha y monto válidos' });
      return;
    }

    try {
      setActionLoading({ type: 'edit', id: editingGasto.id });
      await updateGasto(editingGasto.id, {
        concepto: editForm.concepto.trim(),
        categoria: editForm.categoria.trim(),
        subcategoria: editForm.subcategoria.trim(),
        banco_id: editForm.banco.trim(),
        monto: parsedMonto,
        fecha_gasto: editForm.fecha_gasto.trim(),
      });
      setAlert({ type: 'success', message: 'Gasto actualizado correctamente' });
      closeEditModal();
      await refreshGastos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al editar gasto' });
    } finally {
      setActionLoading(null);
    }
  }, [closeEditModal, editForm, editingGasto, refreshGastos]);

  const handleDeleteGasto = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setActionLoading({ type: 'delete', id: deleteTarget.id });
      await deleteGasto(deleteTarget.id);
      setGastos((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setAlert({ type: 'success', message: 'Gasto eliminado correctamente.' });
      closeDeleteModal();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al eliminar gasto' });
    } finally {
      setActionLoading(null);
    }
  }, [deleteTarget, closeDeleteModal]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [configRes, gastosRes] = await Promise.all([getConfig(), loadGastosPage(0)]);
        setConfig(configRes);
        setGastos(gastosRes.items);
        const defaultCategoria = Object.keys(configRes.categorias)[0] || '';
        setCategoria((current) => current || defaultCategoria);
        setSubcategoria((current) => current || (configRes.categorias[defaultCategoria]?.[0] || ''));
        const scopedResponse = await getScopedBancos(user?.id);
        setScopedBancos(scopedResponse.data);
        setBanco(scopedResponse.data[0]?.id || '');
      } catch (err) {
        if (!isNetworkError(err)) {
          setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
        }
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [loadGastosPage, user?.id]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || loading) {
      return;
    }

    void loadGastosPage(currentPageRef.current - 1).catch((err) => {
      if (!isNetworkError(err)) setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadGastosPage, loading, pagination.offset]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || loading) {
      return;
    }

    void loadGastosPage(currentPageRef.current + 1).catch((err) => {
      if (!isNetworkError(err)) setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadGastosPage, loading, pagination.hasMore]);

  const handleCategoriaChange = (cat: string) => {
    setCategoria(cat);
    if (config) {
      const subs = config.categorias[cat] || [];
      setSubcategoria(subs[0] || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concepto.trim() || !banco.trim() || !scopedBancos.length || !monto || parseFloat(monto) <= 0) {
      setAlert({ type: 'error', message: 'Completa concepto, banco y monto válido' });
      return;
    }
    try {
      setSubmitting(true);
      const response = await createGasto({ concepto: concepto.trim(), categoria, subcategoria, banco_id: banco, monto: parseFloat(monto), fecha_gasto: fechaGasto });
      const warningMessage = response.warnings?.length
        ? `Gasto registrado con observaciones: ${response.warnings.join(' • ')}`
        : '';
      setAlert(
        warningMessage
          ? { type: 'warning', message: warningMessage }
          : { type: 'success', message: `Gasto de ${formatCurrency(parseFloat(monto))} registrado` },
      );
      setConcepto('');
      setMonto('');
      setFechaGasto(getTodayLima());
      conceptoRef.current?.focus();
      currentPageRef.current = 0;
      await refreshGastos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar gasto' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="gastos-page">
        <div className="page-header"><h1 className="page-title">📤 Gastos</h1></div>
        <AlertBanner type="warning" message="Solo los administradores pueden gestionar gastos" autoDismiss={0} />
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">📤 Gastos</h1>
            <p className="page-subtitle">Cargando...</p>
          </div>
        </div>
        <div className="card skeleton-form">
          <div className="skeleton-form-row">
            {[1, 2, 3, 4, 5, 6].map((item) => (
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

  const categorias = Object.keys(config.categorias);
  const subcategorias = config.categorias[categoria] || [];

  return (
    <div className="animate-fade-in" id="gastos-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">📤 Registro de Gastos</h1>
          <p className="page-subtitle">Gastos operativos clasificados</p>
        </div>
        <span className="badge badge-red">{gastos.length} de {pagination.total} registros</span>
      </div>

      <form className="card" onSubmit={handleSubmit} id="gasto-form">
        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="fecha-gasto">Fecha del Gasto</label>
            <input className="input" id="fecha-gasto" type="date"
              value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="concepto-input">Concepto</label>
            <input ref={conceptoRef} className="input" id="concepto-input" value={concepto}
              onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del gasto" required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="categoria-select">Categoría</label>
            <select className="select" id="categoria-select" value={categoria} onChange={(e) => handleCategoriaChange(e.target.value)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="subcategoria-select">Subcategoría</label>
            <select className="select" id="subcategoria-select" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)}>
              {subcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="banco-gasto">Banco</label>
            <select className="select" id="banco-gasto" value={banco} onChange={(e) => setBanco(e.target.value)} disabled={scopedBancos.length === 0}>
              {scopedBancos.length === 0 ? (
                <option value="">No hay bancos disponibles</option>
              ) : (
                scopedBancos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)
              )}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="monto-gasto">Monto (S/)</label>
            <input className="input" id="monto-gasto" type="number" step="0.01" min="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting || loading || !config} id="submit-gasto">
            {submitting ? '⏳ Registrando...' : '✅ Registrar Gasto'}
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {gastos.length === 0 ? (
          <div className="empty-state card"><div className="empty-state-icon">📤</div><p>No hay gastos registrados</p></div>
        ) : (
          <div className="table-container">
            <table className="table" id="gastos-table">
              <thead><tr><th>Fecha Gasto</th><th>Concepto</th><th>Categoría</th><th>Banco</th><th style={{textAlign:'right'}}>Monto</th>{isAdmin && <th style={{textAlign:'right'}}>Acciones</th>}</tr></thead>
              <tbody>
                {gastos.map((g, idx) => (
                  <tr key={g.id || idx} className="mov-row">
                    <td><strong>{formatDate(g.fecha_gasto)}</strong></td>
                    <td><strong>{g.concepto}</strong></td>
                    <td><span className="badge badge-gold">{g.categoria}</span> {g.subcategoria && <span className="text-muted">/ {g.subcategoria}</span>}</td>
                    <td><span className="badge badge-blue">{g.banco}</span></td>
                    <td className="text-right"><span className="amount amount-negative">{formatCurrency(g.monto)}</span></td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="row-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(g)} disabled={Boolean(actionLoading)}>Editar</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => openDeleteModal(g)} disabled={Boolean(actionLoading)}>Eliminar</button>
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

      {isAdmin && editingGasto && (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="edit-gasto-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="edit-gasto-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>Editar gasto</h3>
                <p className="page-subtitle" style={{ margin: 0 }}>Conserva trazabilidad completa al actualizar el registro.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeEditModal}>Cerrar</button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateGasto}>
              <div className="modal-grid">
                <label className="field-group">
                  <span className="label">Concepto</span>
                  <input className="input" value={editForm.concepto} onChange={(e) => setEditForm((current) => ({ ...current, concepto: e.target.value }))} required />
                </label>
                <label className="field-group">
                  <span className="label">Categoría</span>
                  <select className="select" value={editForm.categoria} onChange={(e) => {
                    const nextCategoria = e.target.value;
                    setEditForm((current) => ({
                      ...current,
                      categoria: nextCategoria,
                      subcategoria: config?.categorias[nextCategoria]?.[0] || '',
                    }));
                  }} required>
                    {Object.keys(config.categorias).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Subcategoría</span>
                  <select className="select" value={editForm.subcategoria} onChange={(e) => setEditForm((current) => ({ ...current, subcategoria: e.target.value }))}>
                    {(config.categorias[editForm.categoria] || []).map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Banco</span>
                  <select className="select" value={editForm.banco} onChange={(e) => setEditForm((current) => ({ ...current, banco: e.target.value }))} required disabled={scopedBancos.length === 0}>
                    {scopedBancos.length === 0 ? (
                      <option value="">No hay bancos disponibles</option>
                    ) : (
                      scopedBancos.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)
                    )}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Monto</span>
                  <input className="input" type="number" min="0.01" step="0.01" value={editForm.monto} onChange={(e) => setEditForm((current) => ({ ...current, monto: e.target.value }))} required />
                </label>
                <label className="field-group">
                  <span className="label">Fecha gasto</span>
                  <input className="input" type="date" value={editForm.fecha_gasto} onChange={(e) => setEditForm((current) => ({ ...current, fecha_gasto: e.target.value }))} required />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(actionLoading)}>
                  {actionLoading?.type === 'edit' && actionLoading.id === editingGasto.id ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && deleteTarget && (
        <div className="modal-overlay" role="presentation" onClick={closeDeleteModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="delete-gasto-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="delete-gasto-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>Eliminar gasto</h3>
                <p className="page-subtitle" style={{ margin: 0 }}>¿Eliminar este gasto? Esta acción no se puede deshacer.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeDeleteModal}>Cerrar</button>
            </div>
            <div className="modal-form">
              <div className="modal-summary">
                <div>
                  <strong>{deleteTarget.concepto}</strong>
                  <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{deleteTarget.categoria} · {formatCurrency(deleteTarget.monto)}</p>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeDeleteModal} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={() => void handleDeleteGasto()} disabled={Boolean(actionLoading)}>
                  {actionLoading?.type === 'delete' && actionLoading.id === deleteTarget.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
