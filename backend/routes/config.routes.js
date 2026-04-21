const express = require('express');
const router = express.Router();
const controller = require('../controllers/config.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/appError');
const configService = require('../services/config.service');
const { configSettingKeySchema, configSettingUpsertSchema } = require('../schemas/configSettings.schema');

function validateSettingUpsert(req, res, next) {
  return validate(configSettingUpsertSchema)(req, res, next);
}

function validateSettingKey(req, res, next) {
  const result = configSettingKeySchema.safeParse(req.params.key);
  if (!result.success) {
    return next(new BadRequestError('La clave de configuracion no es valida.', {
      context: {
        route: req.originalUrl,
        key: req.params.key,
      },
    }));
  }

  return next();
}

async function loadBankSettingContext(req, res, next) {
  try {
    const { bancoId } = req.params;
    const banco = await configService.getConfigBancoById(bancoId);
    if (!banco) {
      return next(new NotFoundError(`No se encontro el banco ${bancoId}.`, {
        context: {
          route: req.originalUrl,
          bancoId,
        },
      }));
    }

    const [adminBankIds, agentBankIds] = await Promise.all([
      configService.getAdminBankIds(),
      configService.getAgentBankIds(),
    ]);

    const classification = configService.getBankClassificationFromRecord(
      banco,
      adminBankIds,
      agentBankIds,
    );

    req.bankSetting = {
      ...banco,
      classification: classification.classification,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

async function authorizeBankSettingRead(req, res, next) {
  try {
    const bank = req.bankSetting;
    if (!bank) {
      return next(new NotFoundError('No se encontro el banco solicitado.', {
        context: {
          route: req.originalUrl,
        },
      }));
    }

    if (req.auth?.role === 'admin') {
      return next();
    }

    const userId = req.user?.id || req.auth?.userId;
    if (bank.classification !== 'agente' || String(bank.propietario_id ?? '').trim() !== String(userId ?? '').trim()) {
      return next(new ForbiddenError('No tienes permisos para consultar la caja de inicio de ese banco.', {
        context: {
          route: req.originalUrl,
          bancoId: bank.id,
          userId,
        },
      }));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function authorizeBankSettingWrite(req, res, next) {
  try {
    const bank = req.bankSetting;
    if (!bank) {
      return next(new NotFoundError('No se encontro el banco solicitado.', {
        context: {
          route: req.originalUrl,
        },
      }));
    }

    if (bank.classification === 'admin') {
      return next(new BadRequestError('No se puede configurar caja_inicio_mes por banco en bancos de administracion.', {
        context: {
          route: req.originalUrl,
          bancoId: bank.id,
        },
      }));
    }

    if (bank.classification !== 'agente') {
      return next(new BadRequestError('Solo se puede configurar caja_inicio_mes por banco en bancos de agentes.', {
        context: {
          route: req.originalUrl,
          bancoId: bank.id,
        },
      }));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

// Full config (used by frontend to populate selects)
router.get('/', controller.getFullConfig);

router.get('/settings/:key', verifyToken, requireAuth, validateSettingKey, controller.getSetting);
router.put('/settings/:key', verifyToken, requireAdmin, validateSettingKey, validateSettingUpsert, controller.upsertSetting);
router.get('/settings/caja_inicio_mes/banco/:bancoId', verifyToken, requireAuth, loadBankSettingContext, authorizeBankSettingRead, controller.getCajaInicioMesByBanco);
router.put('/settings/caja_inicio_mes/banco/:bancoId', verifyToken, requireAdmin, validateSettingUpsert, loadBankSettingContext, authorizeBankSettingWrite, controller.upsertCajaInicioMesByBanco);

// CRUD por tabla - all admin only
router.get('/:table', verifyToken, requireAdmin, controller.getTable);
router.post('/:table', verifyToken, requireAdmin, controller.addToTable);
router.put('/:table/:id/password', verifyToken, requireAdmin, controller.changePassword);
router.put('/:table/:id', verifyToken, requireAdmin, controller.updateInTable);
router.post('/:table/import', verifyToken, requireAdmin, controller.importBatch);
router.delete('/:table/:id', verifyToken, requireAdmin, controller.removeFromTable);

module.exports = router;
