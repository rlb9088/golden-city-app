const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientes.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { clienteCreateSchema, clienteUpdateSchema, clienteImportSchema } = require('../schemas/clientes.schema');

router.get('/', verifyToken, requireAuth, controller.getAll);
router.get('/export', verifyToken, requireAuth, controller.exportData);
router.post('/', verifyToken, requireAdmin, validate(clienteCreateSchema), controller.create);
router.post('/import', verifyToken, requireAdmin, validate(clienteImportSchema), controller.importBatch);
router.post('/quality-review', verifyToken, requireAdmin, controller.runQualityReview);
router.get('/:id', verifyToken, requireAuth, controller.getById);
router.get('/:id/history', verifyToken, requireAuth, controller.getHistory);
router.put('/:id', verifyToken, requireAdmin, validate(clienteUpdateSchema), controller.update);

module.exports = router;
