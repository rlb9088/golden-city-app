const test = require('node:test');
const assert = require('node:assert/strict');

function loadBalanceService({ cajaInicioMesByBanco = {} } = {}) {
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
      getAll: async () => [],
      getByAgent: async () => [],
    },
  };

  require.cache[pagosPath] = {
    id: pagosPath,
    filename: pagosPath,
    loaded: true,
    exports: {
      getAll: async () => [],
      getByAgent: async () => [],
    },
  };

  require.cache[gastosPath] = {
    id: gastosPath,
    filename: gastosPath,
    loaded: true,
    exports: {
      getAll: async () => [],
    },
  };

  require.cache[bancosPath] = {
    id: bancosPath,
    filename: bancosPath,
    loaded: true,
    exports: {
      getAll: async () => [],
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      getTable: async () => [],
      getAdminBankIds: async () => new Set(),
      getAgentBankIds: async () => new Set(),
      getSetting: async () => ({ value: 0 }),
      getCajaInicioMesByBanco: async (bancoId) => cajaInicioMesByBanco[bancoId] || {
        value: 0,
        fecha_efectiva: null,
      },
    },
  };

  require.cache[timezonePath] = {
    id: timezonePath,
    filename: timezonePath,
    loaded: true,
    exports: {
      todayLima: () => '2026-04-20',
    },
  };

  return require('../services/balance.service');
}

function buildContext({
  ingresos = [],
  pagos = [],
  bancos = [],
  agentes = [],
  todayDate = '2026-04-20',
  cajaInicioMes = 0,
} = {}) {
  return {
    ingresos,
    pagos,
    gastos: [],
    bancos,
    bancosSnapshots: [],
    agentes,
    adminBankIds: new Set(),
    agentBankIds: new Set(),
    todayDate,
    cajaInicioMes,
  };
}

test('agente sin movimientos devuelve ceros y mantiene sus bancos configurados', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

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
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 0 },
    ],
  });
});

test('agente con ingresos en multiples bancos y sin pagos suma correctamente', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-2', banco: 'Caja 2', monto: 250, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'Caja 2', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 350,
    movimiento: {
      montoInicial: 0,
      pagosDia: 0,
      saldoTotal: 0,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 100 },
      { banco_id: 'BK-2', banco: 'Caja 2', saldo: 250 },
    ],
  });
});

test('agente con ingresos y pagos en el mismo dia en modo ahora calcula el saldo diario', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 300, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 90, fecha_comprobante: '2026-04-20', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 210,
    movimiento: {
      montoInicial: 0,
      pagosDia: 90,
      saldoTotal: -90,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 210 },
    ],
  });
});

test('modo historico excluye pagos del dia anterior en pagosDia y acumula montoInicial hasta D-1', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 40, fecha_movimiento: '2026-04-19', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 30, fecha_comprobante: '2026-04-18', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 10, fecha_comprobante: '2026-04-19', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
    todayDate: '2026-04-20',
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1', fecha: '2026-04-19' }, context);

  assert.deepStrictEqual(result, {
    fecha: '2026-04-19',
    agente: 'Agente 1',
    total: 100,
    movimiento: {
      montoInicial: 70,
      pagosDia: 10,
      saldoTotal: 60,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 100 },
    ],
  });
});

test('anulados excluidos no afectan los totales', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 100, fecha_movimiento: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 999, fecha_movimiento: '2026-04-20', estado: 'anulado' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 20, fecha_comprobante: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 50, fecha_comprobante: '2026-04-20', estado: 'anulado' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 80,
    movimiento: {
      montoInicial: 0,
      pagosDia: 20,
      saldoTotal: -20,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 80 },
    ],
  });
});

test('agente B no ve datos del agente A', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente A', banco_id: 'BK-A', banco: 'Caja A', monto: 100, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente A', banco_id: 'BK-A', banco: 'Caja A', monto: 40, fecha_comprobante: '2026-04-20', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-A', nombre: 'Agente A', username: 'agente-a' },
      { id: 'AG-B', nombre: 'Agente B', username: 'agente-b' },
    ],
    bancos: [
      { id: 'BK-A', nombre: 'Caja A', propietario_id: 'AG-A' },
      { id: 'BK-B', nombre: 'Caja B', propietario_id: 'AG-B' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente B' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente B',
    total: 0,
    movimiento: {
      montoInicial: 0,
      pagosDia: 0,
      saldoTotal: 0,
    },
    bancos: [
      { banco_id: 'BK-B', banco: 'Caja B', saldo: 0 },
    ],
  });
});

