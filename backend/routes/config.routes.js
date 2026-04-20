const express = require('express');
const router = express.Router();
const controller = require('../controllers/config.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { configSettingUpsertSchema } = require('../schemas/configSettings.schema');

function validateSettingUpsert(req, res, next) {
  return validate(configSettingUpsertSchema)(req, res, next);
}

// Full config (used by frontend to populate selects)
router.get('/', controller.getFullConfig);

router.get('/settings/:key', verifyToken, requireAuth, controller.getSetting);
router.put('/settings/:key', verifyToken, requireAdmin, validateSettingUpsert, controller.upsertSetting);

// CRUD por tabla - all admin only
router.get('/:table', verifyToken, requireAdmin, controller.getTable);
router.post('/:table', verifyToken, requireAdmin, controller.addToTable);
router.put('/:table/:id/password', verifyToken, requireAdmin, controller.changePassword);
router.put('/:table/:id', verifyToken, requireAdmin, controller.updateInTable);
router.post('/:table/import', verifyToken, requireAdmin, controller.importBatch);
router.delete('/:table/:id', verifyToken, requireAdmin, controller.removeFromTable);

module.exports = router;
