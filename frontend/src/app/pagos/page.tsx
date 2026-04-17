'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getConfig, createPago, getPagos, updatePago, cancelPago, type PagoRecord } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import ReceiptUploader from '@/components/ReceiptUploader';
import TableSkeleton from '@/components/TableSkeleton';
import './pagos.css';

type PagoFilters = {
  desde: string;
  hasta: string;
  agente: string;
  banco: string;
  usuario: string;
};

function normalizeDateOnly(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const localMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;

  return '';
}

function toDateTimeLocalValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoWithTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (isoWithTime) return `${isoWithTime[1]}T${isoWithTime[2]}`;

  const isoDateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoDateOnly) return `${isoDateOnly[1]}T00:00`;

  return '';
}

function toAmountString(value: string | number | undefined) {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function isPagoAnulado(pago: PagoRecord) {
  return String(pago.estado ?? '').trim().toLowerCase() === 'anulado';
}

const PAGE_SIZE = 50;

export default function PagosPage() {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<{
    bancos: string[];
    agentes: string[];
    tipos_pago: string[];
    cajas: string[];
    usuarios: string[];
  } | null>(null);
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [totalPagos, setTotalPagos] = useState(0);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [pagosLoading, setPagosLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ type: 'edit' | 'cancel'; id: string } | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [filters, setFilters] = useState<PagoFilters>({
    desde: '',
    hasta: '',
    agente: '',
    banco: '',
    usuario: '',
  });

  // Form state
  const [usuario, setUsuario] = useState('');
  const [caja, setCaja] = useState('');
  const [banco, setBanco] = useState('');
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState('');

  // OCR specific state
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [fechaComprobante, setFechaComprobante] = useState('');
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrMonto, setOcrMonto] = useState<number | null>(null);
  const [ocrFecha, setOcrFecha] = useState<string | null>(null);
  const [fechaWarning, setFechaWarning] = useState<string | null>(null);
  const [usuarioWarning, setUsuarioWarning] = useState<string | null>(null);
  const [editingPago, setEditingPago] = useState<PagoRecord | null>(null);
  const [editForm, setEditForm] = useState({
    usuario: '',
    caja: '',
    banco: '',
    monto: '',
    tipo: '',
    comprobante_url: '',
    fecha_comprobante: '',
  });
  const [cancelTarget, setCancelTarget] = useState<PagoRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedInitialPagos = useRef(false);
  const skipFirstFilterFetch = useRef(true);
  const currentPageRef = useRef(0);

  const loadPagosPage = useCallback(async (page: number, nextFilters: PagoFilters) => {
    const safePage = Math.max(page, 0);
    const response = await getPagos({
      ...nextFilters,
      limit: PAGE_SIZE,
      offset: safePage * PAGE_SIZE,
    });

    setPagos(response.data.items);
    setPagination(response.data.pagination);
    setTotalPagos(response.data.pagination.total);
    currentPageRef.current = safePage;

    return response.data;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setPagosLoading(true);
        const [configRes, pagosRes] = await Promise.all([getConfig(), loadPagosPage(0, {
          desde: '',
          hasta: '',
          agente: '',
          banco: '',
          usuario: '',
        })]);
        setConfig(configRes);
        setPagos(pagosRes.items);
        setTotalPagos(pagosRes.pagination.total);
        hasLoadedInitialPagos.current = true;
        skipFirstFilterFetch.current = true;
        setCaja((current) => current || configRes.cajas[0] || '');
        setBanco((current) => current || configRes.bancos[0] || '');
        setTipo((current) => current || configRes.tipos_pago[0] || '');
      } catch (err) {
        setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
      } finally {
        setLoading(false);
        setPagosLoading(false);
      }
    };

    void loadData();
  }, [loadPagosPage]);

  useEffect(() => {
    if (!loading && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (!hasLoadedInitialPagos.current || !config) {
      return undefined;
    }

    if (skipFirstFilterFetch.current) {
      skipFirstFilterFetch.current = false;
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const loadFilteredPagos = async () => {
        try {
          setPagosLoading(true);
          await loadPagosPage(0, filters);
        } catch (err) {
          setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al aplicar filtros de pagos' });
        } finally {
          setPagosLoading(false);
        }
      };

      void loadFilteredPagos();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [config, filters, loadPagosPage]);

  const hasActiveFilters = Boolean(
    filters.desde || filters.hasta || filters.agente || filters.banco || filters.usuario.trim(),
  );

  const resetFilters = useCallback(() => {
    setFilters({
      desde: '',
      hasta: '',
      agente: '',
      banco: '',
      usuario: '',
    });
  }, []);

  const openEditModal = useCallback((pago: PagoRecord) => {
    setEditingPago(pago);
    setEditForm({
      usuario: pago.usuario || '',
      caja: pago.caja || '',
      banco: pago.banco || '',
      monto: toAmountString(pago.monto),
      tipo: pago.tipo || '',
      comprobante_url: pago.comprobante_url || '',
      fecha_comprobante: toDateTimeLocalValue(pago.fecha_comprobante || ''),
    });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingPago(null);
  }, []);

  const openCancelModal = useCallback((pago: PagoRecord) => {
    setCancelTarget(pago);
    setCancelReason('');
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelTarget(null);
    setCancelReason('');
  }, []);

  const refreshPagos = useCallback(async () => {
    await loadPagosPage(currentPageRef.current, filters);
  }, [filters, loadPagosPage]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || pagosLoading) {
      return;
    }

    void loadPagosPage(currentPageRef.current - 1, filters).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [filters, loadPagosPage, pagination.offset, pagosLoading]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || pagosLoading) {
      return;
    }

    void loadPagosPage(currentPageRef.current + 1, filters).catch((err) => {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar de pagina' });
    });
  }, [filters, loadPagosPage, pagination.hasMore, pagosLoading]);

  const handleUpdatePago = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPago) return;

    if (!editForm.usuario.trim() || !editForm.caja.trim() || !editForm.banco.trim() || !editForm.tipo.trim()) {
      setAlert({ type: 'error', message: 'Completa los campos obligatorios antes de guardar la edición' });
      return;
    }

    const parsedAmount = parseFloat(editForm.monto);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAlert({ type: 'error', message: 'Ingresa un monto válido para guardar la edición' });
      return;
    }

    try {
      setActionLoading({ type: 'edit', id: editingPago.id });
      await updatePago(editingPago.id, {
        usuario: editForm.usuario.trim(),
        caja: editForm.caja.trim(),
        banco: editForm.banco.trim(),
        monto: parsedAmount,
        tipo: editForm.tipo.trim(),
        comprobante_url: editForm.comprobante_url.trim(),
        fecha_comprobante: editForm.fecha_comprobante.trim(),
      });
      setAlert({ type: 'success', message: 'Pago actualizado correctamente' });
      closeEditModal();
      await refreshPagos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al editar pago' });
    } finally {
      setActionLoading(null);
    }
  }, [closeEditModal, editForm, editingPago, refreshPagos]);

  const handleCancelPago = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelTarget) return;

    if (!cancelReason.trim()) {
      setAlert({ type: 'error', message: 'Escribe un motivo para anular el pago' });
      return;
    }

    try {
      setActionLoading({ type: 'cancel', id: cancelTarget.id });
      await cancelPago(cancelTarget.id, cancelReason.trim());
      setAlert({ type: 'success', message: 'Pago anulado correctamente' });
      closeCancelModal();
      await refreshPagos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al anular pago' });
    } finally {
      setActionLoading(null);
    }
  }, [cancelReason, cancelTarget, closeCancelModal, refreshPagos]);

  const validateUsuario = useCallback((value: string) => {
    if (!config) return;

    const trimmed = value.trim();
    if (!trimmed) {
      setUsuarioWarning(null);
      return;
    }

    const exists = config.usuarios.some((item) => item.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setUsuarioWarning(null);
      return;
    }

    const message = `El usuario "${trimmed}" no existe en la tabla de usuarios registrada. Puedes continuar si igual deseas guardarlo.`;
    setUsuarioWarning(message);
    setAlert({ type: 'warning', message });
  }, [config]);

  const validateFechaAgainstOCR = useCallback((nextFecha: string, shouldAlert = false, detectedFecha?: string | null) => {
    const sourceFecha = detectedFecha ?? ocrFecha;
    if (!sourceFecha) {
      setFechaWarning(null);
      return;
    }

    const manualDate = normalizeDateOnly(nextFecha);
    const detectedDate = normalizeDateOnly(sourceFecha);

    if (!manualDate || !detectedDate || manualDate === detectedDate) {
      setFechaWarning(null);
      return;
    }

    const message = `Discrepancia OCR: la fecha detectada en el voucher es ${detectedDate} y la ingresada es ${manualDate}. La diferencia de hora se ignora.`;
    setFechaWarning(message);
    if (shouldAlert) {
      setAlert({ type: 'warning', message });
    }
  }, [ocrFecha]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !monto || parseFloat(monto) <= 0) {
      setAlert({ type: 'error', message: 'Completa usuario y monto válido' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await createPago({
        usuario: usuario.trim(),
        caja,
        banco,
        monto: parseFloat(monto),
        tipo,
        comprobante_url: comprobanteUrl,
        fecha_comprobante: fechaComprobante,
      });
      const warningMessage = response.warnings?.length
        ? `Pago registrado con observaciones: ${response.warnings.join(' • ')}`
        : '';
      setAlert(
        warningMessage
          ? { type: 'warning', message: warningMessage }
          : { type: 'success', message: `Pago de ${formatCurrency(parseFloat(monto))} registrado` },
      );
      setUsuario('');
      setMonto('');
      setOcrMonto(null);
      setOcrFecha(null);
      setOcrWarning(null);
      setFechaWarning(null);
      setUsuarioWarning(null);
      setComprobanteUrl('');
      setFechaComprobante('');
      firstInputRef.current?.focus();
      currentPageRef.current = 0;
      setPagination((current) => ({ ...current, offset: 0 }));
      await refreshPagos();
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al registrar pago' });
    } finally {
      setSubmitting(false);
    }
  }, [banco, caja, comprobanteUrl, fechaComprobante, monto, refreshPagos, tipo, usuario]);

  const handleOCR = (data: { monto: number | null; fecha: string | null; imageUrl: string }) => {
    setComprobanteUrl(data.imageUrl);
    setOcrFecha(data.fecha);
    if (data.fecha) {
      const nextFecha = toDateTimeLocalValue(data.fecha);
      setFechaComprobante(nextFecha);
      validateFechaAgainstOCR(nextFecha, false, data.fecha);
    } else {
      setFechaWarning(null);
    }
    if (data.monto) {
      setOcrMonto(data.monto);
      if (!monto) {
        setMonto(data.monto.toString());
        setOcrWarning(null);
      } else {
        const currentMonto = parseFloat(monto);
        if (Math.abs(currentMonto - data.monto) > 0.02) {
          setOcrWarning(`Discrepancia OCR: El comprobante analizado parece indicar S/ ${data.monto.toFixed(2)}`);
        } else {
          setOcrWarning(null);
        }
      }
    } else if (data.imageUrl === '') {
      setOcrMonto(null);
      setOcrFecha(null);
      setOcrWarning(null);
      setFechaWarning(null);
    }
  };

  if (loading || !config) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Pagos</h1>
            <p className="page-subtitle">Cargando...</p>
          </div>
        </div>
        <div className="card skeleton-form">
          <div className="skeleton-field">
            <span className="skeleton-line skeleton-label" />
            <span className="skeleton-line skeleton-input" />
          </div>
          <div className="skeleton-form-row">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="skeleton-field">
                <span className="skeleton-line skeleton-label" />
                <span className="skeleton-line skeleton-input" />
              </div>
            ))}
          </div>
          <div className="skeleton-card" style={{ height: '48px', width: '180px' }} />
        </div>
        <div className="mt-lg">
          <h2 className="balance-section-title" style={{ marginBottom: '12px', fontSize: '1rem' }}>
            Últimos Pagos
          </h2>
          <TableSkeleton columns={isAdmin ? 10 : 9} rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="pagos-page">
      {alert && (
        <AlertBanner
          type={alert.type}
          message={alert.message}
          onDismiss={() => setAlert(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">💳 Registro de Pagos</h1>
        </div>
        <span className="badge badge-gold">{pagos.length} de {totalPagos} resultados</span>
      </div>

      <form className="pagos-form card" onSubmit={handleSubmit} id="pago-form">
        <ReceiptUploader
          onOCRComplete={handleOCR}
          onError={(msg) => setAlert({ type: 'error', message: msg })}
        />

        <div className="form-grid">
          <div className="field-group">
            <label className="label" htmlFor="usuario">Usuario</label>
            <input
              ref={firstInputRef}
              className="input"
              id="usuario"
              value={usuario}
              onChange={(e) => {
                setUsuario(e.target.value);
                if (usuarioWarning) setUsuarioWarning(null);
              }}
              onBlur={(e) => validateUsuario(e.target.value)}
              placeholder="Nombre del usuario"
              required
              autoComplete="off"
              list="usuarios-list"
              tabIndex={1}
            />
            <datalist id="usuarios-list">
              {config.usuarios.map((item) => <option key={item} value={item} />)}
            </datalist>
            {usuarioWarning && (
              <div style={{ color: 'var(--accent-orange)', fontSize: '0.85rem', marginTop: '4px', fontWeight: 500 }}>
                ⚠️ {usuarioWarning}
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="label" htmlFor="caja-select">Caja</label>
            <select className="select" id="caja-select" value={caja} onChange={(e) => setCaja(e.target.value)} tabIndex={2}>
              {config.cajas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="banco-select">Banco</label>
            <select className="select" id="banco-select" value={banco} onChange={(e) => setBanco(e.target.value)} tabIndex={3}>
              {config.bancos.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="monto-input">Monto (S/)</label>
            <input
              className="input"
              id="monto-input"
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => {
                const val = e.target.value;
                setMonto(val);
                if (ocrMonto && val) {
                  const diff = Math.abs(parseFloat(val) - ocrMonto);
                  if (diff > 0.02) {
                    setOcrWarning(`Discrepancia OCR: El comprobante analizado parece indicar S/ ${ocrMonto.toFixed(2)}`);
                  } else {
                    setOcrWarning(null);
                  }
                } else {
                  setOcrWarning(null);
                }
              }}
              placeholder="0.00"
              required
              tabIndex={4}
            />
            {ocrWarning && (
              <div style={{ color: 'var(--accent-orange)', fontSize: '0.85rem', marginTop: '4px', fontWeight: 500 }}>
                ⚠️ {ocrWarning}
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="label" htmlFor="fecha-comprobante">Fecha y Hora Comprobante</label>
            <input
              className="input"
              id="fecha-comprobante"
              type="datetime-local"
              value={fechaComprobante}
              onChange={(e) => {
                const nextFecha = e.target.value;
                setFechaComprobante(nextFecha);
                validateFechaAgainstOCR(nextFecha, true);
              }}
              tabIndex={5}
            />
            {fechaComprobante && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.80rem', marginTop: '4px' }}>
                Extraída/Ingresada: {fechaComprobante}
              </div>
            )}
            {fechaWarning && (
              <div style={{ color: 'var(--accent-orange)', fontSize: '0.85rem', marginTop: '4px', fontWeight: 500 }}>
                ⚠️ {fechaWarning}
              </div>
            )}
          </div>

          <div className="field-group">
            <label className="label" htmlFor="tipo-select">Tipo de Pago</label>
            <select className="select" id="tipo-select" value={tipo} onChange={(e) => setTipo(e.target.value)} tabIndex={6}>
              {config.tipos_pago.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting || loading || !config}
            id="submit-pago"
            tabIndex={7}
          >
            {submitting ? '⏳ Registrando...' : '✅ Registrar Pago'}
          </button>
        </div>
      </form>

      <section className="pagos-filters card" aria-label="Filtros de pagos">
        <div className="section-heading">
          <div>
            <h2 className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>
              Filtros de búsqueda
            </h2>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Combina fecha, agente, banco y usuario para encontrar movimientos más rápido.
            </p>
          </div>
          <div className="filters-actions">
            <span className="badge badge-blue">
              {pagos.length} de {totalPagos} resultados
            </span>
            <button className="btn btn-secondary" type="button" onClick={resetFilters} disabled={!hasActiveFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="filters-grid">
          <div className="field-group">
            <label className="label" htmlFor="filtro-desde">Desde</label>
            <input
              className="input"
              id="filtro-desde"
              type="date"
              value={filters.desde}
              onChange={(e) => setFilters((current) => ({ ...current, desde: e.target.value }))}
            />
          </div>

          <div className="field-group">
            <label className="label" htmlFor="filtro-hasta">Hasta</label>
            <input
              className="input"
              id="filtro-hasta"
              type="date"
              value={filters.hasta}
              onChange={(e) => setFilters((current) => ({ ...current, hasta: e.target.value }))}
            />
          </div>

          <div className="field-group">
            <label className="label" htmlFor="filtro-agente">Agente</label>
            <select
              className="select"
              id="filtro-agente"
              value={filters.agente}
              onChange={(e) => setFilters((current) => ({ ...current, agente: e.target.value }))}
            >
              <option value="">Todos los agentes</option>
              {config.agentes.map((agenteOption) => (
                <option key={agenteOption} value={agenteOption}>
                  {agenteOption}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="filtro-banco">Banco</label>
            <select
              className="select"
              id="filtro-banco"
              value={filters.banco}
              onChange={(e) => setFilters((current) => ({ ...current, banco: e.target.value }))}
            >
              <option value="">Todos los bancos</option>
              {config.bancos.map((bancoOption) => (
                <option key={bancoOption} value={bancoOption}>
                  {bancoOption}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group field-group--wide">
            <label className="label" htmlFor="filtro-usuario">Usuario</label>
            <input
              className="input"
              id="filtro-usuario"
              value={filters.usuario}
              onChange={(e) => setFilters((current) => ({ ...current, usuario: e.target.value }))}
              placeholder="Buscar por nombre de usuario"
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      <div className="mt-lg">
        <h2 className="balance-section-title" style={{ marginBottom: '12px', fontSize: '1rem' }}>
          Últimos Pagos
        </h2>
        {pagosLoading ? (
          <TableSkeleton columns={isAdmin ? 10 : 9} rows={4} />
        ) : pagos.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">💳</div>
            <p>{hasActiveFilters ? 'No hay pagos que coincidan con los filtros' : 'No hay pagos registrados'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" id="pagos-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Fecha Registro</th>
                  <th>Fecha Comprobante</th>
                  <th>Usuario</th>
                  <th>Agente</th>
                  <th>Banco</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => (
                  <tr key={p.id || i} className={isPagoAnulado(p) ? 'pago-row pago-row--anulado' : 'pago-row'}>
                    <td>{p.comprobante_url ? '📸' : ''}</td>
                    <td className="text-muted">{formatDateTime(p.fecha_registro || '')}</td>
                    <td style={{ color: p.fecha_comprobante ? 'var(--accent-gold)' : 'inherit' }}>
                      {p.fecha_comprobante ? p.fecha_comprobante : <span className="text-muted">-</span>}
                    </td>
                    <td><strong>{p.usuario}</strong></td>
                    <td>{p.agente}</td>
                    <td><span className="badge badge-blue">{p.banco}</span></td>
                    <td>{p.tipo}</td>
                    <td>
                      <span className={`badge ${isPagoAnulado(p) ? 'badge-red' : 'badge-green'}`}>
                        {isPagoAnulado(p) ? 'Anulado' : 'Activo'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`amount ${isPagoAnulado(p) ? 'amount-muted' : 'amount-negative'}`}>
                        {formatCurrency(p.monto)}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(p)}
                            disabled={Boolean(actionLoading)}
                          >
                            Editar
                          </button>
                          {!isPagoAnulado(p) ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => openCancelModal(p)}
                              disabled={Boolean(actionLoading)}
                            >
                              Anular
                            </button>
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
        {!pagosLoading && totalPagos > 0 && (
          <PaginationControls
            pagination={pagination}
            loading={pagosLoading}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
          />
        )}
      </div>

      {isAdmin && editingPago && (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="edit-pago-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="edit-pago-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>
                  Editar pago
                </h3>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  Conserva trazabilidad completa al actualizar el registro.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeEditModal}>
                Cerrar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdatePago}>
              <div className="modal-grid">
                <label className="field-group">
                  <span className="label">Usuario</span>
                  <input
                    className="input"
                    value={editForm.usuario}
                    onChange={(e) => setEditForm((current) => ({ ...current, usuario: e.target.value }))}
                    required
                  />
                </label>
                <label className="field-group">
                  <span className="label">Caja</span>
                  <select
                    className="select"
                    value={editForm.caja}
                    onChange={(e) => setEditForm((current) => ({ ...current, caja: e.target.value }))}
                    required
                  >
                    {config.cajas.map((cajaOption) => (
                      <option key={cajaOption} value={cajaOption}>
                        {cajaOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Banco</span>
                  <select
                    className="select"
                    value={editForm.banco}
                    onChange={(e) => setEditForm((current) => ({ ...current, banco: e.target.value }))}
                    required
                  >
                    {config.bancos.map((bancoOption) => (
                      <option key={bancoOption} value={bancoOption}>
                        {bancoOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Tipo</span>
                  <select
                    className="select"
                    value={editForm.tipo}
                    onChange={(e) => setEditForm((current) => ({ ...current, tipo: e.target.value }))}
                    required
                  >
                    {config.tipos_pago.map((tipoOption) => (
                      <option key={tipoOption} value={tipoOption}>
                        {tipoOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span className="label">Monto</span>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editForm.monto}
                    onChange={(e) => setEditForm((current) => ({ ...current, monto: e.target.value }))}
                    required
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="label">Comprobante URL</span>
                  <input
                    className="input"
                    value={editForm.comprobante_url}
                    onChange={(e) => setEditForm((current) => ({ ...current, comprobante_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="label">Fecha comprobante</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={editForm.fecha_comprobante}
                    onChange={(e) => setEditForm((current) => ({ ...current, fecha_comprobante: e.target.value }))}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditModal}
                  disabled={Boolean(actionLoading)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading?.type === 'edit' && actionLoading.id === editingPago.id ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && cancelTarget && (
        <div className="modal-overlay" role="presentation" onClick={closeCancelModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="cancel-pago-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="cancel-pago-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>
                  Anular pago
                </h3>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  El registro no se borrará. Solo cambiará su estado a anulado.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeCancelModal}>
                Cerrar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCancelPago}>
              <div className="modal-summary">
                <div>
                  <strong>{cancelTarget.usuario}</strong>
                  <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
                    {cancelTarget.banco} · {formatCurrency(cancelTarget.monto)}
                  </p>
                </div>
                <span className="badge badge-red">Anulación administrativa</span>
              </div>

              <label className="field-group">
                <span className="label">Motivo de anulación</span>
                <textarea
                  className="input modal-textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Describe por qué se anula este pago"
                  rows={4}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCancelModal}
                  disabled={Boolean(actionLoading)}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={Boolean(actionLoading)}
                >
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
