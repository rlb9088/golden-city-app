const auditService = require('../services/audit.service');

async function getAuditLogs(req, res) {
  const { limit, offset, ...filters } = req.query;
  const data = await auditService.getPagedAndFiltered(filters, limit, offset);
  res.json({ status: 'success', data });
}

module.exports = { getAuditLogs };
