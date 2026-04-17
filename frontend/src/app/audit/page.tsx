'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getAuditLogs, type AuditFilters, type AuditRecord } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import AlertBanner from '@/components/AlertBanner';
import PaginationControls from '@/components/PaginationControls';
import TableSkeleton from '@/components/TableSkeleton';
import './audit.css';

type AlertState = { type: 'success' | 'error' | 'warning'; message: string } | null;
const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, { label: string; badge: string }> = {
  create: { label: 'Crear', badge: 'badge-green' },
  update: { label: 'Actualizar', badge: 'badge-gold' },
  delete: { label: 'Eliminar', badge: 'badge-red' },
  warning: { label: 'Aviso', badge: 'badge-blue' },
};

function parseChanges(changes: AuditRecord['changes']) {
  if (typeof changes !== 'string') {
    return changes;
  }

  try {
    return JSON.parse(changes);
  } catch {
    return changes;
  }
}

function stringifyChanges(changes: AuditRecord['changes']) {
  const parsed = parseChanges(changes);

  if (typeof parsed === 'string') {
    return parsed || '-';
  }

  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return '-';
  }
}

function getChangesSummary(changes: AuditRecord['changes']) {
  const parsed = parseChanges(changes);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return `${Object.keys(parsed).length} campo(s)`;
  }

  return 'Texto libre';
}

function getActionBadge(action: string) {
  return ACTION_LABELS[action.toLowerCase()] || { label: action, badge: 'badge-blue' };
}

function defaultFilters(): AuditFilters {
  return {
    entity: '',
    action: '',
    user: '',
    desde: '',
    hasta: '',
  };
}

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters());
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const loadLogs = useCallback(async (nextFilters: AuditFilters = defaultFilters(), page = 0) => {
    try {
      setLoading(true);
      const response = await getAuditLogs({
        ...nextFilters,
        limit: PAGE_SIZE,
        offset: Math.max(page, 0) * PAGE_SIZE,
      });
      setLogs(response.data.items);
      setPagination(response.data.pagination);
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Error al cargar auditoria' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadLogs();
    }
  }, [isAdmin, loadLogs]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setAlert(null);
      await loadLogs(filters, 0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    const reset = defaultFilters();
    setFilters(reset);
    await loadLogs(reset, 0);
  };

  const handlePreviousPage = useCallback(() => {
    if (pagination.offset === 0 || loading) {
      return;
    }

    void loadLogs(filters, Math.floor(pagination.offset / pagination.limit) - 1);
  }, [filters, loadLogs, loading, pagination.limit, pagination.offset]);

  const handleNextPage = useCallback(() => {
    if (!pagination.hasMore || loading) {
      return;
    }

    void loadLogs(filters, Math.floor(pagination.offset / pagination.limit) + 1);
  }, [filters, loadLogs, loading, pagination.hasMore, pagination.limit, pagination.offset]);

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="audit-page">
        <div className="page-header">
          <h1 className="page-title">Auditoria</h1>
        </div>
        <AlertBanner type="warning" message="Solo los administradores pueden ver el log de auditoria." autoDismiss={0} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in" id="audit-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Auditoria</h1>
            <p className="page-subtitle">Cargando registros...</p>
          </div>
        </div>
        <div className="card audit-filters-skeleton">
          <div className="audit-filter-grid">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="skeleton-field">
                <span className="skeleton-line skeleton-label" />
                <span className="skeleton-line skeleton-input" />
              </div>
            ))}
          </div>
          <div className="audit-actions-skeleton">
            <div className="skeleton-card" style={{ width: '140px', height: '44px' }} />
            <div className="skeleton-card" style={{ width: '140px', height: '44px' }} />
          </div>
        </div>
        <div className="mt-lg">
          <TableSkeleton columns={5} rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="audit-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">Consulta la trazabilidad de cambios y validaciones del sistema</p>
        </div>
        <div className="audit-header-meta">
          <span className="badge badge-gold">{logs.length} de {pagination.total} registros</span>
          <button className="btn btn-secondary" onClick={() => void loadLogs(filters)} disabled={submitting}>
            Refrescar
          </button>
        </div>
      </div>

      <form className="card audit-filters" onSubmit={handleSubmit}>
        <div className="audit-filter-grid">
          <div className="field-group">
            <label className="label" htmlFor="audit-entity">Entidad</label>
            <input
              id="audit-entity"
              className="input"
              value={filters.entity ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, entity: event.target.value }))}
              placeholder="pago, gasto, config_bancos..."
            />
          </div>

          <div className="field-group">
            <label className="label" htmlFor="audit-action">Accion</label>
            <select
              id="audit-action"
              className="select"
              value={filters.action ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
            >
              <option value="">Todas</option>
              <option value="create">Crear</option>
              <option value="update">Actualizar</option>
              <option value="delete">Eliminar</option>
              <option value="warning">Aviso</option>
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="audit-user">Usuario</label>
            <input
              id="audit-user"
              className="input"
              value={filters.user ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))}
              placeholder="Nombre de usuario"
            />
          </div>

          <div className="field-group">
            <label className="label" htmlFor="audit-desde">Desde</label>
            <input
              id="audit-desde"
              className="input"
              type="date"
              value={filters.desde ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, desde: event.target.value }))}
            />
          </div>

          <div className="field-group">
            <label className="label" htmlFor="audit-hasta">Hasta</label>
            <input
              id="audit-hasta"
              className="input"
              type="date"
              value={filters.hasta ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, hasta: event.target.value }))}
            />
          </div>
        </div>

        <div className="audit-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Filtrando...' : 'Aplicar filtros'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => void handleReset()} disabled={submitting}>
            Limpiar
          </button>
        </div>
      </form>

      <div className="mt-lg">
        {logs.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">🧾</div>
            <p>No hay registros de auditoria para estos filtros</p>
          </div>
        ) : (
          <div className="table-container audit-table-container">
            <table className="table" id="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>Usuario</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionMeta = getActionBadge(log.action);
                  return (
                    <tr key={log.id}>
                      <td>
                        <strong>{formatDateTime(log.timestamp)}</strong>
                      </td>
                      <td>
                        <span className={`badge ${actionMeta.badge}`}>{actionMeta.label}</span>
                      </td>
                      <td>
                        <span className="badge badge-blue">{log.entity}</span>
                      </td>
                      <td>
                        <strong>{log.user}</strong>
                      </td>
                      <td>
                        <details className="audit-details">
                          <summary className="audit-details-summary">
                            <span>Ver JSON</span>
                            <span className="audit-details-count">{getChangesSummary(log.changes)}</span>
                          </summary>
                          <pre className="audit-json">{stringifyChanges(log.changes)}</pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pagination.total > 0 && (
          <PaginationControls
            pagination={pagination}
            loading={loading || submitting}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
          />
        )}
      </div>
    </div>
  );
}
