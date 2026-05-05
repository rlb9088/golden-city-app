const test = require('node:test');
const assert = require('node:assert/strict');

function loadBalanceService({
  ingresos = [],
  pagos = [],
  gastos = [],
  depositosTotales = [],
  retirosTotales = [],
  bonosTotales = [],
  retirosNoPagados = [],
  bancosSnapshots = [],
  configBancos = [],
  agentes = [],
  adminBankIds = [],
  agentBankIds = [],
  configCajas = [],
  cajaInicioMes = 0,
  todayDate = '2026-04-20',
} = {}) {
  const balancePath = require.resolve('../services/balance.service');
  const ingresosPath = require.resolve('../services/ingresos.service');
  const pagosPath = require.resolve('../services/pagos.service');
  const gastosPath = require.resolve('../services/gastos.service');
  const depositosTotalesPath = require.resolve('../services/depositos-totales.service');
  const retirosTotalesPath = require.resolve('../services/retiros-totales.service');
  const bonosTotalesPath = require.resolve('../services/bonos-totales.service');
  const retirosNoPagadosPath = require.resolve('../services/retiros-no-pagados.service');
  const bancosPath = require.resolve('../services/bancos.service');
  const configPath = require.resolve('../services/config.service');
  const timezonePath = require.resolve('../config/timezone');

  delete require.cache[balancePath];
  delete require.cache[ingresosPath];
  delete require.cache[pagosPath];
  delete require.cache[gastosPath];
  delete require.cache[depositosTotalesPath];
  delete require.cache[retirosTotalesPath];
  delete require.cache[bonosTotalesPath];
  delete require.cache[retirosNoPagadosPath];
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

  require.cache[depositosTotalesPath] = {
    id: depositosTotalesPath,
    filename: depositosTotalesPath,
    loaded: true,
    exports: {
      getAll: async () => depositosTotales,
    },
  };

  require.cache[retirosTotalesPath] = {
    id: retirosTotalesPath,
    filename: retirosTotalesPath,
    loaded: true,
    exports: {
      getAll: async () => retirosTotales,
    },
  };

  require.cache[bonosTotalesPath] = {
    id: bonosTotalesPath,
    filename: bonosTotalesPath,
    loaded: true,
    exports: {
      getAll: async () => bonosTotales,
    },
  };

  require.cache[retirosNoPagadosPath] = {
    id: retirosNoPagadosPath,
    filename: retirosNoPagadosPath,
    loaded: true,
    exports: {
      getAll: async () => retirosNoPagados,
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

        if (tableName === 'cajas') {
          return configCajas;
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

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00-05:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function stripLegacyBalanceSnapshot(snapshot) {
  return {
    fecha: snapshot.fecha,
    bancosAdmin: snapshot.bancosAdmin,
    cajasAgentes: snapshot.cajasAgentes,
    totalGastos: snapshot.totalGastos,
    cajaDisponible: snapshot.cajaDisponible,
    balanceAcumulado: snapshot.balanceAcumulado,
    cajaInicioMes: snapshot.cajaInicioMes,
  };
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
    cajaDisponible: 0,
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
    cajaDisponible: 300,
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
    cajaDisponible: 300,
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
    cajaDisponible: 330,
    balanceAcumulado: 340,
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
    cajaDisponible: 50,
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
    cajaDisponible: 80,
    balanceAcumulado: 110,
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
    cajaDisponible: 75,
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
    cajaDisponible: 55,
    balanceAcumulado: 55,
    cajaInicioMes: 75,
  });
});

test('getBalanceAt expone cajaDisponible y suma gastos en balanceAcumulado', async () => {
  const service = loadBalanceService({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 600, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-G1', banco: 'Caja 1', monto: 100, fecha_comprobante: '2026-04-19', estado: 'activo' },
    ],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 200, fecha_gasto: '2026-04-19', estado: 'activo' },
    ],
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 1000, _rowIndex: 2 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
      { id: 'BK-G1', nombre: 'Caja 1' },
    ],
    adminBankIds: ['BK-A'],
    agentBankIds: ['BK-G1'],
    cajaInicioMes: 300,
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.equal(Object.hasOwn(result, 'balanceDia'), false);
  assert.equal(result.cajaDisponible, 1200);
  assert.equal(result.balanceAcumulado, 1400);
});

test('getBalanceAt sin movimientos nuevos retorna los 6 indicadores en cero', async () => {
  const service = loadBalanceService();

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.equal(result.depositosRealesDia, 0);
  assert.equal(result.retirosRealesDia, 0);
  assert.equal(result.balanceIngresosDia, 0);
  assert.equal(result.depositosRealesAcumulado, 0);
  assert.equal(result.retirosRealesAcumulado, 0);
  assert.equal(result.balanceIngresosAcumulado, 0);
  assert.deepStrictEqual(result.depositosDia, { total: 0, detalle: [] });
  assert.deepStrictEqual(result.retirosDia, { total: 0, detalle: [] });
  assert.deepStrictEqual(result.bonosDia, { total: 0, detalle: [] });
  assert.deepStrictEqual(result.retirosNoPagadosDia, { total: 0, detalle: [] });
});

