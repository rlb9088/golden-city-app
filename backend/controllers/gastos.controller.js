const gastosService = require('../services/gastos.service');

async function create(req, res) {
  const { record, warnings } = await gastosService.create(req.validatedData, req.auth.user);
  res.status(201).json({ status: 'success', data: record, warnings });
}

async function getAll(req, res) {
  const { limit, offset } = req.query;
  const gastos = await gastosService.getPaged(limit, offset);
  res.json({ status: 'success', data: gastos });
}

async function update(req, res) {
  const { id } = req.params;
  const gasto = await gastosService.update(id, req.validatedData, req.auth.user);
  res.json({ status: 'success', data: gasto });
}

async function cancel(req, res) {
  const { id } = req.params;
  const { motivo } = req.validatedData;
  const gasto = await gastosService.cancel(id, motivo, req.auth.user);
  res.json({ status: 'success', data: gasto });
}

module.exports = { create, getAll, update, cancel };
