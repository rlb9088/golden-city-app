const express = require('express');
const router = express.Router();
const controller = require('../controllers/retiros-no-pagados.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { retiroNoPagadoSchema } = require('../schemas/retiros-no-pagados.schema');

const validateRetiroNoPagado = validate(retiroNoPagadoSchema);

router.post('/', verifyToken, requireAdmin, validateRetiroNoPagado, controller.create);
router.get('/', verifyToken, requireAdmin, controller.getPagedAndFiltered);

module.exports = router;