test('getBalanceAt calcula depositos reales del dia restando bonos del mismo dia', async () => {
  const service = loadBalanceService({
    depositosTotales: [
      { id: 'DPT-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 100, _rowIndex: 1 },
      { id: 'DPT-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 50, _rowIndex: 2 },
    ],
    bonosTotales: [
      { id: 'BON-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 15, _rowIndex: 3 },
      { id: 'BON-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 5, _rowIndex: 4 },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result.depositosDia, {
    total: 150,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 100 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 50 },
    ],
  });
  assert.deepStrictEqual(result.bonosDia, {
    total: 20,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 15 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 5 },
    ],
  });
  assert.equal(result.depositosRealesDia, 130);
  assert.equal(result.balanceIngresosDia, 130);
});

test('getBalanceAt calcula retiros reales del dia restando retiros no pagados del mismo dia', async () => {
  const service = loadBalanceService({
    retirosTotales: [
      { id: 'RTR-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 70, _rowIndex: 1 },
      { id: 'RTR-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 30, _rowIndex: 2 },
    ],
    retirosNoPagados: [
      { id: 'RNP-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 10, _rowIndex: 3 },
      { id: 'RNP-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 4, _rowIndex: 4 },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result.retirosDia, {
    total: 100,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 70 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 30 },
    ],
  });
  assert.deepStrictEqual(result.retirosNoPagadosDia, {
    total: 14,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 10 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 4 },
    ],
  });
  assert.equal(result.retirosRealesDia, 86);
  assert.equal(result.balanceIngresosDia, -86);
});

test('getBalanceAt acumulado suma los montos de todos los dias hasta la fecha por caja', async () => {
  const service = loadBalanceService({
    depositosTotales: [
      { id: 'DPT-1', fecha: '2026-04-17', caja_id: 'CJ-1', caja: 'Caja 1', monto: 50, _rowIndex: 1 },
      { id: 'DPT-2', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 60, _rowIndex: 2 },
      { id: 'DPT-3', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 80, _rowIndex: 5 },
      { id: 'DPT-4', fecha: '2026-04-18', caja_id: 'CJ-2', caja: 'Caja 2', monto: 10, _rowIndex: 4 },
    ],
    bonosTotales: [
      { id: 'BON-1', fecha: '2026-04-18', caja_id: 'CJ-1', caja: 'Caja 1', monto: 2, _rowIndex: 1 },
      { id: 'BON-2', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 5, _rowIndex: 2 },
      { id: 'BON-3', fecha: '2026-04-18', caja_id: 'CJ-2', caja: 'Caja 2', monto: 1, _rowIndex: 3 },
    ],
    retirosTotales: [
      { id: 'RTR-1', fecha: '2026-04-17', caja_id: 'CJ-1', caja: 'Caja 1', monto: 20, _rowIndex: 1 },
      { id: 'RTR-2', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 40, _rowIndex: 2 },
      { id: 'RTR-3', fecha: '2026-04-18', caja_id: 'CJ-2', caja: 'Caja 2', monto: 20, _rowIndex: 3 },
    ],
    retirosNoPagados: [
      { id: 'RNP-1', fecha: '2026-04-18', caja_id: 'CJ-1', caja: 'Caja 1', monto: 3, _rowIndex: 1 },
      { id: 'RNP-2', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 4, _rowIndex: 2 },
      { id: 'RNP-3', fecha: '2026-04-18', caja_id: 'CJ-2', caja: 'Caja 2', monto: 1, _rowIndex: 3 },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  // CJ-1 depositos: 50 (17/04) + 80 (19/04, ultimo UPSERT) = 130; CJ-2: 10 (18/04)
  assert.deepStrictEqual(result.depositosAcum, {
    total: 140,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 130 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 10 },
    ],
  });
  // CJ-1 bonos: 2 (18/04) + 5 (19/04) = 7; CJ-2: 1 (18/04)
  assert.deepStrictEqual(result.bonosAcum, {
    total: 8,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 7 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 1 },
    ],
  });
  // CJ-1 retiros: 20 (17/04) + 40 (19/04) = 60; CJ-2: 20 (18/04)
  assert.deepStrictEqual(result.retirosAcum, {
    total: 80,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 60 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 20 },
    ],
  });
  // CJ-1 RNP: 3 (18/04) + 4 (19/04) = 7; CJ-2: 1 (18/04)
  assert.deepStrictEqual(result.retirosNoPagadosAcum, {
    total: 8,
    detalle: [
      { caja_id: 'CJ-1', caja: 'Caja 1', monto: 7 },
      { caja_id: 'CJ-2', caja: 'Caja 2', monto: 1 },
    ],
  });
  // 140 - 8 = 132
  assert.equal(result.depositosRealesAcumulado, 132);
  // 80 - 8 = 72
  assert.equal(result.retirosRealesAcumulado, 72);
  // 132 - 72 = 60
  assert.equal(result.balanceIngresosAcumulado, 60);
});

