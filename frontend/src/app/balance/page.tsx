'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getBalance,
  getSetting,
  type ConfigSetting,
  type BalanceAgentDetail,
  type BalanceBankDetail,
  type BalanceExpenseDetail,
  type BalanceSnapshot,
} from '@/lib/api';
import { formatCurrency, formatDate, getTodayLima } from '@/lib/format';
import StatsCard from '@/components/StatsCard';
import AlertBanner from '@/components/AlertBanner';
import TableSkeleton from '@/components/TableSkeleton';
import MiCajaView from './MiCajaView';
import './balance.css';

const CAJA_INICIO_MES_KEY = 'caja_inicio_mes';

type AgentSummary = BalanceAgentDetail & { total: number };
type ExpenseGroup = { categoria: string; total: number; detalle: BalanceExpenseDetail[] };

function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumBalances(items: BalanceBankDetail[]) {
  return items.reduce((total, item) => total + toNumber(item.saldo), 0);
}

function groupAgentDetails(detalle: BalanceSnapshot['cajasAgentes']['detalle']): AgentSummary[] {
  return detalle.map((agent) => ({
    ...agent,
    total: sumBalances(agent.bancos),
  }));
}

function groupExpenseDetails(detalle: BalanceSnapshot['totalGastos']['detalle']): ExpenseGroup[] {
  const groups = new Map<string, ExpenseGroup>();

  detalle.forEach((item) => {
    const key = item.categoria.trim() || 'Sin categoria';
    const current = groups.get(key);
    const nextItem = {
      ...item,
      categoria: key,
      subcategoria: item.subcategoria.trim() || 'General',
      monto: toNumber(item.monto),
    };

    if (current) {
      current.detalle.push(nextItem);
      current.total += nextItem.monto;
      return;
    }

    groups.set(key, {
      categoria: key,
      total: nextItem.monto,
      detalle: [nextItem],
    });
  });

  return Array.from(groups.values());
}

function getVariantByAmount(value: number) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function getKpiVariant(value: number, fallback: 'neutral' | 'positive' | 'negative' | 'gold' = 'neutral') {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return fallback;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="empty-state balance-empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
}

