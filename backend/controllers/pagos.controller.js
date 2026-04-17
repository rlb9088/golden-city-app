const pagosService = require('../services/pagos.service');

async function create(req, res) {
  const { record, warnings } = await pagosService.create(req.validatedData, req.auth.user);
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

async function update(req, res) {
  const { id } = req.params;
  const pago = await pagosService.update(id, req.validatedData, req.auth.user);
  res.json({ status: 'success', data: pago });
}

async function cancel(req, res) {
  const { id } = req.params;
  const { motivo } = req.validatedData;
  const pago = await pagosService.cancel(id, motivo, req.auth.user);
  res.json({ status: 'success', data: pago });
}

module.exports = { create, getAll, update, cancel };
