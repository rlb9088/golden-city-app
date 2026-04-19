'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  addTableRow,
  changeAgentPassword,
  getConfig,
  getTableData,
  importTableBatch,
  removeTableRow,
  updateTableRow,
  type ConfigAgent,
} from '@/lib/api';
import AlertBanner from '@/components/AlertBanner';
import TableSkeleton from '@/components/TableSkeleton';
import './configuracion.css';

const TABS = [
  { id: 'agentes', label: '👤 Agentes' },
  { id: 'categorias', label: '🏷️ Categorías Gastos' },
  { id: 'bancos', label: '🏦 Bancos' },
  { id: 'cajas', label: '💰 Cajas' },
  { id: 'tipos_pago', label: '💳 Tipos de Pago' },
  { id: 'usuarios', label: '🎮 Usuarios (Jugadores)' },
] as const;

const EDIT_FIELDS = {
  categorias: [
    { key: 'categoria', label: 'Categoría Principal', placeholder: 'Ej: Operativo' },
    { key: 'subcategoria', label: 'Subcategoría (Opcional)', placeholder: 'Ej: Limpieza' },
  ],
  bancos: [
    { key: 'nombre', label: 'Nombre del Banco/Wallet', placeholder: 'Ej: Yape' },
    { key: 'propietario_id', label: 'Propietario / Agente', placeholder: 'Selecciona un agente' },
  ],
  cajas: [
    { key: 'nombre', label: 'Nombre de la Caja', placeholder: 'Ej: Caja Principal' },
  ],
  tipos_pago: [
    { key: 'nombre', label: 'Nombre del Tipo de Pago', placeholder: 'Ej: Transferencia' },
  ],
  usuarios: [
    { key: 'nombre', label: 'Nombre de Jugador', placeholder: 'Ej: Juan Perez' },
  ],
} as const;

type TabKey = (typeof TABS)[number]['id'];
type ConfigRow = Record<string, string | boolean | undefined> & { id: string };

