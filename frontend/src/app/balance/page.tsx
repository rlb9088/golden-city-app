'use client';

import { useEffect, useState, useCallback } from 'react';
import { getBalance, GlobalBalance } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import StatsCard from '@/components/StatsCard';
import AlertBanner from '@/components/AlertBanner';
import TableSkeleton from '@/components/TableSkeleton';
import './balance.css';

export default function BalancePage() {
  const [balance, setBalance] = useState<GlobalBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBalance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getBalance();
      setBalance(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Cargando datos...</p>
          </div>
        </div>
        <div className="balance-stats stagger-children">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stats-card skeleton-card" />
          ))}
        </div>
        <div className="balance-sections">
          <div className="balance-section">
            <h2 className="balance-section-title">Balance por Agente</h2>
            <TableSkeleton columns={4} rows={4} />
          </div>
          <div className="balance-section">
            <h2 className="balance-section-title">Saldos Bancarios</h2>
            <TableSkeleton columns={2} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" id="balance-page">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard de Balance</h1>
          <p className="page-subtitle">Vista general del estado financiero</p>
        </div>
        <button className="btn btn-secondary" onClick={loadBalance} id="refresh-balance">
          🔄 Actualizar
        </button>
      </div>

      {balance && (
        <>
          <div className="balance-stats stagger-children">
            <StatsCard
              icon="🏛️"
              label="Balance Global"
              value={balance.global}
              variant={balance.global >= 0 ? 'gold' : 'negative'}
              subtitle="Cajas + Bancos - Gastos"
            />
            <StatsCard
              icon="💰"
              label="Total Cajas"
              value={balance.totalCajas}
              variant={balance.totalCajas >= 0 ? 'positive' : 'negative'}
              subtitle="Ingresos - Pagos"
            />
            <StatsCard
              icon="🏦"
              label="Total Bancos"
              value={balance.totalBancos}
              variant="neutral"
              subtitle={`${balance.bancos.length} banco(s) registrado(s)`}
            />
            <StatsCard
              icon="📤"
              label="Total Gastos"
              value={balance.totalGastos}
              variant="negative"
            />
          </div>

          <div className="balance-sections">
            <div className="balance-section animate-fade-in">
              <h2 className="balance-section-title">Balance por Agente</h2>
              {balance.agents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👤</div>
                  <p>No hay agentes con movimientos</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table" id="agents-table">
                    <thead>
                      <tr>
                        <th>Agente</th>
                        <th style={{textAlign: 'right'}}>Ingresos</th>
                        <th style={{textAlign: 'right'}}>Pagos</th>
                        <th style={{textAlign: 'right'}}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balance.agents.map((agent) => (
                        <tr key={agent.agente}>
                          <td>
                            <span className="agent-name">{agent.agente}</span>
                          </td>
                          <td className="text-right">
                            <span className="amount amount-positive">{formatCurrency(agent.ingresos)}</span>
                          </td>
                          <td className="text-right">
                            <span className="amount amount-negative">{formatCurrency(agent.pagos)}</span>
                          </td>
                          <td className="text-right">
                            <span className={`amount ${agent.balance >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                              {formatCurrency(agent.balance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="balance-section animate-fade-in">
              <h2 className="balance-section-title">Saldos Bancarios</h2>
              {balance.bancos.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏦</div>
                  <p>No hay saldos registrados</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table" id="bancos-balance-table">
                    <thead>
                      <tr>
                        <th>Banco</th>
                        <th style={{textAlign: 'right'}}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balance.bancos.map((b) => (
                        <tr key={b.banco}>
                          <td>{b.banco}</td>
                          <td className="text-right">
                            <span className="amount">{formatCurrency(parseFloat(b.saldo || '0'))}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
