const express = require('express');
const router = express.Router();
const controller = require('../controllers/retiros-totales.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { retiroTotalSchema } = require('../schemas/retiros-totales.schema');

const validateRetiroTotal = validate(retiroTotalSchema);

router.post('/', verifyToken, requireAdmin, validateRetiroTotal, controller.create);
router.get('/', verifyToken, requireAdmin, controller.getPagedAndFiltered);

module.exports = router;
