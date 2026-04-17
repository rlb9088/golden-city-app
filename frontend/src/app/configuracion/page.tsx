'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getTableData, addTableRow, removeTableRow, importTableBatch } from '@/lib/api';
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
];

export default function ConfiguracionPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('agentes');
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states per tab
  const [newAgente, setNewAgente] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newSubcat, setNewSubcat] = useState('');
  const [newBanco, setNewBanco] = useState('');
  const [newPropietario, setNewPropietario] = useState('Negocio');
  const [newCaja, setNewCaja] = useState('');
  const [newTipoPago, setNewTipoPago] = useState('');
  const [csvText, setCsvText] = useState('');

  const loadTabData = useCallback(async (tabName: string) => {
    try {
      setLoading(true);
      const res = await getTableData(tabName);
      setData(res.data);
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTabData(activeTab);
      setAlert(null);
    }
  }, [activeTab, isAdmin, loadTabData]);

  const handleAdd = async (payload: Record<string, string>) => {
    try {
      setSubmitting(true);
      await addTableRow(activeTab, payload);
      setAlert({ type: 'success', message: 'Registro añadido correctamente' });
      await loadTabData(activeTab);
      
      // Reset forms
      setNewAgente(''); setNewCat(''); setNewSubcat(''); setNewBanco(''); setNewCaja(''); setNewTipoPago('');
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al añadir' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      await removeTableRow(activeTab, id);
      setData(data.filter(d => d.id !== id));
      setAlert({ type: 'success', message: 'Registro eliminado' });
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Error al eliminar' });
    }
  };

  const handleImportCSV = async () => {
    if (!csvText.trim()) return;
    const names = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (names.length === 0) return;
    
    try {
      setSubmitting(true);
      const items = names.map(n => ({ nombre: n }));
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
          <p className="page-subtitle">Administra las listas desplegables del aplicativo</p>
        </div>
      </div>

      <div className="tabs-header">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="config-section card">
        <div className="config-section-header">
          <h2 className="config-section-title">
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <span className="badge badge-gold">{data.length} registros</span>
        </div>

        {/* Tab Content: Agentes */}
        {activeTab === 'agentes' && (
          <>
            <form className="add-row-form" onSubmit={(e) => { e.preventDefault(); if (newAgente) handleAdd({ nombre: newAgente }); }}>
              <div className="field-group">
                <label className="label">Nombre del Agente</label>
                <input className="input" value={newAgente} onChange={e => setNewAgente(e.target.value)} required placeholder="Ej: Agente Principal" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {/* Tab Content: Categorías */}
        {activeTab === 'categorias' && (
          <>
            <form className="add-row-form" onSubmit={(e) => { e.preventDefault(); if (newCat) handleAdd({ categoria: newCat, subcategoria: newSubcat }); }}>
              <div className="field-group">
                <label className="label">Categoría Principal</label>
                <input className="input" value={newCat} onChange={e => setNewCat(e.target.value)} required placeholder="Ej: Operativo" />
              </div>
              <div className="field-group">
                <label className="label">Subcategoría (Opcional)</label>
                <input className="input" value={newSubcat} onChange={e => setNewSubcat(e.target.value)} placeholder="Ej: Limpieza" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'categoria', label: 'Categoría' }, { key: 'subcategoria', label: 'Subcategoría' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {/* Tab Content: Bancos */}
        {activeTab === 'bancos' && (
          <>
            <form className="add-row-form" onSubmit={(e) => { e.preventDefault(); if (newBanco) handleAdd({ nombre: newBanco, propietario: newPropietario }); }}>
              <div className="field-group">
                <label className="label">Nombre del Banco/Wallet</label>
                <input className="input" value={newBanco} onChange={e => setNewBanco(e.target.value)} required placeholder="Ej: Yape" />
              </div>
              <div className="field-group">
                <label className="label">Propietario / Agrupación</label>
                <select className="select" value={newPropietario} onChange={e => setNewPropietario(e.target.value)}>
                  <option value="Negocio">Negocio (Global)</option>
                  <option value="Agente 1">Agente 1</option>
                  <option value="Agente 2">Agente 2</option>
                  <option value="Agente 3">Agente 3</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Banco' }, { key: 'propietario', label: 'Asignado a' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {/* Tab Content: Cajas */}
        {activeTab === 'cajas' && (
          <>
            <form className="add-row-form" onSubmit={(e) => { e.preventDefault(); if (newCaja) handleAdd({ nombre: newCaja }); }}>
              <div className="field-group">
                <label className="label">Nombre de la Caja</label>
                <input className="input" value={newCaja} onChange={e => setNewCaja(e.target.value)} required placeholder="Ej: Caja Principal" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {activeTab === 'tipos_pago' && (
          <>
            <form className="add-row-form" onSubmit={(e) => { e.preventDefault(); if (newTipoPago) handleAdd({ nombre: newTipoPago }); }}>
              <div className="field-group">
                <label className="label">Nombre del Tipo de Pago</label>
                <input className="input" value={newTipoPago} onChange={e => setNewTipoPago(e.target.value)} required placeholder="Ej: Transferencia" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>➕ Agregar</button>
            </form>
            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {/* Tab Content: Usuarios */}
        {activeTab === 'usuarios' && (
          <>
            <div className="csv-import-area add-row-form" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <label className="label">Importación Masiva de Jugadores (CSV / Pegar nombres)</label>
              <textarea 
                className="input csv-textarea" 
                placeholder="Pega la lista de nombres aquí, uno por línea..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                style={{ alignSelf: 'flex-end', marginTop: 'var(--space-md)' }}
                onClick={handleImportCSV} 
                disabled={submitting || loading || !csvText.trim()}
              >
                {submitting ? '⏳ Importando...' : '📥 Importar Nombres'}
              </button>
            </div>
            
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              Los siguientes usuarios estarán disponibles para autocompletado en el formulario de Pagos.
            </p>

            <Table data={data} columns={[{ key: 'nombre', label: 'Nombre de Jugador' }]} onDelete={handleDelete} loading={loading} />
          </>
        )}

        {loading && <TableSkeleton columns={2} rows={4} className="mt-lg" />}
      </div>
    </div>
  );
}

// Helper Table
function Table({ data, columns, onDelete, loading }: { data: Record<string, string>[]; columns: {key: string, label: string}[]; onDelete: (id: string) => void; loading: boolean }) {
  if (loading) {
    return <TableSkeleton columns={columns.length + 1} rows={4} />;
  }

  if (data.length === 0) return <div className="text-center p-4 text-muted">No hay registros</div>;
  
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map(c => <th key={c.key}>{c.label}</th>)}
            <th style={{ width: '50px', textAlign: 'center' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map(row => (
            <tr key={row.id}>
              {columns.map(c => <td key={c.key}><strong>{row[c.key]}</strong></td>)}
              <td style={{ textAlign: 'center' }}>
                <button className="btn-icon" onClick={() => onDelete(row.id)} title="Eliminar">🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
