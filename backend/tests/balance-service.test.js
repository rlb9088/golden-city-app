const test = require('node:test');
const assert = require('node:assert/strict');

function loadBalanceService({
  ingresos = [],
  pagos = [],
  gastos = [],
  bancosSnapshots = [],
  configBancos = [],
  agentes = [],
  adminBankIds = [],
  agentBankIds = [],
  cajaInicioMes = 0,
  todayDate = '2026-04-20',
} = {}) {
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
      getTable: async (tableName) => {
        if (tableName === 'bancos') {
          return configBancos;
        }

        if (tableName === 'agentes') {
          return agentes;
        }

        return [];
      },
      getAdminBankIds: async () => new Set(adminBankIds),
      getAgentBankIds: async () => new Set(agentBankIds),
      getSetting: async (key) => (key === 'caja_inicio_mes'
        ? { value: cajaInicioMes }
        : { value: 0 }),
      getCajaInicioMesByBanco: async () => ({
        value: 0,
        fecha_efectiva: null,
      }),
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

test('getBalanceAt sin fecha y sin datos retorna ceros', async () => {
  const service = loadBalanceService();

  const result = await service.getBalanceAt();

  assert.deepStrictEqual(result, {
    fecha: null,
    bancosAdmin: {
      total: 0,
      detalle: [],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 0,
    balanceAcumulado: 0,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt con fecha especifica usa solo snapshots de bancos admin de esa fecha', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 100, _rowIndex: 2 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-19', saldo: 200, _rowIndex: 3 },
      { banco_id: 'BK-G1', banco: 'Caja 1', fecha: '2026-04-19', saldo: 999, _rowIndex: 4 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-B', nombre: 'Admin B' },
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
    agentBankIds: ['BK-G1'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 300,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 100 },
        { banco_id: 'BK-B', banco: 'Admin B', saldo: 200 },
      ],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 300,
    balanceAcumulado: 300,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt con carry-forward usa el snapshot mas reciente anterior', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-18', saldo: 100, _rowIndex: 2 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-18', saldo: 200, _rowIndex: 3 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-B', nombre: 'Admin B' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-20' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-20',
    bancosAdmin: {
      total: 300,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 100 },
        { banco_id: 'BK-B', banco: 'Admin B', saldo: 200 },
      ],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 0,
    balanceAcumulado: 300,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt sin fecha y sin snapshot de hoy combina ayer mas movimientos admin de hoy', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Admin', banco_id: 'BK-A', banco: 'Admin A', monto: 40, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 10, fecha_gasto: '2026-04-20', estado: 'activo', banco_id: 'BK-A', banco: 'Admin A' },
    ],
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 100, _rowIndex: 2 },
      { banco_id: 'BK-B', banco: 'Admin B', fecha: '2026-04-19', saldo: 200, _rowIndex: 3 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-B', nombre: 'Admin B' },
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
    agentBankIds: ['BK-G1'],
  });

  const result = await service.getBalanceAt();

  assert.deepStrictEqual(result, {
    fecha: null,
    bancosAdmin: {
      total: 330,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 130 },
        { banco_id: 'BK-B', banco: 'Admin B', saldo: 200 },
      ],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 10,
      detalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 10 },
      ],
    },
    balanceDia: 20,
    balanceAcumulado: 320,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt no cuenta bancos de agentes como bancos admin', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 50, _rowIndex: 2 },
      { banco_id: 'BK-G1', banco: 'Caja 1', fecha: '2026-04-19', saldo: 999, _rowIndex: 3 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: ['BK-A'],
    agentBankIds: ['BK-G1'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 50,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 50 },
      ],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 50,
    balanceAcumulado: 50,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt excluye anulados en ingresos, pagos y gastos', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-19', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 900, fecha_movimiento: '2026-04-19', estado: 'anulado' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 20, fecha_comprobante: '2026-04-19', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 50, fecha_comprobante: '2026-04-19', estado: 'anulado' },
    ],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 70, fecha_gasto: '2026-04-19', estado: 'anulado' },
    ],
    configBancos: [
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: [],
    agentBankIds: ['BK-G1'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 0,
      detalle: [],
    },
    cajasAgentes: {
      total: 80,
      detalle: [
        {
          agente: 'Agente 1',
          bancos: [
            { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 80 },
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
    balanceDia: 50,
    balanceAcumulado: 50,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt en el primer dia del mes mantiene carry-forward y deja cajas anteriores en cero', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-03-29', saldo: 75, _rowIndex: 2 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-B', nombre: 'Admin B' },
    ],
    adminBankIds: ['BK-A', 'BK-B'],
    agentBankIds: ['BK-G1'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-01' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-01',
    bancosAdmin: {
      total: 75,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 75 },
        { banco_id: 'BK-B', banco: 'Admin B', saldo: 0 },
      ],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 0,
    balanceAcumulado: 75,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt usa caja_inicio_mes en el balance acumulado', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 40, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 10, fecha_comprobante: '2026-04-19', estado: 'activo' },
    ],
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 100, _rowIndex: 2 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: ['BK-A'],
    agentBankIds: ['BK-G1'],
    cajaInicioMes: 75,
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 100,
      detalle: [
        { banco_id: 'BK-A', banco: 'Admin A', saldo: 100 },
      ],
    },
    cajasAgentes: {
      total: 30,
      detalle: [
        {
          agente: 'Agente 1',
          bancos: [
            { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 30 },
          ],
        },
      ],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 130,
    balanceAcumulado: 55,
    cajaInicioMes: 75,
  });
});

