const express = require('express');
const router = express.Router();
const controller = require('../controllers/depositos-totales.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { depositoTotalSchema } = require('../schemas/depositos-totales.schema');

const validateDepositoTotal = validate(depositoTotalSchema);

router.post('/', verifyToken, requireAdmin, validateDepositoTotal, controller.create);
router.get('/', verifyToken, requireAdmin, controller.getPagedAndFiltered);

module.exports = router;
