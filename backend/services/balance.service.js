const ingresosService = require('./ingresos.service');
const pagosService = require('./pagos.service');
const gastosService = require('./gastos.service');
const bancosService = require('./bancos.service');

function isActivo(record) {
  return String(record?.estado ?? '').trim().toLowerCase() !== 'anulado';
}

/**
 * Calcula el balance de un agente específico.
 * Fórmula: sum(ingresos) - sum(pagos)
 * Siempre recalcula desde la fuente de verdad.
 */
async function getAgentBalance(agente) {
  const [ingresos, pagos] = await Promise.all([
    ingresosService.getByAgent(agente),
    pagosService.getByAgent(agente),
  ]);

  const totalIngresos = ingresos.filter(isActivo).reduce((sum, i) => sum + parseFloat(i.monto || 0), 0);
  const totalPagos = pagos.filter(isActivo).reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

  return {
    agente,
    ingresos: totalIngresos,
    pagos: totalPagos,
    balance: totalIngresos - totalPagos,
  };
}

/**
 * Calcula el balance global del sistema.
 * Fórmula: sum(cajas agentes) + sum(bancos) - sum(gastos)
 */
async function getGlobalBalance() {
  const [allIngresos, allPagos, allGastos, latestBancos] = await Promise.all([
    ingresosService.getAll(),
    pagosService.getAll(),
    gastosService.getAll(),
    bancosService.getLatest(),
  ]);

  // Calcular balances por agente
  const agentMap = {};
  allIngresos.forEach((i) => {
    if (!isActivo(i)) return;
    if (!agentMap[i.agente]) agentMap[i.agente] = { ingresos: 0, pagos: 0 };
    agentMap[i.agente].ingresos += parseFloat(i.monto || 0);
  });
  allPagos.forEach((p) => {
    if (!isActivo(p)) return;
    if (!agentMap[p.agente]) agentMap[p.agente] = { ingresos: 0, pagos: 0 };
    agentMap[p.agente].pagos += parseFloat(p.monto || 0);
  });

  const agents = Object.entries(agentMap).map(([agente, data]) => ({
    agente,
    ingresos: data.ingresos,
    pagos: data.pagos,
    balance: data.ingresos - data.pagos,
  }));

  const totalCajas = agents.reduce((sum, a) => sum + a.balance, 0);
  const totalBancos = latestBancos.reduce((sum, b) => sum + parseFloat(b.saldo || 0), 0);
  const totalGastos = allGastos.filter(isActivo).reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

  return {
    agents,
    bancos: latestBancos,
    totalCajas,
    totalBancos,
    totalGastos,
    global: totalCajas + totalBancos - totalGastos,
  };
}

module.exports = { getAgentBalance, getGlobalBalance };
