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

async function getSetting(req, res) {
  const { key } = req.params;
  const data = await configService.getSetting(key);
  res.json({ status: 'success', data });
}

async function upsertSetting(req, res) {
  const { key } = req.params;
  const payload = req.validatedData || req.body;
  const record = await configService.upsertSetting(key, payload, req.auth.user);
  res.json({ status: 'success', data: record });
}

async function getCajaInicioMesByBanco(req, res) {
  const { bancoId } = req.params;
  const data = await configService.getCajaInicioMesByBanco(bancoId);
  res.json({ status: 'success', data });
}

async function upsertCajaInicioMesByBanco(req, res) {
  const { bancoId } = req.params;
  const payload = req.validatedData || req.body;
  const key = `caja_inicio_mes:banco:${bancoId}`;
  const record = await configService.upsertSetting(key, payload, req.auth.user);
  res.json({ status: 'success', data: record });
}

async function addToTable(req, res) {
  const { table } = req.params;
  const record = await configService.addToTable(table, req.body, req.auth.user);
  res.status(201).json({ status: 'success', data: record });
}

async function updateInTable(req, res) {
  const { table, id } = req.params;
  const record = await configService.updateInTable(table, id, req.body, req.auth.user);
  res.json({ status: 'success', data: record });
}

async function changePassword(req, res) {
  const { table, id } = req.params;
  const { password } = req.body;
  if (table !== 'agentes') {
    throw new BadRequestError('El cambio de contrasena solo aplica a agentes.', {
      context: { table, id },
    });
  }
  const record = await configService.updateAgentPassword(id, password, req.auth.user);
  res.json({ status: 'success', data: record });
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

module.exports = {
  getFullConfig,
  getTable,
  getSetting,
  upsertSetting,
  getCajaInicioMesByBanco,
  upsertCajaInicioMesByBanco,
  addToTable,
  updateInTable,
  changePassword,
  removeFromTable,
  importBatch,
};