function AgentBreakdownTable({ agent }: { agent: AgentSummary }) {
  if (agent.bancos.length === 0) {
    return <p className="balance-details-empty">No hay bancos asociados a este agente.</p>;
  }

  return (
    <div className="table-container balance-nested-table-container">
      <table className="table balance-nested-table">
        <thead>
          <tr>
            <th>Banco</th>
            <th style={{ textAlign: 'right' }}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {agent.bancos.map((bank) => (
            <tr key={`${agent.agente}-${bank.banco_id}`}>
              <td>{bank.banco}</td>
              <td className="text-right">
                <span className={`amount ${getVariantByAmount(bank.saldo) === 'negative' ? 'amount-negative' : 'amount-positive'}`}>
                  {formatCurrency(bank.saldo)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseBreakdownTable({ group }: { group: ExpenseGroup }) {
  return (
    <div className="table-container balance-nested-table-container">
      <table className="table balance-nested-table">
        <thead>
          <tr>
            <th>Subcategoria</th>
            <th style={{ textAlign: 'right' }}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {group.detalle.map((item) => (
            <tr key={`${group.categoria}-${item.subcategoria}`}>
              <td>{item.subcategoria}</td>
              <td className="text-right">
                <span className="amount amount-negative">{formatCurrency(item.monto)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BalancePage() {
  const { isReady, isAdmin } = useAuth();
  const [balance, setBalance] = useState<BalanceSnapshot | null>(null);
  const [cajaInicioMesSetting, setCajaInicioMesSetting] = useState<ConfigSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const loadBalance = useCallback(async (fecha?: string, background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getBalance(fecha);
      setBalance(response.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar balance');
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadCajaInicioMesSetting = useCallback(async () => {
    try {
      const response = await getSetting(CAJA_INICIO_MES_KEY);
      setCajaInicioMesSetting(response.data);
    } catch {
      setCajaInicioMesSetting(null);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAdmin) {
      return;
    }

    void loadBalance();
    void loadCajaInicioMesSetting();
  }, [isAdmin, isReady, loadBalance, loadCajaInicioMesSetting]);

  const handleDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    setSelectedDate(nextDate);

    if (!isReady || !isAdmin) {
      return;
    }

    void loadBalance(nextDate || undefined, true);
  }, [isAdmin, isReady, loadBalance]);

  const handleClearDate = useCallback(() => {
    setSelectedDate('');

    if (!isReady || !isAdmin) {
      return;
    }

    void loadBalance(undefined, true);
  }, [isAdmin, isReady, loadBalance]);

  if (!isReady) {
    return (
      <div className="animate-fade-in" id="balance-page">
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Balance</h1>
            <p className="page-subtitle">Cargando snapshot financiero...</p>
          </div>
        </div>
        <div className="balance-stats stagger-children">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="stats-card skeleton-card" />
          ))}
        </div>
        <div className="balance-sections">
          <div className="balance-section balance-section--wide">
            <h2 className="balance-section-title">Balance por Agente</h2>
            <TableSkeleton columns={3} rows={4} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por Banco admin</h2>
            <TableSkeleton columns={2} rows={4} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por categoria de gasto</h2>
            <TableSkeleton columns={3} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <MiCajaView />;
  }

  if (loading && !balance) {
    return (
      <div className="animate-fade-in" id="balance-page">
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Balance</h1>
            <p className="page-subtitle">Cargando snapshot financiero...</p>
          </div>
        </div>
        <div className="balance-stats stagger-children">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="stats-card skeleton-card" />
          ))}
        </div>
        <div className="balance-sections">
          <div className="balance-section balance-section--wide">
            <h2 className="balance-section-title">Balance por Agente</h2>
            <TableSkeleton columns={3} rows={4} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por Banco admin</h2>
            <TableSkeleton columns={2} rows={4} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por categoria de gasto</h2>
            <TableSkeleton columns={3} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="animate-fade-in" id="balance-page">
        {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}
        <div className="page-header balance-page-header">
          <div>
            <h1 className="page-title">Dashboard de Balance</h1>
            <p className="page-subtitle">No fue posible cargar el snapshot financiero.</p>
          </div>
        </div>
        <AlertBanner
          type="warning"
          message="Intenta actualizar la pagina o vuelve a ejecutar el filtro de fecha."
          autoDismiss={0}
        />
      </div>
    );
  }

  const agentGroups = groupAgentDetails(balance.cajasAgentes.detalle);
  const expenseGroups = groupExpenseDetails(balance.totalGastos.detalle);
  const displayFecha = balance.fecha ? formatDate(balance.fecha) : 'Ahora';
  const modeLabel = balance.fecha ? `Cierre al ${displayFecha}` : 'Modo ahora';
  const isBackgroundRefresh = refreshing && Boolean(balance);

  return (
    <div className="animate-fade-in" id="balance-page">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}

      <div className="page-header balance-page-header">
        <div>
          <h1 className="page-title">Dashboard de Balance</h1>
          <p className="page-subtitle">
            {modeLabel}. Dejar vacio el filtro equivale a tomar el snapshot actual.
          </p>
        </div>

        <div className="balance-toolbar">
          <div className="balance-toolbar-row">
            <label className="balance-date-field">
              <span>Cierre al (dejar vacio = ahora)</span>
              <input
                type="date"
                value={selectedDate}
                max={getTodayLima()}
                onChange={handleDateChange}
                disabled={refreshing}
              />
            </label>
            <button
              className="btn btn-secondary balance-clear-button"
              type="button"
              onClick={handleClearDate}
              disabled={!selectedDate || refreshing}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="balance-meta">
        <span className="balance-mode-pill">{modeLabel}</span>
        <span className="balance-mode-pill">
          Caja inicio mes: {formatCurrency(balance.cajaInicioMes)}
        </span>
        <span className="balance-mode-pill">
          {cajaInicioMesSetting
            ? `Vigente desde ${formatDate(cajaInicioMesSetting.fecha_efectiva)}`
            : 'Vigencia de caja inicio mes no disponible'}
        </span>
        {isBackgroundRefresh && <span className="balance-mode-pill balance-mode-pill--refresh">Actualizando snapshot...</span>}
      </div>

      <div className="balance-stats stagger-children">
        <StatsCard
          icon="🏦"
          label="Bancos admin"
          value={balance.bancosAdmin.total}
          variant="neutral"
          subtitle={`${balance.bancosAdmin.detalle.length} banco(s)`}
        />
        <StatsCard
          icon="👥"
          label="Cajas agentes"
          value={balance.cajasAgentes.total}
          variant={getKpiVariant(balance.cajasAgentes.total, 'neutral')}
          subtitle={`${agentGroups.length} agente(s)`}
        />
        <StatsCard
          icon="📦"
          label="Total gastos"
          value={balance.totalGastos.total}
          variant="negative"
          subtitle={`${expenseGroups.length} categoria(s)`}
        />
        <StatsCard
          icon="📉"
          label="Balance del dia"
          value={balance.balanceDia}
          variant={getKpiVariant(balance.balanceDia, 'neutral')}
          subtitle="Cierre actual menos cierre previo"
        />
        <StatsCard
          icon="✨"
          label="Balance acumulado"
          value={balance.balanceAcumulado}
          variant={getKpiVariant(balance.balanceAcumulado, 'neutral')}
          subtitle="Bancos + cajas - gastos - caja inicio mes"
        />
      </div>

      <div className="balance-sections">
        <section className="balance-section balance-section--wide animate-fade-in">
          <div className="balance-section-header">
            <div>
              <h2 className="balance-section-title">Balance por Agente</h2>
              <p className="page-subtitle">Saldo total por agente con detalle expandible por banco.</p>
            </div>
            <span className="badge badge-blue">{agentGroups.length} agente(s)</span>
          </div>

          {agentGroups.length === 0 ? (
            <EmptyState icon="👤" message="No hay cajas de agentes con movimientos para el filtro seleccionado." />
          ) : (
            <div className="table-container">
              <table className="table" id="agent-balance-table">
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {agentGroups.map((agent) => (
                    <tr key={agent.agente}>
                      <td>
                        <strong>{agent.agente}</strong>
                      </td>
                      <td className="text-right">
                        <span className={`amount ${agent.total >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {formatCurrency(agent.total)}
                        </span>
                      </td>
                      <td>
                        <details className="balance-details">
                          <summary className="balance-details-summary">
                            <span>{agent.bancos.length} banco(s)</span>
                            <span className="balance-details-hint">Ver detalle</span>
                          </summary>
                          <div className="balance-details-body">
                            <AgentBreakdownTable agent={agent} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="balance-section animate-fade-in">
          <div className="balance-section-header">
            <div>
              <h2 className="balance-section-title">Balance por Banco admin</h2>
              <p className="page-subtitle">Saldos consolidados por banco administrativo.</p>
            </div>
            <span className="badge badge-blue">{balance.bancosAdmin.detalle.length} banco(s)</span>
          </div>

          {balance.bancosAdmin.detalle.length === 0 ? (
            <EmptyState icon="🏦" message="No hay bancos admin para mostrar en este cierre." />
          ) : (
            <div className="table-container">
              <table className="table" id="admin-banks-table">
                <thead>
                  <tr>
                    <th>Banco</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.bancosAdmin.detalle.map((bank) => (
                    <tr key={bank.banco_id}>
                      <td>{bank.banco}</td>
                      <td className="text-right">
                        <span className={`amount ${bank.saldo >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {formatCurrency(bank.saldo)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="balance-section animate-fade-in">
          <div className="balance-section-header">
            <div>
              <h2 className="balance-section-title">Balance por categoria de gasto</h2>
              <p className="page-subtitle">Cada categoria agrupa sus subcategorias y montos.</p>
            </div>
            <span className="badge badge-blue">{expenseGroups.length} categoria(s)</span>
          </div>

          {expenseGroups.length === 0 ? (
            <EmptyState icon="📦" message="No hay gastos registrados para el rango seleccionado." />
          ) : (
            <div className="table-container">
              <table className="table" id="expense-breakdown-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseGroups.map((group) => (
                    <tr key={group.categoria}>
                      <td>
                        <strong>{group.categoria}</strong>
                      </td>
                      <td className="text-right">
                        <span className="amount amount-negative">{formatCurrency(group.total)}</span>
                      </td>
                      <td>
                        <details className="balance-details">
                          <summary className="balance-details-summary">
                            <span>{group.detalle.length} subcategoria(s)</span>
                            <span className="balance-details-hint">Ver detalle</span>
                          </summary>
                          <div className="balance-details-body">
                            <ExpenseBreakdownTable group={group} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
