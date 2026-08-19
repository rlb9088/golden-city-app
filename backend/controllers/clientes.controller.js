const clientesService = require('../services/clientes.service');
const { NotFoundError } = require('../utils/appError');

async function getAll(req, res) {
  const { q, estado, ciudad, limit, offset } = req.query;
  const data = await clientesService.getPagedAndFiltered({ q, estado, ciudad }, limit, offset);
  res.json({ status: 'success', data });
}

async function getById(req, res) {
  const cliente = await clientesService.getById(req.params.id);
  if (!cliente) {
    throw new NotFoundError('No se encontro el cliente solicitado.', {
      context: { id: req.params.id },
    });
  }
  res.json({ status: 'success', data: cliente });
}

async function create(req, res) {
  const cliente = await clientesService.create(req.validatedData, req.auth.user);
  res.status(201).json({ status: 'success', data: cliente });
}

async function update(req, res) {
  const cliente = await clientesService.update(req.params.id, req.validatedData, req.auth.user);
  res.json({ status: 'success', data: cliente });
}

async function importBatch(req, res) {
  const result = await clientesService.importBatch(req.validatedData.items, req.auth.user, req.validatedData.source);
  res.status(201).json({ status: 'success', data: result });
}

async function getHistory(req, res) {
  const data = await clientesService.getHistory(req.params.id);
  res.json({ status: 'success', data });
}

async function exportData(req, res) {
  const format = String(req.query.format || 'csv').toLowerCase() === 'xls' ? 'xls' : 'csv';
  const output = await clientesService.exportData(format);
  res.setHeader('Content-Type', output.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
  res.send(output.body);
}

async function runQualityReview(req, res) {
  const data = await clientesService.runQualityReview(req.auth.user, {
    limit: req.body?.limit,
    onlyPending: req.body?.onlyPending,
  });
  res.json({ status: 'success', data });
}

module.exports = { getAll, getById, create, update, importBatch, getHistory, exportData, runQualityReview };
