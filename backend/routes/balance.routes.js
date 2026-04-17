const express = require('express');
const router = express.Router();
const controller = require('../controllers/balance.controller');
const { verifyToken, requireAuth } = require('../middleware/auth.middleware');

router.get('/', verifyToken, requireAuth, controller.getGlobal);
router.get('/:agente', verifyToken, requireAuth, controller.getByAgent);

module.exports = router;
