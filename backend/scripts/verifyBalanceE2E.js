const path = require('path');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { todayLima } = require('../config/timezone');
const balanceService = require('../services/balance.service');
const bancosService = require('../services/bancos.service');
const ingresosService = require('../services/ingresos.service');
const pagosService = require('../services/pagos.service');
const gastosService = require('../services/gastos.service');
const configService = require('../services/config.service');

function getMonthBounds(referenceDate = todayLima()) {
  const monthKey = String(referenceDate).slice(0, 7);
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  return {
    startDate: `${monthKey}-01`,
    midDate: `${monthKey}-15`,
    endDate: new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10),
    previousMonthEndDate: new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10),
  };
}

function buildCaller(agent) {
  return {
    userId: agent.id,
    nombre: agent.nombre,
    username: agent.username,
    role: agent.role,
  };
}

function expectedSnapshot({
  date,
  adminBankA,
  adminBankB,
  agentOneBank,
  agentTwoBank,
  agentOne,
  agentTwo,
  totalGastosDetalle,
  totalGastos,
  balanceDia,
  balanceAcumulado,
  cajaInicioMes,
}) {
  return {
    fecha: date,
    bancosAdmin: {
      total: adminBankA.saldo + adminBankB.saldo,
      detalle: [
        { banco_id: adminBankA.id, banco: adminBankA.nombre, saldo: adminBankA.saldo },
        { banco_id: adminBankB.id, banco: adminBankB.nombre, saldo: adminBankB.saldo },
      ],
    },
    cajasAgentes: {
      total: agentOneBank.saldo + agentTwoBank.saldo,
      detalle: [
        {
          agente: agentOne.nombre,
          bancos: [
            { banco_id: agentOneBank.id, banco: agentOneBank.nombre, saldo: agentOneBank.saldo },
          ],
        },
        {
          agente: agentTwo.nombre,
          bancos: [
            { banco_id: agentTwoBank.id, banco: agentTwoBank.nombre, saldo: agentTwoBank.saldo },
          ],
        },
      ],
    },
    totalGastos: {
      total: totalGastos,
      detalle: totalGastosDetalle,
    },
    balanceDia,
    balanceAcumulado,
    cajaInicioMes,
  };
}

