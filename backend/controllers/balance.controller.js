const balanceService = require('../services/balance.service');

async function getGlobal(req, res) {
  const balance = await balanceService.getBalanceAt({ fecha: req.validatedQuery?.fecha || null });
  res.json({ status: 'success', data: balance });
}

async function getByAgent(req, res) {
  const { agente } = req.params;
  const balance = await balanceService.getAgentBalance(agente);
  res.json({ status: 'success', data: balance });
}

module.exports = { getGlobal, getByAgent };
