const test = require('node:test');
const assert = require('node:assert/strict');

function loadBalanceService({
  ingresos,
  pagos,
  gastos,
  bancosSnapshots,
  configBancos,
  adminBankIds,
  cajaInicioMes,
  todayDate,
}) {
  const balancePath = require.resolve('../services/balance.service');
  const ingresosPath = require.resolve('../services/ingresos.service');
  const pagosPath = require.resolve('../services/pagos.service');
  const gastosPath = require.resolve('../services/gastos.service');
  const bancosPath = require.resolve('../services/bancos.service');
  const configPath = require.resolve('../services/config.service');
  const timezonePath = require.resolve('../config/timezone');

  delete require.cache[balancePath];
  delete require.cache[ingresosPath];
  delete require.cache[pagosPath];
  delete require.cache[gastosPath];
  delete require.cache[bancosPath];
  delete require.cache[configPath];
  delete require.cache[timezonePath];

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
      getAll: async () => bancosSnapshots,
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      getTable: async (tableName) => (tableName === 'bancos' ? configBancos : []),
      getAdminBankIds: async () => new Set(adminBankIds),
      getAgentBankIds: async () => new Set(configBancos
        .filter((bank) => !adminBankIds.includes(bank.id))
        .map((bank) => bank.id)),
      getSetting: async (key) => (key === 'caja_inicio_mes'
        ? { value: cajaInicioMes }
        : { value: 0 }),
    },
  };

  require.cache[timezonePath] = {
    id: timezonePath,
    filename: timezonePath,
    loaded: true,
    exports: {
      todayLima: () => todayDate,
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
    bancosSnapshots: [],
    configBancos: [],
    adminBankIds: [],
    cajaInicioMes: 0,
    todayDate: '2026-04-20',
  });

  const result = await service.getAgentBalance('Agente 1');

  assert.deepStrictEqual(result, {
    agente: 'Agente 1',
    ingresos: 300,
    pagos: 80,
    balance: 220,
  });
});

test('getBalanceAt calcula cierre por fecha con carry-forward y excluye anulados', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 300, fecha_movimiento: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 50, fecha_movimiento: '2026-04-19', estado: 'anulado' },
      { agente: 'Agente 2', banco_id: 'BK-G2', banco: 'Caja 2', monto: 120, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 80, fecha_comprobante: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 2', banco_id: 'BK-G2', banco: 'Caja 2', monto: 20, fecha_comprobante: '2026-04-19', estado: 'anulado' },
    ],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 40, fecha_gasto: '2026-04-19', estado: 'anulado' },
    ],
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-18', saldo: 100, _rowIndex: 2 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-18', saldo: 200, _rowIndex: 3 },
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 130, _rowIndex: 4 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A', propietario_id: 'AG-ADMIN' },
      { id: 'BK-B', nombre: 'Admin B', propietario_id: 'AG-ADMIN' },
      { id: 'BK-G1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-G2', nombre: 'Caja 2', propietario_id: 'AG-2' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
    cajaInicioMes: 100,
    todayDate: '2026-04-20',
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 330,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 130 },
        { banco_id: 'BK-B', banco: 'Admin B', saldo: 200 },
      ],
    },
    cajasAgentes: {
      total: 340,
      detalle: [
        {
          agente: 'Agente 1',
          bancos: [
            { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 220 },
          ],
        },
        {
          agente: 'Agente 2',
          bancos: [
            { banco_id: 'BK-G2', banco: 'Caja 2', saldo: 120 },
          ],
        },
      ],
    },
    totalGastos: {
      total: 30,
      detalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30 },
      ],
    },
    balanceDia: 120,
    balanceAcumulado: 540,
    cajaInicioMes: 100,
  });
});

test('getBalanceAt sin fecha usa modo ahora y aplica movimientos de hoy si falta snapshot', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 300, fecha_movimiento: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 2', banco_id: 'BK-G2', banco: 'Caja 2', monto: 120, fecha_movimiento: '2026-04-19', estado: 'activo' },
      { agente: 'Admin', banco_id: 'BK-A', banco: 'Admin A', monto: 40, fecha_movimiento: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 60, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 80, fecha_comprobante: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 15, fecha_comprobante: '2026-04-20', estado: 'activo' },
    ],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 10, fecha_gasto: '2026-04-20', estado: 'activo', banco_id: 'BK-A', banco: 'Admin A' },
    ],
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-18', saldo: 100, _rowIndex: 2 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-18', saldo: 200, _rowIndex: 3 },
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 130, _rowIndex: 4 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-19', saldo: 200, _rowIndex: 5 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A', propietario_id: 'AG-ADMIN' },
      { id: 'BK-B', nombre: 'Admin B', propietario_id: 'AG-ADMIN' },
      { id: 'BK-G1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-G2', nombre: 'Caja 2', propietario_id: 'AG-2' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
    cajaInicioMes: 100,
    todayDate: '2026-04-20',
  });

  const result = await service.getBalanceAt();

    assert.deepStrictEqual(result, {
      fecha: null,
      bancosAdmin: {
        total: 360,
        detalle: [
          { banco_id: 'BK-A', banco: 'Admin A', saldo: 160 },
          { banco_id: 'BK-B', banco: 'Admin B', saldo: 200 },
        ],
      },
    cajasAgentes: {
      total: 385,
      detalle: [
        {
          agente: 'Agente 1',
          bancos: [
            { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 265 },
          ],
        },
        {
          agente: 'Agente 2',
          bancos: [
            { banco_id: 'BK-G2', banco: 'Caja 2', saldo: 120 },
          ],
        },
      ],
    },
    totalGastos: {
      total: 40,
      detalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 40 },
      ],
    },
    balanceDia: 65,
    balanceAcumulado: 605,
    cajaInicioMes: 100,
  });
});
