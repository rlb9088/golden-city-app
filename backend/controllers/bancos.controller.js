const bancosService = require('../services/bancos.service');

async function create(req, res) {
  const result = await bancosService.upsert(req.validatedData, req.auth);
  const message = result.overwritten ? 'Saldo actualizado' : 'Saldo registrado';
  res.status(result.overwritten ? 200 : 201).json({ status: 'success', message, data: result });
}

async function getPagedAndFiltered(req, res) {
  const { agente, limit, offset } = req.query;
  const bancos = await bancosService.getPagedAndFiltered({
    agente,
  }, limit, offset);
  res.json({ status: 'success', data: bancos });
}

async function getScoped(req, res) {
  const bancos = await bancosService.getScopedBancos({
    caller: req.auth,
    agenteId: req.query.agente_id,
  });
  res.json({ status: 'success', data: bancos });
}

module.exports = {
  create,
  getPagedAndFiltered,
  getScoped,
};
