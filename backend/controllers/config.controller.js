const configService = require('../services/config.service');
const { BadRequestError } = require('../utils/appError');

async function getFullConfig(req, res) {
  const config = await configService.getFullConfig();
  res.json({ status: 'success', data: config });
}

async function getTable(req, res) {
  const { table } = req.params;
  const data = await configService.getTable(table);
  res.json({ status: 'success', data });
}

async function addToTable(req, res) {
  const { table } = req.params;
  const record = await configService.addToTable(table, req.body, req.auth.user);
  res.status(201).json({ status: 'success', data: record });
}

async function removeFromTable(req, res) {
  const { table, id } = req.params;
  const result = await configService.removeFromTable(table, id, req.auth.user);
  res.json({ status: 'success', data: result });
}

async function importBatch(req, res) {
  const { table } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    throw new BadRequestError('Se requiere un array de items.', {
      context: {
        table,
      },
    });
  }

  const results = await configService.importBatch(table, items, req.auth.user);
  res.status(201).json({ status: 'success', data: results, count: results.length });
}

module.exports = { getFullConfig, getTable, addToTable, removeFromTable, importBatch };