test('agente con caja inicial por banco suma saldo y montoInicial', async () => {
  const service = loadBalanceService({
    cajaInicioMesByBanco: {
      'BK-1': { value: 500, fecha_efectiva: '2026-04-01' },
      'BK-2': { value: 200, fecha_efectiva: '2026-04-01' },
    },
  });
  const context = buildContext({
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'Caja 2', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1', fecha: '2026-04-20' }, context);

  assert.deepStrictEqual(result, {
    fecha: '2026-04-20',
    agente: 'Agente 1',
    total: 700,
    movimiento: {
      montoInicial: 700,
      pagosDia: 0,
      saldoTotal: 700,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 500 },
      { banco_id: 'BK-2', banco: 'Caja 2', saldo: 200 },
    ],
  });
});

test('fecha consultada anterior a fecha efectiva no aplica el monto inicial del banco', async () => {
  const service = loadBalanceService({
    cajaInicioMesByBanco: {
      'BK-1': { value: 500, fecha_efectiva: '2026-04-21' },
      'BK-2': { value: 200, fecha_efectiva: '2026-04-01' },
    },
  });
  const context = buildContext({
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'Caja 2', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1', fecha: '2026-04-20' }, context);

  assert.deepStrictEqual(result, {
    fecha: '2026-04-20',
    agente: 'Agente 1',
    total: 200,
    movimiento: {
      montoInicial: 200,
      pagosDia: 0,
      saldoTotal: 200,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 0 },
      { banco_id: 'BK-2', banco: 'Caja 2', saldo: 200 },
    ],
  });
});

test('desglose por banco correcto con dos bancos independientes', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 200, fecha_movimiento: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-2', banco: 'Caja 2', monto: 300, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 50, fecha_comprobante: '2026-04-20', estado: 'activo' },
      { agente: 'Agente 1', banco_id: 'BK-2', banco: 'Caja 2', monto: 120, fecha_comprobante: '2026-04-20', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'Caja 2', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 330,
    movimiento: {
      montoInicial: 0,
      pagosDia: 170,
      saldoTotal: -170,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 150 },
      { banco_id: 'BK-2', banco: 'Caja 2', saldo: 180 },
    ],
  });
});

test('montoInicial del primer dia disponible queda en cero aunque el saldo total sea negativo', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 25, fecha_comprobante: '2026-04-01', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
    todayDate: '2026-04-20',
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1', fecha: '2026-04-01' }, context);

  assert.deepStrictEqual(result, {
    fecha: '2026-04-01',
    agente: 'Agente 1',
    total: -25,
    movimiento: {
      montoInicial: 0,
      pagosDia: 25,
      saldoTotal: -25,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: -25 },
    ],
  });
});

test('ingresos del dia incrementan total y detalle pero no pagosDia', async () => {
  const service = loadBalanceService();
  const context = buildContext({
    ingresos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 70, fecha_movimiento: '2026-04-20', estado: 'activo' },
    ],
    pagos: [
      { agente: 'Agente 1', banco_id: 'BK-1', banco: 'Caja 1', monto: 20, fecha_comprobante: '2026-04-20', estado: 'activo' },
    ],
    agentes: [
      { id: 'AG-1', nombre: 'Agente 1', username: 'agente1' },
    ],
    bancos: [
      { id: 'BK-1', nombre: 'Caja 1', propietario_id: 'AG-1' },
    ],
  });

  const result = await service.getAgentCajaAt({ agente: 'Agente 1' }, context);

  assert.deepStrictEqual(result, {
    fecha: null,
    agente: 'Agente 1',
    total: 50,
    movimiento: {
      montoInicial: 0,
      pagosDia: 20,
      saldoTotal: -20,
    },
    bancos: [
      { banco_id: 'BK-1', banco: 'Caja 1', saldo: 50 },
    ],
  });
});
