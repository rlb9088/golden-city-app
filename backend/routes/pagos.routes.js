const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { pagoSchema, pagoUpdateSchema } = require('../schemas/pagos.schema');

router.post('/', verifyToken, requireAuth, validate(pagoSchema), controller.create);
router.get('/', verifyToken, requireAuth, controller.getAll);
router.get('/:id', verifyToken, requireAuth, controller.getById);
router.put('/:id', verifyToken, requireAdmin, validate(pagoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, controller.remove);

module.exports = router;
