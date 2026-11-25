const express = require('express');
const router = express.Router();
const controller = require('../controllers/repartos.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { repartoSchema, repartoUpdateSchema } = require('../schemas/repartos.schema');

// Modulo informativo: solo administradores (incluye lectura).
router.post('/', verifyToken, requireAdmin, validate(repartoSchema), controller.create);
router.get('/', verifyToken, requireAdmin, controller.getPagedAndFiltered);
router.get('/:id', verifyToken, requireAdmin, controller.getById);
router.put('/:id', verifyToken, requireAdmin, validate(repartoUpdateSchema), controller.update);
router.delete('/:id', verifyToken, requireAdmin, controller.remove);

module.exports = router;
