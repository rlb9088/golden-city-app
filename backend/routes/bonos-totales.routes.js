const express = require('express');
const router = express.Router();
const controller = require('../controllers/bonos-totales.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { bonoTotalSchema } = require('../schemas/bonos-totales.schema');

const validateBonoTotal = validate(bonoTotalSchema);

router.post('/', verifyToken, requireAdmin, validateBonoTotal, controller.create);
router.get('/', verifyToken, requireAdmin, controller.getPagedAndFiltered);

module.exports = router;
