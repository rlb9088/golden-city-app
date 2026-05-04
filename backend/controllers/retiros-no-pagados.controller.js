const retirosNoPagadosService = require('../services/retiros-no-pagados.service');

async function create(req, res) {
  const result = await retirosNoPagadosService.upsert(req.validatedData, req.user || req.auth);
  const message = result.overwritten ? 'Monto actualizado' : 'Monto registrado';
  res.status(result.overwritten ? 200 : 201).json({ status: 'success', message, data: result });
}

async function getPagedAndFiltered(req, res) {
  const { caja, limit, offset } = req.query;
  const retirosNoPagados = await retirosNoPagadosService.getPagedAndFiltered({ caja }, limit, offset);
  res.json({ status: 'success', data: retirosNoPagados });
}

module.exports = {
  create,
  getPagedAndFiltered,
};
