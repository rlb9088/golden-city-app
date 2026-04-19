const express = require('express');
const router = express.Router();
const controller = require('../controllers/bancos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { bancoSchema } = require('../schemas/bancos.schema');

router.post('/', verifyToken, requireAdmin, validate(bancoSchema), controller.create);
router.get('/scoped', verifyToken, requireAuth, controller.getScoped);
router.get('/', verifyToken, requireAuth, controller.getPagedAndFiltered);

module.exports = router;
