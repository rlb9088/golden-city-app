const pagosService = require('../services/pagos.service');
const { NotFoundError } = require('../utils/appError');

async function create(req, res) {
  const skipDuplicateCheck = req.headers['x-confirm-duplicate'] === 'true';
  const { record, warnings } = await pagosService.create(req.validatedData, req.auth, { skipDuplicateCheck });
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getAll(req, res) {
  const { agente, desde, hasta, banco, usuario, limit, offset } = req.query;
  const pagos = await pagosService.getPagedAndFiltered({
    agente,
    desde,
    hasta,
    banco,
    usuario,
  }, limit, offset);
  res.json({ status: 'success', data: pagos });
}

async function getById(req, res) {
  const { id } = req.params;
  const pago = await pagosService.getById(id);

  if (!pago) {
    throw new NotFoundError('No se encontró el pago solicitado.', {
      context: { id },
    });
  }

  res.json({ status: 'success', data: pago });
}

async function update(req, res) {
  const { id } = req.params;
  const pago = await pagosService.update(id, req.validatedData, req.auth);
  res.json({ status: 'success', data: pago });
}

async function remove(req, res) {
  const { id } = req.params;
  const pago = await pagosService.remove(id, req.auth);
  res.json({ status: 'success', data: pago });
}

module.exports = { create, getAll, getById, update, remove };
