const ocrService = require('../services/ocr.service');
const { BadRequestError } = require('../utils/appError');

async function analyze(req, res) {
  const { image } = req.body;

  if (!image) {
    throw new BadRequestError('No se envió ninguna imagen base64.');
  }

  const data = await ocrService.analyzeReceipt(image);

  res.json({
    status: 'success',
    data,
  });
}

module.exports = { analyze };
