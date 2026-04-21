const balanceService = require('../services/balance.service');

async function getGlobal(req, res) {
  const balance = await balanceService.getBalanceAt({ fecha: req.validatedQuery?.fecha || null });
  res.json({ status: 'success', data: balance });
}

async function getMiCaja(req, res) {
  const agente = req.auth.user;
  const fecha = req.validatedQuery?.fecha || null;
  const caja = await balanceService.getAgentCajaAt({ agente, fecha });
  res.json({ status: 'success', data: caja });
}

async function getByAgent(req, res) {
  const { agente } = req.params;
  const balance = await balanceService.getAgentBalance(agente);
  res.json({ status: 'success', data: balance });
}

module.exports = { getGlobal, getMiCaja, getByAgent };
