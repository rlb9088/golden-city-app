const ingresosService = require('../services/ingresos.service');

async function create(req, res) {
  const { record, warnings } = await ingresosService.create(req.validatedData, req.auth.user);
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getAll(req, res) {
  const { agente, limit, offset } = req.query;
  const ingresos = await ingresosService.getPaged(limit, offset, { agente });
  res.json({ status: 'success', data: ingresos });
}

async function update(req, res) {
  const { id } = req.params;
  const ingreso = await ingresosService.update(id, req.validatedData, req.auth.user);
  res.json({ status: 'success', data: ingreso });
}

async function cancel(req, res) {
  const { id } = req.params;
  const { motivo } = req.validatedData;
  const ingreso = await ingresosService.cancel(id, motivo, req.auth.user);
  res.json({ status: 'success', data: ingreso });
}

module.exports = { create, getAll, update, cancel };