test('getBalanceAt expone cajas configuradas en cero cuando no hay movimientos', async () => {
  const service = loadBalanceService({
    configCajas: [
      { id: 'CJ-1', nombre: 'Caja 1' },
      { id: 'CJ-2', nombre: 'Caja 2' },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result.balanceIngresosDiaPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 0,
      retiroReal: 0,
      balance: 0,
    },
    {
      caja_id: 'CJ-2',
      caja: 'Caja 2',
      depositoReal: 0,
      retiroReal: 0,
      balance: 0,
    },
  ]);

  assert.deepStrictEqual(result.balanceIngresosAcumuladoPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 0,
      retiroReal: 0,
      balance: 0,
    },
    {
      caja_id: 'CJ-2',
      caja: 'Caja 2',
      depositoReal: 0,
      retiroReal: 0,
      balance: 0,
    },
  ]);
});

test('getBalanceAt calcula balance por caja con acumulado y suma total coherente', async () => {
  const service = loadBalanceService({
    configCajas: [
      { id: 'CJ-1', nombre: 'Caja 1' },
      { id: 'CJ-2', nombre: 'Caja 2' },
      { id: 'CJ-3', nombre: 'Caja 3' },
    ],
    depositosTotales: [
      { id: 'DPT-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 100, _rowIndex: 1 },
      { id: 'DPT-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 40, _rowIndex: 2 },
      { id: 'DPT-3', fecha: '2026-04-18', caja_id: 'CJ-3', caja: 'Caja 3', monto: 70, _rowIndex: 3 },
    ],
    retirosTotales: [
      { id: 'RTR-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 60, _rowIndex: 1 },
      { id: 'RTR-2', fecha: '2026-04-19', caja_id: 'CJ-2', caja: 'Caja 2', monto: 5, _rowIndex: 2 },
      { id: 'RTR-3', fecha: '2026-04-18', caja_id: 'CJ-3', caja: 'Caja 3', monto: 20, _rowIndex: 3 },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result.balanceIngresosDiaPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 100,
      retiroReal: 60,
      balance: 40,
    },
    {
      caja_id: 'CJ-2',
      caja: 'Caja 2',
      depositoReal: 40,
      retiroReal: 5,
      balance: 35,
    },
    {
      caja_id: 'CJ-3',
      caja: 'Caja 3',
      depositoReal: 0,
      retiroReal: 0,
      balance: 0,
    },
  ]);

  assert.deepStrictEqual(result.balanceIngresosAcumuladoPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 100,
      retiroReal: 60,
      balance: 40,
    },
    {
      caja_id: 'CJ-2',
      caja: 'Caja 2',
      depositoReal: 40,
      retiroReal: 5,
      balance: 35,
    },
    {
      caja_id: 'CJ-3',
      caja: 'Caja 3',
      depositoReal: 70,
      retiroReal: 20,
      balance: 50,
    },
  ]);

  const totalDiaPorCaja = result.balanceIngresosDiaPorCaja.reduce((sum, item) => sum + item.balance, 0);
  const totalAcumuladoPorCaja = result.balanceIngresosAcumuladoPorCaja.reduce((sum, item) => sum + item.balance, 0);

  assert.equal(totalDiaPorCaja, result.balanceIngresosDia);
  assert.equal(totalAcumuladoPorCaja, result.balanceIngresosAcumulado);
  assert.equal(result.balanceIngresosDiaPorCaja[0].depositoReal, 100);
  assert.equal(result.balanceIngresosDiaPorCaja[1].depositoReal, 40);
});

test('getBalanceAt marca cajas huérfanas que ya no estan en config_cajas', async () => {
  const service = loadBalanceService({
    configCajas: [
      { id: 'CJ-1', nombre: 'Caja 1' },
    ],
    depositosTotales: [
      { id: 'DPT-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 10, _rowIndex: 1 },
      { id: 'DPT-2', fecha: '2026-04-19', caja_id: 'CJ-X', caja: 'Caja Eliminada', monto: 20, _rowIndex: 2 },
    ],
    retirosTotales: [
      { id: 'RTR-1', fecha: '2026-04-19', caja_id: 'CJ-X', caja: 'Caja Eliminada', monto: 5, _rowIndex: 1 },
    ],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.deepStrictEqual(result.balanceIngresosDiaPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 10,
      retiroReal: 0,
      balance: 10,
    },
    {
      caja_id: 'CJ-X',
      caja: 'Caja Eliminada',
      depositoReal: 20,
      retiroReal: 5,
      balance: 15,
      _orphan: true,
    },
  ]);

  assert.deepStrictEqual(result.balanceIngresosAcumuladoPorCaja, [
    {
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      depositoReal: 10,
      retiroReal: 0,
      balance: 10,
    },
    {
      caja_id: 'CJ-X',
      caja: 'Caja Eliminada',
      depositoReal: 20,
      retiroReal: 5,
      balance: 15,
      _orphan: true,
    },
  ]);
});

test('getBalanceAt calcula variacionCajaDia con datos del primer dia y sin previos', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 150, _rowIndex: 1 },
    ],
    depositosTotales: [
      { id: 'DPT-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 100, _rowIndex: 1 },
    ],
    bonosTotales: [
      { id: 'BON-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 20, _rowIndex: 1 },
    ],
    retirosTotales: [
      { id: 'RTR-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 70, _rowIndex: 1 },
    ],
    retirosNoPagados: [
      { id: 'RNP-1', fecha: '2026-04-19', caja_id: 'CJ-1', caja: 'Caja 1', monto: 10, _rowIndex: 1 },
    ],
    gastos: [
      { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 15, fecha_gasto: '2026-04-19', estado: 'activo' },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
    ],
    adminBankIds: ['BK-A'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.equal(result.variacionCajaDia, 145);
  assert.equal(result.variacionCajaAcumulada, 145);
});

test('getBalanceAt acumula la variacion de dos dias consecutivos', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-18', saldo: 100, _rowIndex: 1 },
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 130, _rowIndex: 2 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
    ],
    adminBankIds: ['BK-A'],
  });

  const day1 = await service.getBalanceAt({ fecha: '2026-04-18' });
  const day2 = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.equal(day1.variacionCajaDia, 100);
  assert.equal(day1.variacionCajaAcumulada, 100);
  assert.equal(day2.variacionCajaDia, 30);
  assert.equal(day2.variacionCajaAcumulada, 130);
  assert.equal(day2.variacionCajaAcumulada, day1.variacionCajaDia + day2.variacionCajaDia);
});

