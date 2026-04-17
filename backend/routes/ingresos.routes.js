const express = require('express');
const router = express.Router();
const controller = require('../controllers/ingresos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { ingresoSchema, ingresoUpdateSchema, ingresoCancelSchema } = require('../schemas/ingresos.schema');

router.post('/', verifyToken, requireAdmin, validate(ingresoSchema), controller.create);
router.get('/', verifyToken, requireAuth, controller.getAll);
router.put('/:id', verifyToken, requireAdmin, validate(ingresoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, validate(ingresoCancelSchema), controller.cancel);

module.exports = router;
