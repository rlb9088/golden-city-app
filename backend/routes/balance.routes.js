const express = require('express');
const router = express.Router();
const controller = require('../controllers/balance.controller');
const { validateQuery } = require('../middleware/validateQuery.middleware');
const { verifyToken, requireAuth } = require('../middleware/auth.middleware');
const { balanceQuerySchema } = require('../schemas/balance.schema');

router.get('/', verifyToken, requireAuth, validateQuery(balanceQuerySchema), controller.getGlobal);
router.get('/:agente', verifyToken, requireAuth, controller.getByAgent);

module.exports = router;
