const path = require('path');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { todayLima } = require('../config/timezone');
const balanceService = require('../services/balance.service');
const configService = require('../services/config.service');
const ingresosService = require('../services/ingresos.service');
const pagosService = require('../services/pagos.service');

function buildCaller(agent) {
  return {
    userId: agent.id,
    nombre: agent.nombre,
    username: agent.username,
    role: agent.role,
  };
}

function getDateBounds(referenceDate = todayLima()) {
  const monthKey = String(referenceDate).slice(0, 7);

  return {
    startDate: `${monthKey}-01`,
    midDate: `${monthKey}-15`,
    endDate: referenceDate,
  };
}

function createExpectedSnapshot({
  fecha,
  agente,
  total,
  montoInicial,
  pagosDia,
  saldoTotal,
  bancos,
}) {
  return {
    fecha,
    agente,
    total,
    movimiento: {
      montoInicial,
      pagosDia,
      saldoTotal,
    },
    bancos,
  };
}

function getBankSummary(result) {
  return result.bancos.map((bank) => `${bank.banco_id}:${bank.saldo}`).join(', ');
}

async function seedScenario() {
  const { startDate, midDate, endDate } = getDateBounds();
  const suffix = Date.now();

  const agentA = await configService.addToTable('agentes', {
    nombre: `Mi Caja A ${suffix}`,
    username: `mi-caja-a-${suffix}`,
    password_hash: `hash-a-${suffix}`,
    role: 'agent',
    activo: true,
  }, 'system');

  const agentB = await configService.addToTable('agentes', {
    nombre: `Mi Caja B ${suffix}`,
    username: `mi-caja-b-${suffix}`,
    password_hash: `hash-b-${suffix}`,
    role: 'agent',
    activo: true,
  }, 'system');

  const agentACaller = buildCaller(agentA);
  const agentBCaller = buildCaller(agentB);

  const bankA1 = await configService.addToTable('bancos', {
    nombre: `Caja A1 ${suffix}`,
    propietario: agentA.nombre,
    propietario_id: agentA.id,
  }, 'system');

  const bankA2 = await configService.addToTable('bancos', {
    nombre: `Caja A2 ${suffix}`,
    propietario: agentA.nombre,
    propietario_id: agentA.id,
  }, 'system');

  const bankB1 = await configService.addToTable('bancos', {
    nombre: `Caja B1 ${suffix}`,
    propietario: agentB.nombre,
    propietario_id: agentB.id,
  }, 'system');

  const bankB2 = await configService.addToTable('bancos', {
    nombre: `Caja B2 ${suffix}`,
    propietario: agentB.nombre,
    propietario_id: agentB.id,
  }, 'system');

  await ingresosService.create({
    agente: agentA.nombre,
    banco_id: bankA1.id,
    monto: 120,
    fecha_movimiento: startDate,
  }, agentACaller);

  await pagosService.create({
    usuario: `Pago A1 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankA2.id,
    monto: 20,
    tipo: 'Transferencia',
    fecha_comprobante: startDate,
  }, agentACaller);

  await ingresosService.create({
    agente: agentB.nombre,
    banco_id: bankB1.id,
    monto: 200,
    fecha_movimiento: startDate,
  }, agentBCaller);

  await pagosService.create({
    usuario: `Pago B1 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankB2.id,
    monto: 40,
    tipo: 'Transferencia',
    fecha_comprobante: startDate,
  }, agentBCaller);

  await ingresosService.create({
    agente: agentA.nombre,
    banco_id: bankA2.id,
    monto: 45,
    fecha_movimiento: midDate,
  }, agentACaller);

  await pagosService.create({
    usuario: `Pago A2 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankA1.id,
    monto: 10,
    tipo: 'Transferencia',
    fecha_comprobante: midDate,
  }, agentACaller);

  await ingresosService.create({
    agente: agentB.nombre,
    banco_id: bankB2.id,
    monto: 60,
    fecha_movimiento: midDate,
  }, agentBCaller);

  await pagosService.create({
    usuario: `Pago B2 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankB1.id,
    monto: 25,
    tipo: 'Transferencia',
    fecha_comprobante: midDate,
  }, agentBCaller);

  await ingresosService.create({
    agente: agentA.nombre,
    banco_id: bankA1.id,
    monto: 30,
    fecha_movimiento: endDate,
  }, agentACaller);

  await pagosService.create({
    usuario: `Pago A3 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankA2.id,
    monto: 15,
    tipo: 'Transferencia',
    fecha_comprobante: endDate,
  }, agentACaller);

  await ingresosService.create({
    agente: agentB.nombre,
    banco_id: bankB1.id,
    monto: 20,
    fecha_movimiento: endDate,
  }, agentBCaller);

  await pagosService.create({
    usuario: `Pago B3 ${suffix}`,
    caja: 'Caja 1',
    banco_id: bankB2.id,
    monto: 10,
    tipo: 'Transferencia',
    fecha_comprobante: endDate,
  }, agentBCaller);

  return {
    agentA,
    agentB,
    bankA1,
    bankA2,
    bankB1,
    bankB2,
    startDate,
    midDate,
    endDate,
  };
}

async function main() {
  const mode = process.env.GOOGLE_CREDENTIALS_BASE64 && process.env.GOOGLE_SHEET_ID
    ? 'Google Sheets'
    : 'In-Memory';

  const seed = await seedScenario();

  const actual = {
    startA: await balanceService.getAgentCajaAt({ agente: seed.agentA.nombre, fecha: seed.startDate }),
    midA: await balanceService.getAgentCajaAt({ agente: seed.agentA.nombre, fecha: seed.midDate }),
    nowA: await balanceService.getAgentCajaAt({ agente: seed.agentA.nombre }),
    startB: await balanceService.getAgentCajaAt({ agente: seed.agentB.nombre, fecha: seed.startDate }),
    midB: await balanceService.getAgentCajaAt({ agente: seed.agentB.nombre, fecha: seed.midDate }),
    nowB: await balanceService.getAgentCajaAt({ agente: seed.agentB.nombre }),
  };

  const expected = {
    startA: createExpectedSnapshot({
      fecha: seed.startDate,
      agente: seed.agentA.nombre,
      total: 100,
      montoInicial: 0,
      pagosDia: 20,
      saldoTotal: -20,
      bancos: [
        { banco_id: seed.bankA1.id, banco: seed.bankA1.nombre, saldo: 120 },
        { banco_id: seed.bankA2.id, banco: seed.bankA2.nombre, saldo: -20 },
      ],
    }),
    midA: createExpectedSnapshot({
      fecha: seed.midDate,
      agente: seed.agentA.nombre,
      total: 135,
      montoInicial: 100,
      pagosDia: 10,
      saldoTotal: 90,
      bancos: [
        { banco_id: seed.bankA1.id, banco: seed.bankA1.nombre, saldo: 110 },
        { banco_id: seed.bankA2.id, banco: seed.bankA2.nombre, saldo: 25 },
      ],
    }),
    nowA: createExpectedSnapshot({
      fecha: null,
      agente: seed.agentA.nombre,
      total: 150,
      montoInicial: 135,
      pagosDia: 15,
      saldoTotal: 120,
      bancos: [
        { banco_id: seed.bankA1.id, banco: seed.bankA1.nombre, saldo: 140 },
        { banco_id: seed.bankA2.id, banco: seed.bankA2.nombre, saldo: 10 },
      ],
    }),
    startB: createExpectedSnapshot({
      fecha: seed.startDate,
      agente: seed.agentB.nombre,
      total: 160,
      montoInicial: 0,
      pagosDia: 40,
      saldoTotal: -40,
      bancos: [
        { banco_id: seed.bankB1.id, banco: seed.bankB1.nombre, saldo: 200 },
        { banco_id: seed.bankB2.id, banco: seed.bankB2.nombre, saldo: -40 },
      ],
    }),
    midB: createExpectedSnapshot({
      fecha: seed.midDate,
      agente: seed.agentB.nombre,
      total: 195,
      montoInicial: 160,
      pagosDia: 25,
      saldoTotal: 135,
      bancos: [
        { banco_id: seed.bankB1.id, banco: seed.bankB1.nombre, saldo: 175 },
        { banco_id: seed.bankB2.id, banco: seed.bankB2.nombre, saldo: 20 },
      ],
    }),
    nowB: createExpectedSnapshot({
      fecha: null,
      agente: seed.agentB.nombre,
      total: 205,
      montoInicial: 195,
      pagosDia: 10,
      saldoTotal: 185,
      bancos: [
        { banco_id: seed.bankB1.id, banco: seed.bankB1.nombre, saldo: 195 },
        { banco_id: seed.bankB2.id, banco: seed.bankB2.nombre, saldo: 10 },
      ],
    }),
  };

  assert.deepStrictEqual(actual.startA, expected.startA, 'Start snapshot for agent A does not match');
  assert.deepStrictEqual(actual.midA, expected.midA, 'Mid snapshot for agent A does not match');
  assert.deepStrictEqual(actual.nowA, expected.nowA, 'Now snapshot for agent A does not match');
  assert.deepStrictEqual(actual.startB, expected.startB, 'Start snapshot for agent B does not match');
  assert.deepStrictEqual(actual.midB, expected.midB, 'Mid snapshot for agent B does not match');
  assert.deepStrictEqual(actual.nowB, expected.nowB, 'Now snapshot for agent B does not match');

  const agentABankIds = new Set([seed.bankA1.id, seed.bankA2.id]);
  const agentBBankIds = new Set([seed.bankB1.id, seed.bankB2.id]);

  assert(actual.nowA.bancos.every((bank) => agentABankIds.has(bank.banco_id)), 'Agent A result leaked a bank from agent B');
  assert(actual.nowB.bancos.every((bank) => agentBBankIds.has(bank.banco_id)), 'Agent B result leaked a bank from agent A');
  assert(!actual.nowA.bancos.some((bank) => agentBBankIds.has(bank.banco_id)), 'Agent A result contains data from agent B');
  assert(!actual.nowB.bancos.some((bank) => agentABankIds.has(bank.banco_id)), 'Agent B result contains data from agent A');

  console.log('[MiCajaE2E] OK');
  console.log(JSON.stringify({
    mode,
    dates: {
      start: seed.startDate,
      mid: seed.midDate,
      now: seed.endDate,
    },
    results: {
      agentA: {
        start: actual.startA,
        mid: actual.midA,
        now: actual.nowA,
      },
      agentB: {
        start: actual.startB,
        mid: actual.midB,
        now: actual.nowB,
      },
    },
    summary: {
      agentA: getBankSummary(actual.nowA),
      agentB: getBankSummary(actual.nowB),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error('[MiCajaE2E] Error:', error.message);
  process.exitCode = 1;
});