test('getBalanceAt calcula variacionCajaDia sin gastos ni movimientos operativos', async () => {
  const service = loadBalanceService({
    bancosSnapshots: [
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-18', saldo: 80, _rowIndex: 1 },
      { banco_id: 'BK-A', banco: 'Admin A', fecha: '2026-04-19', saldo: 115, _rowIndex: 2 },
    ],
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
    ],
    adminBankIds: ['BK-A'],
  });

  const result = await service.getBalanceAt({ fecha: '2026-04-19' });

  assert.equal(result.variacionCajaDia, 35);
  assert.equal(result.variacionCajaAcumulada, 115);
});

test('getBalanceAt resuelve un historico de 60 dias en menos de 3s', async () => {
  const bancosSnapshots = [];
  const depositosTotales = [];
  const bonosTotales = [];
  const retirosTotales = [];
  const retirosNoPagados = [];

  for (let index = 0; index < 60; index += 1) {
    const fecha = addDays('2026-01-01', index);
    bancosSnapshots.push({
      banco_id: 'BK-A',
      banco: 'Admin A',
      fecha,
      saldo: 100 + index,
      _rowIndex: index + 1,
    });
    depositosTotales.push({
      id: `DPT-${index + 1}`,
      fecha,
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      monto: 10 + index,
      _rowIndex: index + 1,
    });
    bonosTotales.push({
      id: `BON-${index + 1}`,
      fecha,
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      monto: 1,
      _rowIndex: index + 1,
    });
    retirosTotales.push({
      id: `RTR-${index + 1}`,
      fecha,
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      monto: 5 + index,
      _rowIndex: index + 1,
    });
    retirosNoPagados.push({
      id: `RNP-${index + 1}`,
      fecha,
      caja_id: 'CJ-1',
      caja: 'Caja 1',
      monto: 1,
      _rowIndex: index + 1,
    });
  }

  const service = loadBalanceService({
    bancosSnapshots,
    depositosTotales,
    bonosTotales,
    retirosTotales,
    retirosNoPagados,
    configBancos: [
      { id: 'BK-A', nombre: 'Admin A' },
    ],
    adminBankIds: ['BK-A'],
  });

  const startedAt = Date.now();
  const result = await service.getBalanceAt({ fecha: '2026-03-01' });
  const elapsedMs = Date.now() - startedAt;

  assert.equal(Number.isFinite(result.variacionCajaAcumulada), true);
  assert.ok(elapsedMs < 3000, `expected 60-day balance to finish under 3000ms, got ${elapsedMs}ms`);
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
    cajaDisponible: 150,
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
    cajaDisponible: 0,
    balanceAcumulado: 65,
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
