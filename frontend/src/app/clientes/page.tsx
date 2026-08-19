'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import { useAuth } from '@/lib/auth-context';
import {
  createCliente,
  downloadClientesExport,
  getClienteHistory,
  getClientes,
  importClientes,
  runClientesQualityReview,
  updateCliente,
  type ClienteHistoryRecord,
  type ClienteRecord,
  type ClientesFilters,
} from '@/lib/api';
import './clientes.css';

const PAGE_SIZE = 50;

type ClienteForm = {
  nombre: string;
  player_id: string;
  dni: string;
  correos: string;
  telefonos: string;
  ips: string;
  ciudad: string;
  usuario_apueston: string;
  id_apueston: string;
  clave_apueston: string;
  link_auth_apueston: string;
};

const emptyForm: ClienteForm = {
  nombre: '',
  player_id: '',
  dni: '',
  correos: '',
  telefonos: '',
  ips: '',
  ciudad: '',
  usuario_apueston: '',
  id_apueston: '',
  clave_apueston: '',
  link_auth_apueston: '',
};

function splitList(value: string) {
  return value.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean);
}

function toPayload(form: ClienteForm) {
  return {
    nombre: form.nombre.trim(),
    player_id: form.player_id.trim(),
    dni: form.dni.trim(),
    correos: splitList(form.correos),
    telefonos: splitList(form.telefonos),
    ips: splitList(form.ips),
    ciudad: form.ciudad.trim(),
    usuario_apueston: form.usuario_apueston.trim(),
    id_apueston: form.id_apueston.trim(),
    clave_apueston: form.clave_apueston.trim(),
    link_auth_apueston: form.link_auth_apueston.trim(),
  };
}

function formFromCliente(cliente: ClienteRecord): ClienteForm {
  const apueston = (cliente.accesos?.apueston || {}) as Record<string, string>;
  return {
    nombre: cliente.nombre || '',
    player_id: cliente.player_id || '',
    dni: cliente.dni || '',
    correos: (cliente.correos || []).join('; '),
    telefonos: (cliente.telefonos || []).join('; '),
    ips: (cliente.ips || []).join('; '),
    ciudad: cliente.ciudad || '',
    usuario_apueston: apueston.usuario || '',
    id_apueston: apueston.id || '',
    clave_apueston: apueston.clave || '',
    link_auth_apueston: apueston.link_auth || '',
  };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseBulkText(value: string) {
  const text = value.trim();
  if (!text) return [];
  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed = JSON.parse(text) as Record<string, unknown>[] | { items?: Record<string, unknown>[] };
    return Array.isArray(parsed) ? parsed : parsed.items || [];
  }

  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  const delimiter = headerLine.includes('\t') ? '\t' : ';';
  const headers = headerLine.split(delimiter).map((header) => header.trim());
  return lines.map((line) => {
    const cells = line.split(delimiter);
    return headers.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header] = cells[index]?.trim() || '';
      return acc;
    }, {});
  });
}

const fieldLabels: Record<string, string> = {
  estado: 'Estado',
  nombre: 'Nombre',
  player_id: 'Player ID',
  dni: 'DNI',
  correos: 'Correos',
  telefonos: 'Telefonos',
  ips: 'IPs',
  ciudad: 'Ciudad',
  ciudad_ip: 'Ciudad IP',
  ip_city_status: 'Estado IP',
  accesos: 'Accesos',
  calidad: 'Calidad',
};

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join('; ') : '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function diffHistory(before: Partial<ClienteRecord> | null, after: Partial<ClienteRecord> | null) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return Array.from(keys)
    .filter((key) => !key.endsWith('_json') && key !== 'raw')
    .map((key) => ({
      key,
      label: fieldLabels[key] || key,
      before: formatValue(before?.[key as keyof ClienteRecord]),
      after: formatValue(after?.[key as keyof ClienteRecord]),
    }))
    .filter((item) => item.before !== item.after);
}

function qualityLabel(status?: string) {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Revisar';
  if (status === 'review') return 'Critico';
  return 'Pendiente';
}

