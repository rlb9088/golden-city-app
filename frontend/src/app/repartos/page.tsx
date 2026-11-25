'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createReparto,
  deleteReparto,
  getConfig,
  getRepartos,
  getScopedBancos,
  isNetworkError,
  updateReparto,
  type ConfigBanco,
  type RepartoRecord,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import ListInput from '@/components/ListInput';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import '../gastos/gastos.css';

const PAGE_SIZE = 50;

interface RepartosConfig {
  categorias_reparto: Record<string, string[]>;
  dominios_reparto: Record<string, string>;
  conceptos_reparto: string[];
  proveedores_reparto: string[];
}

const emptyForm = {
  concepto: '',
  categoria: '',
  subcategoria: '',
  proveedor: '',
  nota: '',
  banco: '',
  monto: '',
  fecha_movimiento: '',
};

export default function RepartosPage() {
  const { isAdmin, user } = useAuth();
  const [config, setConfig] = useState<RepartosConfig | null>(null);
  const [scopedBancos, setScopedBancos] = useState<ConfigBanco[]>([]);
  const [repartos, setRepartos] = useState<RepartoRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ type: 'edit' | 'delete'; id: string } | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [form, setForm] = useState({ ...emptyForm, fecha_movimiento: getTodayLima() });
  const [editing, setEditing] = useState<RepartoRecord | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<RepartoRecord | null>(null);
  const conceptoRef = useRef<HTMLInputElement>(null);
  const currentPageRef = useRef(0);

  const loadPage = useCallback(async (page: number) => {
    const safePage = Math.max(page, 0);
    const res = await getRepartos({ limit: PAGE_SIZE, offset: safePage * PAGE_SIZE });
    setRepartos(res.data.items);
    setPagination(res.data.pagination);
    currentPageRef.current = safePage;
    return res.data;
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const [configRes] = await Promise.all([getConfig(), loadPage(0)]);
        const repartosConfig: RepartosConfig = {
          categorias_reparto: configRes.categorias_reparto || {},
          dominios_reparto: configRes.dominios_reparto || {},
          conceptos_reparto: configRes.conceptos_reparto || [],
          proveedores_reparto: configRes.proveedores_reparto || [],
        };
        setConfig(repartosConfig);
        const firstCat = Object.keys(repartosConfig.categorias_reparto)[0] || '';
        setForm((current) => ({
          ...current,
          categoria: current.categoria || firstCat,
          subcategoria: current.subcategoria || repartosConfig.categorias_reparto[firstCat]?.[0] || '',
        }));
        const scoped = await getScopedBancos(user?.id);
        setScopedBancos(scoped.data);
        setForm((current) => ({ ...current, banco: current.banco || scoped.data[0]?.id || '' }));
      } catch (err) {
        if (!isNetworkError(err)) {
          setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
        }
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [isAdmin, loadPage, user?.id]);

  const changePage = useCallback((delta: number) => {
    if (loading) return;
    void loadPage(currentPageRef.current + delta).catch((err) => {
      if (!isNetworkError(err)) setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [loadPage, loading]);

  const dominioOf = (categoria: string) => config?.dominios_reparto[categoria] || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(form.monto);
    if (!form.concepto.trim() || !form.proveedor.trim() || !form.banco || !Number.isFinite(monto) || monto <= 0) {
      setAlert({ type: 'error', message: 'Completa concepto, proveedor, banco y monto válido' });
      return;
    }
    try {
      setSubmitting(true);
      const response = await createReparto({
        concepto: form.concepto.trim(),
        categoria: form.categoria,
        subcategoria: form.subcategoria,
        proveedor: form.proveedor.trim(),
        nota: form.nota.trim(),
        banco_id: form.banco,
        monto,
        fecha_movimiento: form.fecha_movimiento,
      });
      setAlert(response.warnings?.length
        ? { type: 'warning', message: `Registrado con observaciones: ${response.warnings.join(' • ')}` }
        : { type: 'success', message: `Registro de ${formatCurrency(monto)} guardado` });
      setForm((current) => ({ ...current, concepto: '', proveedor: '', nota: '', monto: '', fecha_movimiento: getTodayLima() }));
      conceptoRef.current?.focus();
      await loadPage(0);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row: RepartoRecord) => {
    setEditing(row);
    setEditForm({
      concepto: row.concepto || '',
      categoria: row.categoria || '',
      subcategoria: row.subcategoria || '',
      proveedor: row.proveedor || '',
      nota: row.nota || '',
      banco: row.banco_id || '',
      monto: String(row.monto ?? ''),
      fecha_movimiento: row.fecha_movimiento || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const monto = parseFloat(editForm.monto);
    if (!editForm.concepto.trim() || !editForm.proveedor.trim() || !editForm.banco || !Number.isFinite(monto) || monto <= 0) {
      setAlert({ type: 'error', message: 'Completa concepto, proveedor, banco y monto válido' });
      return;
    }
    try {
      setActionLoading({ type: 'edit', id: editing.id });
      await updateReparto(editing.id, {
        concepto: editForm.concepto.trim(),
        categoria: editForm.categoria,
        subcategoria: editForm.subcategoria,
        proveedor: editForm.proveedor.trim(),
        nota: editForm.nota.trim(),
        banco_id: editForm.banco,
        monto,
        fecha_movimiento: editForm.fecha_movimiento,
      });
      setAlert({ type: 'success', message: 'Registro actualizado correctamente' });
      setEditing(null);
      await loadPage(currentPageRef.current);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al editar' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading({ type: 'delete', id: deleteTarget.id });
      await deleteReparto(deleteTarget.id);
      setAlert({ type: 'success', message: 'Registro eliminado correctamente.' });
      setDeleteTarget(null);
      await loadPage(currentPageRef.current);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al eliminar' });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="repartos-page">
        <div className="page-header"><h1 className="page-title">🤝 Reparto e Inversiones</h1></div>
        <AlertBanner type="warning" message="Solo los administradores pueden gestionar repartos e inversiones" autoDismiss={0} />
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="animate-fade-in">
        <div className="page-header"><div><h1 className="page-title">🤝 Reparto e Inversiones</h1><p className="page-subtitle">Cargando...</p></div></div>
        <TableSkeleton columns={7} rows={4} />
      </div>
    );
  }

  const categorias = Object.keys(config.categorias_reparto);
  const subcategorias = config.categorias_reparto[form.categoria] || [];

  return (
    <div className="animate-fade-in" id="repartos-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">🤝 Reparto e Inversiones</h1>
          <p className="page-subtitle">Registro informativo: no afecta caja ni balance</p>
        </div>
        <span className="badge badge-gold">{repartos.length} de {pagination.total} registros</span>
      </div>

      <form className="card" onSubmit={handleSubmit} id="reparto-form">
        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="fecha-reparto">Fecha</label>
            <input className="input" id="fecha-reparto" type="date" value={form.fecha_movimiento}
              onChange={(e) => setForm({ ...form, fecha_movimiento: e.target.value })} required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="concepto-reparto">Concepto</label>
            <ListInput ref={conceptoRef} id="concepto-reparto" value={form.concepto} options={config.conceptos_reparto}
              onChange={(value) => setForm({ ...form, concepto: value })} placeholder="Selecciona o escribe para buscar" required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="proveedor-reparto">Proveedor</label>
            <ListInput id="proveedor-reparto" value={form.proveedor} options={config.proveedores_reparto}
              onChange={(value) => setForm({ ...form, proveedor: value })} placeholder="Selecciona o escribe para buscar" required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="categoria-reparto">Categoría</label>
            <select className="select" id="categoria-reparto" value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value, subcategoria: config.categorias_reparto[e.target.value]?.[0] || '' })}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="subcategoria-reparto">Subcategoría</label>
            <select className="select" id="subcategoria-reparto" value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}>
              {subcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label">Dominio</label>
            <input className="input" value={dominioOf(form.categoria)} readOnly disabled />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="banco-reparto">Banco</label>
            <select className="select" id="banco-reparto" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} disabled={scopedBancos.length === 0}>
              {scopedBancos.length === 0
                ? <option value="">No hay bancos disponibles</option>
                : scopedBancos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="monto-reparto">Importe (S/)</label>
            <input className="input" id="monto-reparto" type="number" step="0.01" min="0.01" value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" required />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="nota-reparto">Nota</label>
            <input className="input" id="nota-reparto" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Opcional" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting} id="submit-reparto">
            {submitting ? '⏳ Registrando...' : '✅ Registrar'}
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {repartos.length === 0 ? (
          <div className="empty-state card"><div className="empty-state-icon">🤝</div><p>No hay registros</p></div>
        ) : (
          <div className="table-container">
            <table className="table" id="repartos-table">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Dominio / Categoría</th><th>Banco</th><th style={{ textAlign: 'right' }}>Importe</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
              <tbody>
                {repartos.map((r) => (
                  <tr key={r.id} className="mov-row">
                    <td><strong>{formatDate(r.fecha_movimiento)}</strong></td>
                    <td><strong>{r.concepto}</strong>{r.nota && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.nota}</div>}</td>
                    <td>{r.proveedor}</td>
                    <td><span className="badge badge-gold">{r.dominio}</span> <span className="text-muted">{r.categoria}{r.subcategoria ? ` / ${r.subcategoria}` : ''}</span></td>
                    <td><span className="badge badge-blue">{r.banco}</span></td>
                    <td className="text-right"><span className="amount">{formatCurrency(r.monto)}</span></td>
                    <td className="text-right">
                      <div className="row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(r)} disabled={Boolean(actionLoading)}>Editar</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(r)} disabled={Boolean(actionLoading)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.total > 0 && (
          <PaginationControls pagination={pagination} loading={loading} onPrevious={() => pagination.offset > 0 && changePage(-1)} onNext={() => pagination.hasMore && changePage(1)} />
        )}
      </div>

      {editing && (
        <div className="modal-overlay" role="presentation" onClick={() => setEditing(null)}>
          <div className="modal-card card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="balance-section-title" style={{ fontSize: '1rem' }}>Editar registro</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cerrar</button>
            </div>
            <form className="modal-form" onSubmit={handleUpdate}>
              <div className="modal-grid">
                <label className="field-group"><span className="label">Fecha</span>
                  <input className="input" type="date" value={editForm.fecha_movimiento} onChange={(e) => setEditForm({ ...editForm, fecha_movimiento: e.target.value })} required /></label>
                <label className="field-group"><span className="label">Concepto</span>
                  <ListInput value={editForm.concepto} options={config.conceptos_reparto} onChange={(value) => setEditForm({ ...editForm, concepto: value })} required /></label>
                <label className="field-group"><span className="label">Proveedor</span>
                  <ListInput value={editForm.proveedor} options={config.proveedores_reparto} onChange={(value) => setEditForm({ ...editForm, proveedor: value })} required /></label>
                <label className="field-group"><span className="label">Categoría</span>
                  <select className="select" value={editForm.categoria}
                    onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value, subcategoria: config.categorias_reparto[e.target.value]?.[0] || '' })}>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></label>
                <label className="field-group"><span className="label">Subcategoría</span>
                  <select className="select" value={editForm.subcategoria} onChange={(e) => setEditForm({ ...editForm, subcategoria: e.target.value })}>
                    {(config.categorias_reparto[editForm.categoria] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></label>
                <label className="field-group"><span className="label">Banco</span>
                  <select className="select" value={editForm.banco} onChange={(e) => setEditForm({ ...editForm, banco: e.target.value })} required>
                    {scopedBancos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select></label>
                <label className="field-group"><span className="label">Importe</span>
                  <input className="input" type="number" min="0.01" step="0.01" value={editForm.monto} onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })} required /></label>
                <label className="field-group"><span className="label">Nota</span>
                  <input className="input" value={editForm.nota} onChange={(e) => setEditForm({ ...editForm, nota: e.target.value })} /></label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(actionLoading)}>
                  {actionLoading?.type === 'edit' ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="balance-section-title" style={{ fontSize: '1rem' }}>Eliminar registro</h3>
                <p className="page-subtitle" style={{ margin: 0 }}>¿Eliminar &quot;{deleteTarget.concepto}&quot; por {formatCurrency(deleteTarget.monto)}? Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={Boolean(actionLoading)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={() => void handleDelete()} disabled={Boolean(actionLoading)}>
                {actionLoading?.type === 'delete' ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
