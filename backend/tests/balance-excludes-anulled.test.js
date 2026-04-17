const test = require('node:test');
const assert = require('node:assert/strict');

function loadBalanceService({ ingresos, pagos, gastos, bancos }) {
  const balancePath = require.resolve('../services/balance.service');
  const ingresosPath = require.resolve('../services/ingresos.service');
  const pagosPath = require.resolve('../services/pagos.service');
  const gastosPath = require.resolve('../services/gastos.service');
  const bancosPath = require.resolve('../services/bancos.service');

  delete require.cache[balancePath];
  delete require.cache[ingresosPath];
  delete require.cache[pagosPath];
  delete require.cache[gastosPath];
  delete require.cache[bancosPath];

  require.cache[ingresosPath] = {
    id: ingresosPath,
    filename: ingresosPath,
    loaded: true,
    exports: {
      getAll: async () => ingresos,
      getByAgent: async (agente) => ingresos.filter((item) => item.agente === agente),
    },
  };

  require.cache[pagosPath] = {
    id: pagosPath,
    filename: pagosPath,
    loaded: true,
    exports: {
      getAll: async () => pagos,
      getByAgent: async (agente) => pagos.filter((item) => item.agente === agente),
    },
  };

  require.cache[gastosPath] = {
    id: gastosPath,
    filename: gastosPath,
    loaded: true,
    exports: {
      getAll: async () => gastos,
    },
  };

  require.cache[bancosPath] = {
    id: bancosPath,
    filename: bancosPath,
    loaded: true,
    exports: {
      getLatest: async () => bancos,
    },
  };

  return require('../services/balance.service');
}

test('getAgentBalance excluye pagos anulados', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', monto: 300, estado: 'activo' },
      { agente: 'Agente 1', monto: 200, estado: 'anulado' },
    ],
    pagos: [
      { agente: 'Agente 1', monto: 80, estado: 'activo' },
      { agente: 'Agente 1', monto: 50, estado: 'anulado' },
    ],
    gastos: [],
    bancos: [],
  });

  const result = await service.getAgentBalance('Agente 1');

  assert.deepStrictEqual(result, {
    agente: 'Agente 1',
    ingresos: 300,
    pagos: 80,
    balance: 220,
  });
});

test('getGlobalBalance excluye registros anulados en ingresos y pagos', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', monto: 300, estado: 'activo' },
      { agente: 'Agente 1', monto: 200, estado: 'anulado' },
      { agente: 'Agente 2', monto: 100, estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', monto: 80, estado: 'activo' },
      { agente: 'Agente 1', monto: 50, estado: 'anulado' },
      { agente: 'Agente 2', monto: 20, estado: 'activo' },
    ],
    gastos: [
      { monto: 25, estado: 'activo' },
      { monto: 100, estado: 'anulado' },
    ],
    bancos: [
      { banco: 'BCP', saldo: 40 },
    ],
  });

  const result = await service.getGlobalBalance();

  assert.deepStrictEqual(result, {
    agents: [
      {
        agente: 'Agente 1',
        ingresos: 300,
        pagos: 80,
        balance: 220,
      },
      {
        agente: 'Agente 2',
        ingresos: 100,
        pagos: 20,
        balance: 80,
      },
    ],
    bancos: [{ banco: 'BCP', saldo: 40 }],
    totalCajas: 300,
    totalBancos: 40,
    totalGastos: 25,
    global: 315,
  });
});