function normalizeLookup(value: string | number | boolean | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function toBoolString(value: boolean) {
  return value ? 'true' : 'false';
}

function isAgentRow(row: ConfigRow): row is ConfigRow & ConfigAgent {
  return typeof row.username === 'string' && typeof row.role === 'string' && typeof row.activo === 'boolean';
}

function resolveAgenteNombre(agentes: ConfigAgent[], propietarioId: string) {
  const lookup = normalizeLookup(propietarioId);
  const match = agentes.find((agente) => normalizeLookup(agente.id) === lookup || normalizeLookup(agente.nombre) === lookup);
  return match?.nombre || 'Agente no encontrado';
}

function resolveBancoPropietarioLabel(agentes: ConfigAgent[], row: ConfigRow) {
  const ownerValue = String(row.propietario_id || row.propietario || '');
  const resolved = resolveAgenteNombre(agentes, ownerValue);
  return resolved !== 'Agente no encontrado' ? resolved : String(row.propietario || resolved);
}

export default function ConfiguracionPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('agentes');
  const [data, setData] = useState<ConfigRow[]>([]);
  const [agentes, setAgentes] = useState<ConfigAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingRow, setEditingRow] = useState<ConfigRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [passwordTarget, setPasswordTarget] = useState<ConfigAgent | null>(null);
  const [passwordValue, setPasswordValue] = useState('');

  const [newAgenteNombre, setNewAgenteNombre] = useState('');
  const [newAgenteUsername, setNewAgenteUsername] = useState('');
  const [newAgentePassword, setNewAgentePassword] = useState('');
  const [newAgenteRole, setNewAgenteRole] = useState<'admin' | 'agent'>('agent');
  const [newAgenteActivo, setNewAgenteActivo] = useState(true);
  const [newCat, setNewCat] = useState('');
  const [newSubcat, setNewSubcat] = useState('');
  const [newBanco, setNewBanco] = useState('');
  const [newPropietarioId, setNewPropietarioId] = useState('');
  const [newCaja, setNewCaja] = useState('');
  const [newTipoPago, setNewTipoPago] = useState('');
  const [csvText, setCsvText] = useState('');

  const editFields = activeTab === 'agentes' ? [] : (EDIT_FIELDS[activeTab as Exclude<TabKey, 'agentes'>] ?? []);

  const refreshAgentes = useCallback(async () => {
    const config = await getConfig();
    const agentesFull = (config.agentes_full ?? []) as ConfigAgent[];
    setAgentes(agentesFull);
    setNewPropietarioId((current) => current || agentesFull[0]?.id || '');
    return agentesFull;
  }, []);

  const loadTabData = useCallback(async (tabName: TabKey) => {
    setLoading(true);
    try {
      const res = await getTableData(tabName);
      setData(res.data as ConfigRow[]);
      if (tabName === 'agentes') {
        await refreshAgentes();
      }
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  }, [refreshAgentes]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadTabData(activeTab);
    setAlert(null);
  }, [activeTab, isAdmin, loadTabData]);

  useEffect(() => {
    if (!isAdmin) return;

    let alive = true;
    void (async () => {
      try {
        await refreshAgentes();
      } catch (err) {
        if (alive) {
          setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar agentes' });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAdmin, refreshAgentes]);

  const isDuplicateAgenteUsername = useCallback((username: string, ignoreId?: string) => {
    const needle = normalizeLookup(username);
    return agentes.some((agente) => agente.id !== ignoreId && normalizeLookup(agente.username) === needle);
  }, [agentes]);

  const openEditModal = useCallback((row: ConfigRow) => {
    setEditingRow(row);
    if (activeTab === 'agentes' && isAgentRow(row)) {
      setEditForm({
        id: row.id,
        nombre: String(row.nombre ?? ''),
        username: String(row.username ?? ''),
        role: String(row.role ?? 'agent'),
        activo: toBoolString(Boolean(row.activo)),
      });
      return;
    }

    const fields = EDIT_FIELDS[activeTab as Exclude<TabKey, 'agentes'>] ?? [];
    setEditForm(
      fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = String(row[field.key] ?? '');
        return acc;
      }, { id: row.id }),
    );
  }, [activeTab]);

  const closeEditModal = useCallback(() => {
    setEditingRow(null);
    setEditForm({});
  }, []);

  const openPasswordModal = useCallback((row: ConfigAgent) => {
    setPasswordTarget(row);
    setPasswordValue('');
  }, []);

  const closePasswordModal = useCallback(() => {
    setPasswordTarget(null);
    setPasswordValue('');
  }, []);

  const resetAgentForm = useCallback(() => {
    setNewAgenteNombre('');
    setNewAgenteUsername('');
    setNewAgentePassword('');
    setNewAgenteRole('agent');
    setNewAgenteActivo(true);
  }, []);

  const handleAddAgent = useCallback(async () => {
    const nombre = newAgenteNombre.trim();
    const username = newAgenteUsername.trim().toLowerCase();
    const password = newAgentePassword.trim();

    if (!nombre || !username || !password) {
      setAlert({ type: 'error', message: 'Completa nombre, username y contrasena.' });
      return;
    }

    if (isDuplicateAgenteUsername(username)) {
      setAlert({ type: 'error', message: 'El username ya existe. Elige uno unico.' });
      return;
    }

    try {
      setSubmitting(true);
      await addTableRow('agentes', {
        nombre,
        username,
        password,
        role: newAgenteRole,
        activo: newAgenteActivo,
      });
      setAlert({ type: 'success', message: 'Agente creado correctamente' });
      resetAgentForm();
      await refreshAgentes();
      await loadTabData('agentes');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al crear agente' });
    } finally {
      setSubmitting(false);
    }
  }, [
    isDuplicateAgenteUsername,
    loadTabData,
    newAgenteActivo,
    newAgenteNombre,
    newAgentePassword,
    newAgenteRole,
    newAgenteUsername,
    refreshAgentes,
    resetAgentForm,
  ]);

  const handleAddGeneric = async (payload: Record<string, string | boolean>) => {
    try {
      setSubmitting(true);
      await addTableRow(activeTab, payload);
      setAlert({ type: 'success', message: 'Registro añadido correctamente' });
      if (activeTab === 'agentes') {
        await refreshAgentes();
      }
      await loadTabData(activeTab);
      setNewCat('');
      setNewSubcat('');
      setNewBanco('');
      setNewPropietarioId(agentes[0]?.id || '');
      setNewCaja('');
      setNewTipoPago('');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al añadir' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      setActionLoading(id);
      await removeTableRow(activeTab, id);
      setData((current) => current.filter((row) => row.id !== id));
      if (activeTab === 'agentes') {
        await refreshAgentes();
      }
      setAlert({ type: 'success', message: 'Registro eliminado' });
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al eliminar' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAgentActive = async (row: ConfigAgent) => {
    try {
      setActionLoading(row.id);
      await updateTableRow('agentes', row.id, { activo: !row.activo });
      setAlert({ type: 'success', message: row.activo ? 'Agente desactivado' : 'Agente activado' });
      await refreshAgentes();
      await loadTabData('agentes');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo cambiar el estado del agente' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRow) return;

    try {
      setActionLoading(editingRow.id);
      if (activeTab === 'agentes') {
        const nombre = String(editForm.nombre ?? '').trim();
        const username = String(editForm.username ?? '').trim().toLowerCase();
        const role = String(editForm.role ?? '').trim().toLowerCase();

        if (!nombre || !username || !role) {
          setAlert({ type: 'error', message: 'Completa nombre, username y rol.' });
          return;
        }

        if (role !== 'admin' && role !== 'agent') {
          setAlert({ type: 'error', message: 'El rol debe ser admin o agent.' });
          return;
        }

        if (isDuplicateAgenteUsername(username, editingRow.id)) {
          setAlert({ type: 'error', message: 'El username ya existe. Elige uno unico.' });
          return;
        }

        await updateTableRow('agentes', editingRow.id, {
          nombre,
          username,
          role,
          activo: editForm.activo === 'true',
        });
        setAlert({ type: 'success', message: 'Agente actualizado correctamente' });
        await refreshAgentes();
        closeEditModal();
        await loadTabData('agentes');
        return;
      }

      const payload = editFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = (editForm[field.key] ?? '').trim();
        return acc;
      }, {});

      await updateTableRow(activeTab, editingRow.id, payload);
      setAlert({ type: 'success', message: 'Registro actualizado correctamente' });
      closeEditModal();
      await loadTabData(activeTab);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al actualizar' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordTarget) return;

    if (!passwordValue.trim()) {
      setAlert({ type: 'error', message: 'Ingresa una nueva contrasena.' });
      return;
    }

    try {
      setActionLoading(passwordTarget.id);
      await changeAgentPassword(passwordTarget.id, passwordValue.trim());
      setAlert({ type: 'success', message: 'Contrasena actualizada correctamente' });
      closePasswordModal();
      await refreshAgentes();
      await loadTabData('agentes');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar la contrasena' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportCSV = async () => {
    if (!csvText.trim()) return;
    const names = csvText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    if (names.length === 0) return;

    try {
      setSubmitting(true);
      const items = names.map((name) => ({ nombre: name }));
      await importTableBatch('usuarios', items);
      setAlert({ type: 'success', message: `Se importaron ${items.length} usuarios` });
      setCsvText('');
      await loadTabData('usuarios');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al importar' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentTabLabel = TABS.find((tab) => tab.id === activeTab)?.label;

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" id="config-page">
        <div className="page-header"><h1 className="page-title">⚙️ Configuración Admin</h1></div>
        <AlertBanner type="error" message="Acceso denegado. Solo administradores pueden ver esta página." autoDismiss={0} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="config-page">
      {alert && <AlertBanner type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Configuración del Sistema</h1>
          <p className="page-subtitle">Administra las listas desplegables y las identidades del sistema</p>
        </div>
      </div>

      <div className="tabs-header">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="config-section card">
        <div className="config-section-header">
          <h2 className="config-section-title">{currentTabLabel}</h2>
          <span className="badge badge-gold">{data.length} registros</span>
        </div>

        {activeTab === 'agentes' && (
          <>
            <form
              className="add-row-form add-row-form--agents"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddAgent();
              }}
            >
              <div className="field-group">
                <label className="label">Nombre</label>
                <input className="input" value={newAgenteNombre} onChange={(event) => setNewAgenteNombre(event.target.value)} placeholder="Ej: Agente Principal" required />
              </div>
              <div className="field-group">
                <label className="label">Username</label>
                <input className="input" value={newAgenteUsername} onChange={(event) => setNewAgenteUsername(event.target.value.toLowerCase())} placeholder="ej: agente.principal" autoComplete="off" required />
              </div>
              <div className="field-group">
                <label className="label">Contraseña</label>
                <input className="input" type="password" value={newAgentePassword} onChange={(event) => setNewAgentePassword(event.target.value)} placeholder="Minimo 1 caracter" required />
              </div>
              <div className="field-group">
                <label className="label">Rol</label>
                <select className="select" value={newAgenteRole} onChange={(event) => setNewAgenteRole(event.target.value as 'admin' | 'agent')}>
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <label className="field-group toggle-field">
                <span className="label">Activo</span>
                <button type="button" className={`toggle-pill ${newAgenteActivo ? 'toggle-pill--on' : ''}`} onClick={() => setNewAgenteActivo((current) => !current)}>
                  {newAgenteActivo ? 'Activo' : 'Inactivo'}
                </button>
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table
              data={data}
              columns={[
                { key: 'nombre', label: 'Nombre' },
                { key: 'username', label: 'Username' },
                { key: 'role', label: 'Rol' },
                { key: 'activo', label: 'Estado' },
              ]}
              loading={loading}
              onEdit={openEditModal}
              onDelete={handleDelete}
              renderCell={(row, column) => {
                if (column.key === 'role') {
                  const role = String(row.role || '');
                  return <span className={`badge ${role === 'admin' ? 'badge-gold' : 'badge-blue'}`}>{role.toUpperCase()}</span>;
                }

                if (column.key === 'activo') {
                  const active = Boolean(row.activo);
                  return <span className={`badge ${active ? 'badge-green' : 'badge-red'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
                }

                return <strong>{String(row[column.key] ?? '')}</strong>;
              }}
              renderActions={(row) => {
                if (!isAgentRow(row)) return null;

                return (
                  <div className="row-actions row-actions--agents">
                    <button type="button" className="btn-icon btn-icon--edit" onClick={() => openEditModal(row)} title="Editar" aria-label={`Editar ${row.id}`}>✏️</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openPasswordModal(row)} disabled={Boolean(actionLoading)}>Contraseña</button>
                    <button type="button" className={`btn btn-sm ${row.activo ? 'btn-secondary' : 'btn-primary'}`} onClick={() => void handleToggleAgentActive(row)} disabled={Boolean(actionLoading)}>
                      {row.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className="btn-icon" onClick={() => void handleDelete(row.id)} title="Eliminar" aria-label={`Eliminar ${row.id}`}>🗑️</button>
                  </div>
                );
              }}
            />
          </>
        )}

        {activeTab === 'categorias' && (
          <>
            <form className="add-row-form" onSubmit={(event) => { event.preventDefault(); if (newCat) void handleAddGeneric({ categoria: newCat, subcategoria: newSubcat }); }}>
              <div className="field-group">
                <label className="label">Categoría Principal</label>
                <input className="input" value={newCat} onChange={(event) => setNewCat(event.target.value)} required placeholder="Ej: Operativo" />
              </div>
              <div className="field-group">
                <label className="label">Subcategoría (Opcional)</label>
                <input className="input" value={newSubcat} onChange={(event) => setNewSubcat(event.target.value)} placeholder="Ej: Limpieza" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'categoria', label: 'Categoría' }, { key: 'subcategoria', label: 'Subcategoría' }]} onEdit={openEditModal} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {activeTab === 'bancos' && (
          <>
            <form className="add-row-form" onSubmit={(event) => { event.preventDefault(); if (newBanco && newPropietarioId) void handleAddGeneric({ nombre: newBanco, propietario_id: newPropietarioId }); }}>
              <div className="field-group">
                <label className="label">Nombre del Banco/Wallet</label>
                <input className="input" value={newBanco} onChange={(event) => setNewBanco(event.target.value)} required placeholder="Ej: Yape" />
              </div>
              <div className="field-group">
                <label className="label">Propietario / Agente</label>
                <select className="select" value={newPropietarioId} onChange={(event) => setNewPropietarioId(event.target.value)} required>
                  <option value="" disabled>Selecciona un agente</option>
                  {agentes.map((agente) => <option key={agente.id} value={agente.id}>{agente.nombre}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Banco' }, { key: 'propietario_id', label: 'Asignado a' }]} onEdit={openEditModal} onDelete={handleDelete} loading={loading} renderCell={(row, column) => {
              if (column.key === 'propietario_id') {
                return <strong>{resolveBancoPropietarioLabel(agentes, row)}</strong>;
              }
              return <strong>{String(row[column.key] ?? '')}</strong>;
            }} />
          </>
        )}

        {activeTab === 'cajas' && (
          <>
            <form className="add-row-form" onSubmit={(event) => { event.preventDefault(); if (newCaja) void handleAddGeneric({ nombre: newCaja }); }}>
              <div className="field-group">
                <label className="label">Nombre de la Caja</label>
                <input className="input" value={newCaja} onChange={(event) => setNewCaja(event.target.value)} required placeholder="Ej: Caja Principal" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre' }]} onEdit={openEditModal} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {activeTab === 'tipos_pago' && (
          <>
            <form className="add-row-form" onSubmit={(event) => { event.preventDefault(); if (newTipoPago) void handleAddGeneric({ nombre: newTipoPago }); }}>
              <div className="field-group">
                <label className="label">Nombre del Tipo de Pago</label>
                <input className="input" value={newTipoPago} onChange={(event) => setNewTipoPago(event.target.value)} required placeholder="Ej: Transferencia" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre' }]} onEdit={openEditModal} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {activeTab === 'usuarios' && (
          <>
            <div className="csv-import-area add-row-form csv-import-area--compact">
              <label className="label">Importación Masiva de Jugadores</label>
              <textarea className="input csv-textarea" placeholder="Pega la lista de nombres aquí, uno por línea..." value={csvText} onChange={(event) => setCsvText(event.target.value)} />
              <button className="btn btn-primary" type="button" onClick={() => void handleImportCSV()} disabled={submitting || loading || !csvText.trim()}>📥 Importar Nombres</button>
            </div>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Los siguientes usuarios estarán disponibles para autocompletado en el formulario de Pagos.</p>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre de Jugador' }]} onEdit={openEditModal} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {loading && <TableSkeleton columns={2} rows={4} className="mt-lg" />}
      </div>

      {editingRow && (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="config-edit-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="config-edit-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>Editar registro</h3>
                <p className="page-subtitle" style={{ margin: 0 }}>Cambia los campos necesarios y conserva el historial de auditoría.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeEditModal}>Cerrar</button>
            </div>

            <form className="modal-form" onSubmit={handleEditSubmit}>
              {activeTab === 'agentes' ? (
                <div className="modal-grid">
                  <label className="field-group"><span className="label">Nombre</span><input className="input" value={editForm.nombre ?? ''} onChange={(event) => setEditForm((current) => ({ ...current, nombre: event.target.value }))} required /></label>
                  <label className="field-group"><span className="label">Username</span><input className="input" value={editForm.username ?? ''} onChange={(event) => setEditForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))} required /></label>
                  <label className="field-group"><span className="label">Rol</span><select className="select" value={editForm.role ?? 'agent'} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))} required><option value="admin">Admin</option><option value="agent">Agent</option></select></label>
                  <label className="field-group"><span className="label">Estado</span><button type="button" className={`toggle-pill ${editForm.activo === 'true' ? 'toggle-pill--on' : ''}`} onClick={() => setEditForm((current) => ({ ...current, activo: current.activo === 'true' ? 'false' : 'true' }))}>{editForm.activo === 'true' ? 'Activo' : 'Inactivo'}</button></label>
                </div>
              ) : (
                <div className="modal-grid">
                  {editFields.map((field) => (
                    <label key={field.key} className="field-group">
                      <span className="label">{field.label}</span>
                      {activeTab === 'bancos' && field.key === 'propietario_id' ? (
                        <select className="select" value={editForm[field.key] ?? ''} onChange={(event) => setEditForm((current) => ({ ...current, [field.key]: event.target.value }))} required>
                          <option value="" disabled>Selecciona un agente</option>
                          {agentes.map((agente) => <option key={agente.id} value={agente.id}>{agente.nombre}</option>)}
                        </select>
                      ) : (
                        <input className="input" value={editForm[field.key] ?? ''} onChange={(event) => setEditForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} required={field.key !== 'subcategoria'} />
                      )}
                    </label>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(actionLoading)}>{actionLoading === editingRow.id ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordTarget && (
        <div className="modal-overlay" role="presentation" onClick={closePasswordModal}>
          <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby="agent-password-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="agent-password-title" className="balance-section-title" style={{ marginBottom: '4px', fontSize: '1rem' }}>Cambiar contraseña</h3>
                <p className="page-subtitle" style={{ margin: 0 }}>{passwordTarget.nombre} · {passwordTarget.username}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closePasswordModal}>Cerrar</button>
            </div>

            <form className="modal-form" onSubmit={handlePasswordSubmit}>
              <label className="field-group"><span className="label">Nueva contraseña</span><input className="input" type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} required /></label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closePasswordModal} disabled={Boolean(actionLoading)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={Boolean(actionLoading)}>{actionLoading === passwordTarget.id ? 'Guardando...' : 'Actualizar contraseña'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Table({
  data,
  columns,
  onEdit,
  onDelete,
  loading,
  renderCell,
  renderActions,
}: {
  data: ConfigRow[];
  columns: { key: string; label: string }[];
  onEdit: (row: ConfigRow) => void;
  onDelete: (id: string) => void;
  loading: boolean;
  renderCell?: (row: ConfigRow, column: { key: string; label: string }) => ReactNode;
  renderActions?: (row: ConfigRow) => ReactNode;
}) {
  if (loading) {
    return <TableSkeleton columns={columns.length + 1} rows={4} />;
  }

  if (data.length === 0) {
    return <div className="text-center p-4 text-muted">No hay registros</div>;
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            <th style={{ width: '50px', textAlign: 'center' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{renderCell ? renderCell(row, column) : <strong>{String(row[column.key] ?? '')}</strong>}</td>
              ))}
              <td style={{ textAlign: 'center' }}>
                {renderActions ? (
                  renderActions(row)
                ) : (
                  <div className="row-actions">
                    <button type="button" className="btn-icon btn-icon--edit" onClick={() => onEdit(row)} title="Editar" aria-label={`Editar ${row.id}`}>✏️</button>
                    <button type="button" className="btn-icon" onClick={() => onDelete(row.id)} title="Eliminar" aria-label={`Eliminar ${row.id}`}>🗑️</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