export default function ClientesPage() {
  const { isAdmin } = useAuth();
  const [clientes, setClientes] = useState<ClienteRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [filters, setFilters] = useState<ClientesFilters>({ q: '', ciudad: '', estado: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'xls' | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [editing, setEditing] = useState<ClienteRecord | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [qualityRunning, setQualityRunning] = useState(false);
  const [historyCliente, setHistoryCliente] = useState<ClienteRecord | null>(null);
  const [historyItems, setHistoryItems] = useState<ClienteHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currentPage = Math.floor(pagination.offset / pagination.limit);
  const hasFilters = Boolean(filters.q || filters.ciudad || filters.estado);

  const loadPage = useCallback(async (page = 0, nextFilters = filters) => {
    setLoading(true);
    try {
      const response = await getClientes({
        ...nextFilters,
        limit: PAGE_SIZE,
        offset: Math.max(page, 0) * PAGE_SIZE,
      });
      setClientes(response.data.items);
      setPagination(response.data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar clientes';
      setAlert({
        type: 'error',
        message: message.includes('ruta solicitada no existe')
          ? 'No se pudo llegar a la API de clientes desde esta version publicada. Recarga la pagina e intenta de nuevo.'
          : message,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const visibleCities = useMemo(() => {
    const cities = new Set(clientes.map((cliente) => cliente.ciudad).filter(Boolean));
    return Array.from(cities).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [clientes]);

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadPage(0, filters);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      const payload = toPayload(form);
      if (editing) {
        await updateCliente(editing.id, payload);
        setAlert({ type: 'success', message: 'Cliente actualizado con historial guardado.' });
      } else {
        await createCliente(payload);
        setAlert({ type: 'success', message: 'Cliente creado correctamente.' });
      }
      setForm(emptyForm);
      setEditing(null);
      setShowEditor(false);
      await loadPage(currentPage);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al guardar cliente' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkImport = async () => {
    try {
      const items = parseBulkText(bulkText);
      if (items.length === 0) {
        setAlert({ type: 'warning', message: 'Pega filas o JSON para importar.' });
        return;
      }
      setSubmitting(true);
      const response = await importClientes(items, 'frontend_bulk_import');
      setBulkText('');
      setAlert({ type: 'success', message: `Importados ${response.data.count} clientes: ${response.data.created.length} nuevos y ${response.data.updated.length} actualizados.` });
      await loadPage(0);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo importar la carga masiva' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xls') => {
    try {
      setExporting(format);
      const blob = await downloadClientesExport(format);
      downloadBlob(`clientes.${format}`, blob);
      setAlert({ type: 'success', message: `Base de clientes descargada en ${format.toUpperCase()}.` });
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo descargar la base' });
    } finally {
      setExporting(null);
    }
  };

  const handleQualityReview = async () => {
    try {
      setQualityRunning(true);
      const response = await runClientesQualityReview();
      setAlert({
        type: 'success',
        message: `Revision lista: ${response.data.reviewed} clientes revisados, ${response.data.resolvedCities} IPs con ciudad.`,
      });
      await loadPage(currentPage);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo revisar calidad/IPs' });
    } finally {
      setQualityRunning(false);
    }
  };

  const openHistory = async (cliente: ClienteRecord) => {
    try {
      setHistoryCliente(cliente);
      setHistoryLoading(true);
      const response = await getClienteHistory(cliente.id);
      setHistoryItems(response.data);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo cargar historial' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const openEdit = (cliente: ClienteRecord) => {
    setEditing(cliente);
    setForm(formFromCliente(cliente));
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFilters = () => {
    const nextFilters = { q: '', ciudad: '', estado: '' };
    setFilters(nextFilters);
    void loadPage(0, nextFilters);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Base viva oficial con normalizacion, busqueda, exportacion e historial de cambios.</p>
        </div>
        <div className="clientes-actions">
          <button className="btn btn-secondary" type="button" onClick={() => void handleExport('csv')} disabled={Boolean(exporting)}>
            {exporting === 'csv' ? 'Descargando...' : 'CSV'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => void handleExport('xls')} disabled={Boolean(exporting)}>
            {exporting === 'xls' ? 'Descargando...' : 'Excel'}
          </button>
        </div>
      </div>

      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <section className="card clientes-search">
        <form className="clientes-filter-grid" onSubmit={handleFilterSubmit}>
          <label className="field-group field-group--wide"><span className="label">Buscar</span><input className="input" value={String(filters.q || '')} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Nombre, DNI, telefono, correo, IP o player ID" /></label>
          <label className="field-group"><span className="label">Ciudad</span><input className="input" list="clientes-cities" value={String(filters.ciudad || '')} onChange={(event) => setFilters((current) => ({ ...current, ciudad: event.target.value }))} /></label>
          <datalist id="clientes-cities">{visibleCities.map((city) => <option key={city} value={city} />)}</datalist>
          <label className="field-group"><span className="label">Estado</span><select className="select" value={String(filters.estado || '')} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}><option value="">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <div className="clientes-filter-actions">
            <button className="btn btn-primary" type="submit">Buscar</button>
            <button className="btn btn-secondary" type="button" onClick={resetFilters} disabled={!hasFilters}>Limpiar</button>
          </div>
        </form>
      </section>

      {isAdmin && (
        <section className="card clientes-admin-actions">
          <div>
            <h2 className="balance-section-title">Gestion de clientes</h2>
            <p className="page-subtitle">Crea clientes puntuales, revisa calidad o importa actualizaciones de la base oficial.</p>
          </div>
          <div className="clientes-admin-buttons">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void handleQualityReview()}
              disabled={qualityRunning}
            >
              {qualityRunning ? 'Revisando...' : 'Revisar calidad/IPs'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setShowEditor((current) => !current);
              }}
            >
              {showEditor && !editing ? 'Ocultar formulario' : 'Nuevo cliente'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowBulkImport((current) => !current)}
            >
              {showBulkImport ? 'Ocultar carga' : 'Carga masiva'}
            </button>
          </div>
        </section>
      )}

      {isAdmin && showEditor && (
        <section className="card clientes-editor">
          <div className="section-heading">
            <div>
              <h2 className="balance-section-title">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <p className="page-subtitle">Telefonos, correos e IPs se separan con punto y coma.</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => { setEditing(null); setForm(emptyForm); setShowEditor(false); }}>{editing ? 'Cancelar edicion' : 'Cerrar'}</button>
          </div>

          <form className="clientes-form" onSubmit={handleSave}>
            <label className="field-group"><span className="label">Nombre</span><input className="input" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} /></label>
            <label className="field-group"><span className="label">Player ID</span><input className="input" value={form.player_id} onChange={(event) => setForm((current) => ({ ...current, player_id: event.target.value }))} /></label>
            <label className="field-group"><span className="label">DNI</span><input className="input" value={form.dni} onChange={(event) => setForm((current) => ({ ...current, dni: event.target.value }))} /></label>
            <label className="field-group"><span className="label">Ciudad</span><input className="input" value={form.ciudad} onChange={(event) => setForm((current) => ({ ...current, ciudad: event.target.value }))} /></label>
            <label className="field-group field-group--wide"><span className="label">Correos</span><input className="input" value={form.correos} onChange={(event) => setForm((current) => ({ ...current, correos: event.target.value }))} /></label>
            <label className="field-group field-group--wide"><span className="label">Telefonos</span><input className="input" value={form.telefonos} onChange={(event) => setForm((current) => ({ ...current, telefonos: event.target.value }))} /></label>
            <label className="field-group field-group--wide"><span className="label">IPs</span><input className="input" value={form.ips} onChange={(event) => setForm((current) => ({ ...current, ips: event.target.value }))} /></label>
            <label className="field-group"><span className="label">Usuario Apueston</span><input className="input" value={form.usuario_apueston} onChange={(event) => setForm((current) => ({ ...current, usuario_apueston: event.target.value }))} /></label>
            <label className="field-group"><span className="label">ID Apueston</span><input className="input" value={form.id_apueston} onChange={(event) => setForm((current) => ({ ...current, id_apueston: event.target.value }))} /></label>
            <label className="field-group"><span className="label">Clave Apueston</span><input className="input" value={form.clave_apueston} onChange={(event) => setForm((current) => ({ ...current, clave_apueston: event.target.value }))} /></label>
            <label className="field-group field-group--wide"><span className="label">Link auth Apueston</span><input className="input" value={form.link_auth_apueston} onChange={(event) => setForm((current) => ({ ...current, link_auth_apueston: event.target.value }))} /></label>
            <div className="clientes-form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </section>
      )}

      {isAdmin && showBulkImport && (
        <section className="card clientes-import">
          <div className="section-heading">
            <div>
              <h2 className="balance-section-title">Carga masiva</h2>
              <p className="page-subtitle">Acepta JSON o filas con encabezados separados por punto y coma.</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => void handleBulkImport()} disabled={submitting || !bulkText.trim()}>Importar</button>
          </div>
          <textarea
            className="input clientes-import-textarea"
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder="Nombre;player_id;DNI;Telefono_1;Correo_1;IP;Ciudad"
          />
        </section>
      )}

      <section className="clientes-table-section">
        <div className="section-heading">
          <div>
            <h2 className="balance-section-title">Base oficial</h2>
            <p className="page-subtitle">{pagination.total} registros encontrados.</p>
          </div>
        </div>

        {loading ? (
          <TableSkeleton columns={8} rows={5} />
        ) : clientes.length === 0 ? (
          <div className="empty-state card"><p>No hay clientes que coincidan con la busqueda.</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Player ID</th>
                  <th>DNI</th>
                  <th>Telefono</th>
                  <th>Correo</th>
                  <th>IP / Ciudad</th>
                  <th>Calidad</th>
                  <th>Accesos</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => {
                  const apueston = (cliente.accesos?.apueston || {}) as Record<string, string>;
                  return (
                    <tr key={cliente.id}>
                      <td><strong>{cliente.nombre || 'Sin nombre'}</strong><div className="text-muted">{cliente.id}</div></td>
                      <td>{cliente.player_id || <span className="text-muted">-</span>}</td>
                      <td>{cliente.dni || <span className="text-muted">-</span>}</td>
                      <td>{cliente.telefonos?.[0] || <span className="text-muted">-</span>}</td>
                      <td>{cliente.correos?.[0] || <span className="text-muted">-</span>}</td>
                      <td><strong>{cliente.ips?.[0] || '-'}</strong><div className="text-muted">{cliente.ciudad_ip || cliente.ciudad || cliente.ip_city_status || '-'}</div></td>
                      <td>
                        <span className={`badge quality-${cliente.calidad?.status || 'pending'}`}>
                          {qualityLabel(cliente.calidad?.status)}
                        </span>
                        <div className="text-muted">{cliente.calidad?.score ?? '-'}/100</div>
                      </td>
                      <td>{apueston.usuario ? <span className="badge badge-blue">{apueston.usuario}</span> : <span className="text-muted">-</span>}</td>
                      {isAdmin && (
                        <td className="text-right clientes-row-actions">
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void openHistory(cliente)}>Historial</button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => openEdit(cliente)}>Editar</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.total > 0 && (
          <PaginationControls
            pagination={pagination}
            loading={loading}
            onPrevious={() => void loadPage(currentPage - 1)}
            onNext={() => void loadPage(currentPage + 1)}
          />
        )}
      </section>

      {historyCliente && (
        <section className="card clientes-history">
          <div className="section-heading">
            <div>
              <h2 className="balance-section-title">Historial de {historyCliente.nombre || historyCliente.id}</h2>
              <p className="page-subtitle">Cambios guardados con usuario, fecha, origen y antes/despues.</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => { setHistoryCliente(null); setHistoryItems([]); }}>Cerrar</button>
          </div>
          {historyLoading ? (
            <p className="text-muted">Cargando historial...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-muted">No hay historial para este cliente.</p>
          ) : (
            <div className="clientes-history-list">
              {historyItems.map((item) => {
                const changes = diffHistory(item.before, item.after);
                return (
                  <article className="clientes-history-item" key={item.id}>
                    <div className="clientes-history-meta">
                      <strong>{item.action}</strong>
                      <span>{item.timestamp}</span>
                      <span>{item.user}</span>
                      <span>{item.source}</span>
                    </div>
                    {changes.length === 0 ? (
                      <p className="text-muted">Sin diferencias visibles en campos principales.</p>
                    ) : (
                      <div className="clientes-history-diff">
                        {changes.slice(0, 12).map((change) => (
                          <div className="clientes-history-change" key={`${item.id}-${change.key}`}>
                            <span className="label">{change.label}</span>
                            <span className="history-before">{change.before}</span>
                            <span className="history-after">{change.after}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
