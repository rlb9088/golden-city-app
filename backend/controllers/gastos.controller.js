const gastosService = require('../services/gastos.service');
const { NotFoundError } = require('../utils/appError');

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

async function getById(req, res) {
  const { id } = req.params;
  const gasto = await gastosService.getById(id);

  if (!gasto) {
    throw new NotFoundError('No se encontró el gasto solicitado.', {
      context: { id },
    });
  }

  res.json({ status: 'success', data: gasto });
}

async function update(req, res) {
  const { id } = req.params;
  const gasto = await gastosService.update(id, req.validatedData, req.auth);
  res.json({ status: 'success', data: gasto });
}

async function remove(req, res) {
  const { id } = req.params;
  const gasto = await gastosService.remove(id, req.auth);
  res.json({ status: 'success', data: gasto });
}

module.exports = {
  create,
  getPagedAndFiltered,
  getById,
  update,
  remove,
};