async function seedScenario() {
  const { startDate, midDate, endDate, previousMonthEndDate } = getMonthBounds();
  const suffix = Date.now();

  const adminAgent = await configService.addToTable('agentes', {
    nombre: `Admin Balance UAT ${suffix}`,
    username: `uat-balance-admin-${suffix}`,
    password: `Admin-${suffix}-Pass!`,
    role: 'admin',
    activo: true,
  }, 'system');

  const agentOne = await configService.addToTable('agentes', {
    nombre: `Agente Balance UAT 1 ${suffix}`,
    username: `uat-balance-agent-1-${suffix}`,
    password: `Agent-1-${suffix}-Pass!`,
    role: 'agent',
    activo: true,
  }, 'system');

  const agentTwo = await configService.addToTable('agentes', {
    nombre: `Agente Balance UAT 2 ${suffix}`,
    username: `uat-balance-agent-2-${suffix}`,
    password: `Agent-2-${suffix}-Pass!`,
    role: 'agent',
    activo: true,
  }, 'system');

  const adminCaller = buildCaller(adminAgent);
  const agentOneCaller = buildCaller(agentOne);
  const agentTwoCaller = buildCaller(agentTwo);

  const adminBankA = await configService.addToTable('bancos', {
    nombre: `UAT Banco Admin A ${suffix}`,
    propietario_id: adminAgent.id,
  }, adminCaller);

  const adminBankB = await configService.addToTable('bancos', {
    nombre: `UAT Banco Admin B ${suffix}`,
    propietario_id: adminAgent.id,
  }, adminCaller);

  const agentOneBank = await configService.addToTable('bancos', {
    nombre: `UAT Caja Agente 1 ${suffix}`,
    propietario_id: agentOne.id,
  }, agentOneCaller);

  const agentTwoBank = await configService.addToTable('bancos', {
    nombre: `UAT Caja Agente 2 ${suffix}`,
    propietario_id: agentTwo.id,
  }, agentTwoCaller);

  await configService.upsertSetting('caja_inicio_mes', {
    value: 500,
    fecha_efectiva: startDate,
  }, adminCaller);

  await bancosService.upsert({
    fecha: previousMonthEndDate,
    banco_id: adminBankA.id,
    saldo: 1000,
  }, adminCaller);

  await bancosService.upsert({
    fecha: previousMonthEndDate,
    banco_id: adminBankB.id,
    saldo: 500,
  }, adminCaller);

  await bancosService.upsert({
    fecha: startDate,
    banco_id: adminBankA.id,
    saldo: 1000,
  }, adminCaller);

  await bancosService.upsert({
    fecha: startDate,
    banco_id: adminBankB.id,
    saldo: 500,
  }, adminCaller);

  await bancosService.upsert({
    fecha: midDate,
    banco_id: adminBankA.id,
    saldo: 1100,
  }, adminCaller);

  await bancosService.upsert({
    fecha: midDate,
    banco_id: adminBankB.id,
    saldo: 560,
  }, adminCaller);

  await bancosService.upsert({
    fecha: endDate,
    banco_id: adminBankA.id,
    saldo: 1200,
  }, adminCaller);

  await bancosService.upsert({
    fecha: endDate,
    banco_id: adminBankB.id,
    saldo: 640,
  }, adminCaller);

  await ingresosService.create({
    agente: agentOne.nombre,
    banco_id: agentOneBank.id,
    monto: 300,
    fecha_movimiento: startDate,
  }, agentOneCaller);

  await pagosService.create({
    usuario: `UAT Pago A ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentOneBank.id,
    monto: 50,
    tipo: 'Transferencia',
    fecha_comprobante: startDate,
  }, agentOneCaller);

  await ingresosService.create({
    agente: agentTwo.nombre,
    banco_id: agentTwoBank.id,
    monto: 200,
    fecha_movimiento: startDate,
  }, agentTwoCaller);

  await pagosService.create({
    usuario: `UAT Pago B ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentTwoBank.id,
    monto: 20,
    tipo: 'Transferencia',
    fecha_comprobante: startDate,
  }, agentTwoCaller);

  await gastosService.create({
    concepto: `UAT Gasto Inicio ${suffix}`,
    categoria: 'Operativo',
    subcategoria: 'Limpieza',
    banco_id: adminBankA.id,
    monto: 30,
    fecha_gasto: startDate,
  }, adminCaller);

  await gastosService.create({
    concepto: `UAT Gasto Inicio 2 ${suffix}`,
    categoria: 'Personal',
    subcategoria: 'Nominas',
    banco_id: adminBankA.id,
    monto: 40,
    fecha_gasto: startDate,
  }, adminCaller);

  await ingresosService.create({
    agente: agentOne.nombre,
    banco_id: agentOneBank.id,
    monto: 100,
    fecha_movimiento: midDate,
  }, agentOneCaller);

  await pagosService.create({
    usuario: `UAT Pago C ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentOneBank.id,
    monto: 70,
    tipo: 'Transferencia',
    fecha_comprobante: midDate,
  }, agentOneCaller);

  await ingresosService.create({
    agente: agentTwo.nombre,
    banco_id: agentTwoBank.id,
    monto: 50,
    fecha_movimiento: midDate,
  }, agentTwoCaller);

  await pagosService.create({
    usuario: `UAT Pago D ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentTwoBank.id,
    monto: 10,
    tipo: 'Transferencia',
    fecha_comprobante: midDate,
  }, agentTwoCaller);

  await gastosService.create({
    concepto: `UAT Gasto Medio ${suffix}`,
    categoria: 'Operativo',
    subcategoria: 'Mantenimiento',
    banco_id: adminBankA.id,
    monto: 20,
    fecha_gasto: midDate,
  }, adminCaller);

  await gastosService.create({
    concepto: `UAT Gasto Medio 2 ${suffix}`,
    categoria: 'Servicios',
    subcategoria: 'Luz',
    banco_id: adminBankA.id,
    monto: 30,
    fecha_gasto: midDate,
  }, adminCaller);

  await ingresosService.create({
    agente: agentOne.nombre,
    banco_id: agentOneBank.id,
    monto: 200,
    fecha_movimiento: endDate,
  }, agentOneCaller);

  await pagosService.create({
    usuario: `UAT Pago E ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentOneBank.id,
    monto: 60,
    tipo: 'Transferencia',
    fecha_comprobante: endDate,
  }, agentOneCaller);

  await ingresosService.create({
    agente: agentTwo.nombre,
    banco_id: agentTwoBank.id,
    monto: 100,
    fecha_movimiento: endDate,
  }, agentTwoCaller);

  await pagosService.create({
    usuario: `UAT Pago F ${suffix}`,
    caja: 'Caja 1',
    banco_id: agentTwoBank.id,
    monto: 30,
    tipo: 'Transferencia',
    fecha_comprobante: endDate,
  }, agentTwoCaller);

  await gastosService.create({
    concepto: `UAT Gasto Fin ${suffix}`,
    categoria: 'Operativo',
    subcategoria: 'Limpieza',
    banco_id: adminBankA.id,
    monto: 40,
    fecha_gasto: endDate,
  }, adminCaller);

  await gastosService.create({
    concepto: `UAT Gasto Fin 2 ${suffix}`,
    categoria: 'Servicios',
    subcategoria: 'Internet',
    banco_id: adminBankA.id,
    monto: 50,
    fecha_gasto: endDate,
  }, adminCaller);

  return {
    startDate,
    midDate,
    endDate,
    previousMonthEndDate,
    adminBankA,
    adminBankB,
    agentOneBank,
    agentTwoBank,
    agentOne,
    agentTwo,
    cajaInicioMes: 500,
  };
}

async function main() {
  const mode = process.env.GOOGLE_CREDENTIALS_BASE64 && process.env.GOOGLE_SHEET_ID
    ? 'Google Sheets'
    : 'In-Memory';

  const seed = await seedScenario();

  const actual = {
    start: await balanceService.getBalanceAt({ fecha: seed.startDate }),
    mid: await balanceService.getBalanceAt({ fecha: seed.midDate }),
    end: await balanceService.getBalanceAt({ fecha: seed.endDate }),
  };

  const expected = {
    start: expectedSnapshot({
      date: seed.startDate,
      adminBankA: { id: seed.adminBankA.id, nombre: seed.adminBankA.nombre, saldo: 1000 },
      adminBankB: { id: seed.adminBankB.id, nombre: seed.adminBankB.nombre, saldo: 500 },
      agentOneBank: { id: seed.agentOneBank.id, nombre: seed.agentOneBank.nombre, saldo: 250 },
      agentTwoBank: { id: seed.agentTwoBank.id, nombre: seed.agentTwoBank.nombre, saldo: 180 },
      agentOne: seed.agentOne,
      agentTwo: seed.agentTwo,
      totalGastosDetalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30 },
        { categoria: 'Personal', subcategoria: 'Nominas', monto: 40 },
      ],
      totalGastos: 70,
      balanceDia: 360,
      balanceAcumulado: 1360,
      cajaInicioMes: seed.cajaInicioMes,
    }),
    mid: expectedSnapshot({
      date: seed.midDate,
      adminBankA: { id: seed.adminBankA.id, nombre: seed.adminBankA.nombre, saldo: 1100 },
      adminBankB: { id: seed.adminBankB.id, nombre: seed.adminBankB.nombre, saldo: 560 },
      agentOneBank: { id: seed.agentOneBank.id, nombre: seed.agentOneBank.nombre, saldo: 280 },
      agentTwoBank: { id: seed.agentTwoBank.id, nombre: seed.agentTwoBank.nombre, saldo: 220 },
      agentOne: seed.agentOne,
      agentTwo: seed.agentTwo,
      totalGastosDetalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 30 },
        { categoria: 'Operativo', subcategoria: 'Mantenimiento', monto: 20 },
        { categoria: 'Personal', subcategoria: 'Nominas', monto: 40 },
        { categoria: 'Servicios', subcategoria: 'Luz', monto: 30 },
      ],
      totalGastos: 120,
      balanceDia: 180,
      balanceAcumulado: 1540,
      cajaInicioMes: seed.cajaInicioMes,
    }),
    end: expectedSnapshot({
      date: seed.endDate,
      adminBankA: { id: seed.adminBankA.id, nombre: seed.adminBankA.nombre, saldo: 1200 },
      adminBankB: { id: seed.adminBankB.id, nombre: seed.adminBankB.nombre, saldo: 640 },
      agentOneBank: { id: seed.agentOneBank.id, nombre: seed.agentOneBank.nombre, saldo: 420 },
      agentTwoBank: { id: seed.agentTwoBank.id, nombre: seed.agentTwoBank.nombre, saldo: 290 },
      agentOne: seed.agentOne,
      agentTwo: seed.agentTwo,
      totalGastosDetalle: [
        { categoria: 'Operativo', subcategoria: 'Limpieza', monto: 70 },
        { categoria: 'Operativo', subcategoria: 'Mantenimiento', monto: 20 },
        { categoria: 'Personal', subcategoria: 'Nominas', monto: 40 },
        { categoria: 'Servicios', subcategoria: 'Internet', monto: 50 },
        { categoria: 'Servicios', subcategoria: 'Luz', monto: 30 },
      ],
      totalGastos: 210,
      balanceDia: 300,
      balanceAcumulado: 1840,
      cajaInicioMes: seed.cajaInicioMes,
    }),
  };

  assert.deepStrictEqual(actual.start, expected.start);
  assert.deepStrictEqual(actual.mid, expected.mid);
  assert.deepStrictEqual(actual.end, expected.end);

  console.log('[BalanceE2E] OK');
  console.log(JSON.stringify({
    mode,
    dates: {
      start: seed.startDate,
      mid: seed.midDate,
      end: seed.endDate,
      previousMonthEnd: seed.previousMonthEndDate,
    },
    results: actual,
  }, null, 2));
}

main().catch((error) => {
  console.error('[BalanceE2E] Error:', error.message);
  process.exitCode = 1;
});
