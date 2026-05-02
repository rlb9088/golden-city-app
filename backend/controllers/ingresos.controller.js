const ingresosService = require('../services/ingresos.service');
const { NotFoundError } = require('../utils/appError');

async function create(req, res) {
  const { record, warnings } = await ingresosService.create(req.validatedData, req.auth);
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getPagedAndFiltered(req, res) {
  const {
    agente,
    banco,
    usuario,
    desde,
    hasta,
    limit,
    offset,
  } = req.query;
  const ingresos = await ingresosService.getPagedAndFiltered({
    agente,
    banco,
    usuario,
    desde,
    hasta,
  }, limit, offset);
  res.json({ status: 'success', data: ingresos });
}

async function getById(req, res) {
  const { id } = req.params;
  const ingreso = await ingresosService.getById(id);

  if (!ingreso) {
    throw new NotFoundError('No se encontró el ingreso solicitado.', {
      context: { id },
    });
  }

  res.json({ status: 'success', data: ingreso });
}

async function update(req, res) {
  const { id } = req.params;
  const ingreso = await ingresosService.update(id, req.validatedData, req.auth);
  res.json({ status: 'success', data: ingreso });
}

async function remove(req, res) {
  const { id } = req.params;
  const ingreso = await ingresosService.remove(id, req.auth);
  res.json({ status: 'success', data: ingreso });
}

module.exports = {
  create,
  getPagedAndFiltered,
  getById,
  update,
  remove,
};
