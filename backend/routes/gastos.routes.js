const express = require('express');
const router = express.Router();
const controller = require('../controllers/gastos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { gastoSchema, gastoUpdateSchema } = require('../schemas/gastos.schema');

router.post('/', verifyToken, requireAdmin, validate(gastoSchema), controller.create);
router.get('/', verifyToken, requireAuth, controller.getPagedAndFiltered);
router.get('/:id', verifyToken, requireAuth, controller.getById);
router.put('/:id', verifyToken, requireAdmin, validate(gastoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, controller.remove);

module.exports = router;
