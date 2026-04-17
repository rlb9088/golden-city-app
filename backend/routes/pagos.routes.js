const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { pagoSchema, pagoUpdateSchema, pagoCancelSchema } = require('../schemas/pagos.schema');

router.post('/', verifyToken, requireAuth, validate(pagoSchema), controller.create);
router.get('/', verifyToken, requireAuth, controller.getAll);
router.put('/:id', verifyToken, requireAdmin, validate(pagoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, validate(pagoCancelSchema), controller.cancel);

module.exports = router;
