const gastosService = require('../services/gastos.service');

async function create(req, res) {
  const { record, warnings } = await gastosService.create(req.validatedData, req.auth);
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getPagedAndFiltered(req, res) {
  const {
    categoria,
    desde,
    hasta,
    limit,
    offset,
  } = req.query;
  const gastos = await gastosService.getPagedAndFiltered({
    categoria,
    desde,
    hasta,
  }, limit, offset);
  res.json({ status: 'success', data: gastos });
}

async function update(req, res) {
  const { id } = req.params;
  const gasto = await gastosService.update(id, req.validatedData, req.auth);
  res.json({ status: 'success', data: gasto });
}

async function cancel(req, res) {
  const { id } = req.params;
  const { motivo } = req.validatedData;
  const gasto = await gastosService.cancel(id, motivo, req.auth);
  res.json({ status: 'success', data: gasto });
}

module.exports = {
  create,
  getPagedAndFiltered,
  update,
  cancel,
};
