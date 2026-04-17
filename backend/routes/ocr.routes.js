const express = require('express');
const router = express.Router();
const controller = require('../controllers/ocr.controller');
const { verifyToken, requireAuth } = require('../middleware/auth.middleware');

// Analizar una nueva imagen para OCR
// Cualquier persona autenticada (Agent o Admin) que sube una foto puede analizar.
router.post('/analyze', verifyToken, requireAuth, controller.analyze);

module.exports = router;
