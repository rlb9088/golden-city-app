const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.get('/me', verifyToken, controller.me);

module.exports = router;
