const vision = require('@google-cloud/vision');
const logger = require('../lib/logger');

let client;

function getVisionClient() {
  if (client) return client;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new vision.ImageAnnotatorClient();
    return client;
  }
  return null;
}

async function analyzeReceipt(base64Image) {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const visionClient = getVisionClient();
  const engine = visionClient ? 'vision' : 'tesseract';

  try {
    const rawText = visionClient
      ? await detectTextWithVision(base64Data, visionClient)
      : await detectTextWithTesseract(base64Data, 'Google Vision credentials are not configured');

    if (!rawText || rawText.trim() === '') {
      throw new Error('No se detecto texto en la imagen.');
    }

    const { amount, date } = extractFinancialData(rawText);

    logger.info('OCR receipt analyzed', {
      context: {
        component: 'ocr.analyzeReceipt',
        engine,
        amount,
        date,
        hasText: Boolean(rawText && rawText.trim()),
      },
    });

    return {
      monto: amount,
      fecha: date,
      isMock: false,
      rawText: process.env.NODE_ENV === 'development' ? rawText : undefined,
    };
  } catch (error) {
    logger.error('OCR processing failed', {
      context: { component: 'ocr.analyzeReceipt' },
      error,
    });
    throw new Error('Error al procesar comprobante con OCR');
  }
}

async function detectTextWithVision(base64Data, visionClient) {
  try {
    logger.info('Using Google Vision OCR', {
      context: {
        component: 'ocr.detectTextWithVision',
      },
    });

    const [result] = await visionClient.documentTextDetection({
      image: { content: base64Data },
    });
    return result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
  } catch (visionError) {
    logger.warn('Google Vision OCR failed. Falling back to Tesseract.', {
      context: { component: 'ocr.visionFallback' },
      error: visionError,
    });

    return detectTextWithTesseract(base64Data, 'Google Vision request failed');
  }
}

async function detectTextWithTesseract(base64Data, reason) {
  logger.warn('Using Tesseract OCR fallback.', {
    context: { component: 'ocr.tesseractFallback', reason },
  });

  const tesseract = require('tesseract.js');
  const imgBuffer = Buffer.from(base64Data, 'base64');
  const { data } = await tesseract.recognize(imgBuffer, 'spa', {
    logger: () => {},
  });

  return data.text || '';
}

function extractFinancialData(rawText) {
  let amount = null;
  let date = null;

  const text = rawText.replace(/\n'/g, '\n');
  const amounts = [];
  const rawNumberRegex = /(?:\b|\s)(\d{1,3}(?:\s*[.,]\s*\d{3})*\s*[.,]\s*\d{2})(?:\b|\s)/g;
  let match;

  while ((match = rawNumberRegex.exec(text)) !== null) {
    let clean = match[1].replace(/\s/g, '').replace(/,/g, '.');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
    const val = parseFloat(clean);
    if (!Number.isNaN(val)) amounts.push(val);
  }

  if (amounts.length > 0) {
    amount = Math.max(...amounts);
  }

  const dateRegexStandard = /(?:\b|\s)(\d{2})\s*[\/\-]\s*(\d{2})\s*[\/\-]\s*(\d{2,4})(?:(?:\s*-\s*|\s+|,\s*)(\d{1,2}:\d{2}(?:\s*|:)(?:[aAp]|\.|\s|m)*))?(?:\b|\s)/g;
  const dateRegexText = /(?:\b|\s)(\d{1,2})\s*(?:de\s*)?(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\.?\s*(?:de\s*)?(\d{2,4})(?:(?:\s*-\s*|\s+|,\s*)(\d{1,2}:\d{2}(?:\s*|:)(?:[aAp]|\.|\s|m)*))?(?:\b|\s)/ig;
  const dates = [];

  while ((match = dateRegexStandard.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    const time = match[4] ? ` ${match[4].trim()}` : '';
    dates.push(`${year}-${month}-${day}${time}`);
  }

  let textMatch;
  while ((textMatch = dateRegexText.exec(text)) !== null) {
    const day = textMatch[1].padStart(2, '0');
    const monthStr = textMatch[2].toLowerCase().substring(0, 3);
    const monthMap = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
    const month = monthMap[monthStr];
    let year = textMatch[3];
    if (year.length === 2) year = '20' + year;
    const time = textMatch[4] ? ` ${textMatch[4].trim()}` : '';

    if (month) dates.push(`${year}-${month}-${day}${time}`);
  }

  if (dates.length > 0) {
    date = dates[0];
  }

  logger.debug('OCR extraction result', {
    amount,
    date,
    rawText: text.replace(/\n/g, ' | '),
  });

  return { amount, date };
}

module.exports = { analyzeReceipt };
