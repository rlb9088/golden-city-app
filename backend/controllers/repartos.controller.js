const repartosService = require('../services/repartos.service');
const { NotFoundError } = require('../utils/appError');

async function create(req, res) {
  const { record, warnings } = await repartosService.create(req.validatedData, req.auth);
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getPagedAndFiltered(req, res) {
  const { categoria, dominio, desde, hasta, limit, offset } = req.query;
  const repartos = await repartosService.getPagedAndFiltered({ categoria, dominio, desde, hasta }, limit, offset);
  res.json({ status: 'success', data: repartos });
}

async function getById(req, res) {
  const { id } = req.params;
  const reparto = await repartosService.getById(id);

  if (!reparto) {
    throw new NotFoundError('No se encontró el reparto solicitado.', { context: { id } });
  }

  res.json({ status: 'success', data: reparto });
}

async function update(req, res) {
  const reparto = await repartosService.update(req.params.id, req.validatedData, req.auth);
  res.json({ status: 'success', data: reparto });
}

async function remove(req, res) {
  const reparto = await repartosService.remove(req.params.id, req.auth);
  res.json({ status: 'success', data: reparto });
}

module.exports = { create, getPagedAndFiltered, getById, update, remove };
