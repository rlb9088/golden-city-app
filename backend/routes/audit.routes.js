const express = require('express');
const router = express.Router();
const controller = require('../controllers/audit.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

router.get('/', verifyToken, requireAdmin, controller.getAuditLogs);

module.exports = router;
