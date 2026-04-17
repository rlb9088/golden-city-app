const express = require('express');
const router = express.Router();
const controller = require('../controllers/gastos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { gastoSchema, gastoUpdateSchema, gastoCancelSchema } = require('../schemas/gastos.schema');

router.post('/', verifyToken, requireAdmin, validate(gastoSchema), controller.create);
router.get('/', verifyToken, requireAuth, controller.getAll);
router.put('/:id', verifyToken, requireAdmin, validate(gastoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, validate(gastoCancelSchema), controller.cancel);

module.exports = router;