test('getBalanceAt desglosa agentes con movimientos y omite los que no tienen', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 2', banco_id: 'BK-G2', banco: 'Caja 2', monto: 50, fecha_movimiento: '2026-04-19', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [],
    configBancos: [
      { id: 'BK-G1', nombre: 'Caja 1' },
      { id: 'BK-G2', nombre: 'Caja 2' },
      { id: 'BK-G3', nombre: 'Caja 3' },
    ],
    adminBankIds: [],
    agentBankIds: ['BK-G1', 'BK-G2', 'BK-G3'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 0,
      detalle: [],
    },
    cajasAgentes: {
      total: 150,
      detalle: [
        {
          agente: 'Agente 1',
          bancos: [
            { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 100 },
          ],
        },
        {
          agente: 'Agente 2',
          bancos: [
            { banco_id: 'BK-G2', banco: 'Caja 2', saldo: 50 },
          ],
        },
      ],
    },
    totalGastos: {
      total: 0,
      detalle: [],
    },
    balanceDia: 150,
    balanceAcumulado: 150,
    cajaInicioMes: 0,
  });
});

test('getBalanceAt agrupa correctamente gastos por subcategoria', async () => {
  const service = loadBalanceService({
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 20, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Operativo', subcategoria: 'Mantenimiento', monto: 10, fecha_gasto: '2026-04-19', estado: 'activo' },
      { categoria: 'Personal', subcategoria: 'Nominas', monto: 5, fecha_gasto: '2026-04-19', estado: 'activo' },
    ],
    adminBankIds: [],
    agentBankIds: [],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    bancosAdmin: {
      total: 0,
      detalle: [],
    },
    cajasAgentes: {
      total: 0,
      detalle: [],
    },
    totalGastos: {
      total: 65,
      detalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 50 },
        { categoria: 'Operativo', subcategoria: 'Mantenimiento', monto: 10 },
        { categoria: 'Personal', subcategoria: 'Nominas', monto: 5 },
      ],
    },
    balanceDia: -65,
    balanceAcumulado: -65,
    cajaInicioMes: 0,
  });
});

test('getAgentCajaAt calcula el cierre del agente con fecha y filtra solo sus bancos', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 40, fecha_movimiento: '2026-04-19', estado: 'anulado' },
      { agente: 'Agente 1', banco_id: 'BK-G2', banco: 'Caja 2', monto: 60, fecha_movimiento: '2026-04-19', estado: 'activo' },
      { agente: 'Agente 2', banco_id: 'BK-G2', banco: 'Caja 2', monto: 999, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 25, fecha_comprobante: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 10, fecha_comprobante: '2026-04-19', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-G2', banco: 'Caja 2', monto: 50, fecha_comprobante: '2026-04-19', estado: 'activo' },
    ],
    configBancos: [
      { id: 'BK-G1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-G2', nombre: 'Caja 2', propietario_id: 'AG-2' },
      { id: 'BK-ADMIN', nombre: 'Admin', propietario_id: 'AG-ADMIN' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
      { id: 'AG-2', nombre: 'Agente 2', username: 'agente2' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'agente 1', fecha: '2026-04-19' });

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    agente: 'Agente 1',
    total: 65,
    movimiento: {
      montoInicial: 75,
      pagosDia: 10,
      saldoTotal: 65,
    },
    bancos: [
      { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 65 },
    ],
  });
});

test('getAgentCajaAt en modo ahora devuelve ceros cuando no hay movimientos', async () => {
  const service = loadBalanceService({
    configBancos: [
      { id: 'BK-G1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    todayDate: '2026-04-20',
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' });

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 0,
    movimiento: {
      montoInicial: 0,
      pagosDia: 0,
      saldoTotal: 0,
    },
    bancos: [
      { banco_id: 'BK-G1', banco: 'Caja 1', saldo: 0 },
    ],
  });
});
