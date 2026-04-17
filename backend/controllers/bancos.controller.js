const bancosService = require('../services/bancos.service');

async function create(req, res) {
  const result = await bancosService.upsert(req.validatedData, req.auth.user);
  const message = result.overwritten ? 'Saldo actualizado' : 'Saldo registrado';
  res.status(result.overwritten ? 200 : 201).json({ status: 'success', message, data: result });
}

async function getAll(req, res) {
  const bancos = await bancosService.getAll();
  res.json({ status: 'success', data: bancos });
}

module.exports = { create, getAll };
