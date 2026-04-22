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

function normalizeMeridiem(meridiem) {
  if (!meridiem) {
    return '';
  }

  const cleaned = String(meridiem).toLowerCase().replace(/[^apm]/g, '');
  if (cleaned.startsWith('a')) {
    return 'am';
  }

  if (cleaned.startsWith('p')) {
    return 'pm';
  }

  return '';
}

function normalizeTime(hhmm, meridiem) {
  const timeMatch = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return '';
  }

  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2];
  const normalizedMeridiem = normalizeMeridiem(meridiem);

  if (normalizedMeridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (normalizedMeridiem === 'am' && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function appendNormalizedTime(datePart, time, meridiem) {
  if (!time) {
    return datePart;
  }

  const normalizedTime = normalizeTime(time, meridiem);
  return normalizedTime ? `${datePart} ${normalizedTime}` : datePart;
}

function extractNumericValues(value) {
  const numbers = [];
  const rawNumberRegex = /(?:\b|\s)(\d{1,3}(?:\s*[.,]\s*\d{3})*\s*[.,]\s*\d{2})(?:\b|\s)/g;
  let match;

  while ((match = rawNumberRegex.exec(value)) !== null) {
    let clean = match[1].replace(/\s/g, '').replace(/,/g, '.');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }

    const parsed = parseFloat(clean);
    if (!Number.isNaN(parsed)) {
      numbers.push(parsed);
    }
  }

  return numbers;
}

function looksLikePersonName(line) {
  const cleaned = String(line ?? '').trim();
  if (!cleaned) {
    return false;
  }

  return /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ]+){1,4}$/.test(cleaned);
}

function hasShortNoisyLine(lines, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor];
    if (!line) {
      continue;
    }

    return line.length <= 4 && /[^A-Za-zÁÉÍÓÚáéíóúñ0-9]/.test(line);
  }

  return false;
}

function chooseBestAmountCandidate(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [];

  lines.forEach((line, index) => {
    const values = extractNumericValues(` ${line} `);
    if (values.length === 0) {
      return;
    }

    const lowerLine = line.toLowerCase();
    const prevLine = lines[index - 1] || '';
    const nextLine = lines[index + 1] || '';
    const lowerPrevLine = prevLine.toLowerCase();

    values.forEach((value) => {
      let score = 0;

      if (/[s$]\s*[\/.]?\s*\d/.test(lowerLine)) {
        score += 120;
      }

      if (/\b(total|monto|importe|pagado|pago)\b/.test(lowerLine)) {
        score += 80;
      }

      if (/^\d+[.,]\d{2}$/.test(line)) {
        score += 40;
      }

      if (/\b(yapeaste|plin|transferiste|pagaste)\b/.test(lowerPrevLine)) {
        score += 70;
      }

      if (looksLikePersonName(nextLine)) {
        score += 35;
      }

      if (/\b(nro|número|numero|operaci[oó]n|celular|tel[eé]fono|cuenta)\b/.test(lowerLine)) {
        score -= 120;
      }

      candidates.push({ value, score, line, index });

      if (
        /\byapeaste\b/.test(lowerPrevLine)
        && looksLikePersonName(nextLine)
        && /^1\d{2}[.,]\d{2}$/.test(line)
        && hasShortNoisyLine(lines, index - 1)
      ) {
        const normalizedValue = parseFloat(line.slice(1).replace(',', '.'));
        if (!Number.isNaN(normalizedValue)) {
          candidates.push({
            value: normalizedValue,
            score: score + 15,
            line,
            index,
          });
        }
      }
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (a.index !== b.index) {
      return a.index - b.index;
    }

    return a.value - b.value;
  });

  return candidates[0].value;
}

function cleanDateNoise(value) {
  return String(value ?? '')
    .split('\n')
    .map((line) => line
      .replace(/[●•◦○]/g, ' ')
      .replace(/([|,\-])\s*[A-Z0-9]\s+(?=\d{1,2}:\d{2})/g, '$1 ')
      .replace(/[ \t]+/g, ' ')
      .trim())
    .join('\n')
    .trim();
}

function extractFinancialData(rawText) {
  let amount = null;
  let date = null;

  const text = cleanDateNoise(rawText.replace(/\n'/g, '\n'));
  amount = chooseBestAmountCandidate(text);

  let match;

  const timePattern = '(\\d{1,2}:\\d{2})(?:\\s*([ap](?:\\.?\\s*m\\.?)?))?';
  const dateTimeSeparatorPattern = '(?:\\s*[|\\-]\\s*|\\s+|,\\s*)';
  const dateRegexStandard = new RegExp(`(?:\\b|\\s)(\\d{2})\\s*[\\/\\-]\\s*(\\d{2})\\s*[\\/\\-]\\s*(\\d{2,4})(?:${dateTimeSeparatorPattern}${timePattern})?(?:\\b|\\s)`, 'gi');
  const dateRegexText = new RegExp(`(?:\\b|\\s)(\\d{1,2})\\s*(?:de\\s*)?(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\\.?\\s*(?:de\\s*)?(\\d{2,4})(?:${dateTimeSeparatorPattern}${timePattern})?(?:\\b|\\s)`, 'gi');
  const dates = [];

  while ((match = dateRegexStandard.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    dates.push(appendNormalizedTime(`${year}-${month}-${day}`, match[4], match[5]));
  }

  let textMatch;
  while ((textMatch = dateRegexText.exec(text)) !== null) {
    const day = textMatch[1].padStart(2, '0');
    const monthStr = textMatch[2].toLowerCase().substring(0, 3);
    const monthMap = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
    const month = monthMap[monthStr];
    let year = textMatch[3];
    if (year.length === 2) year = '20' + year;
    if (month) {
      dates.push(appendNormalizedTime(`${year}-${month}-${day}`, textMatch[4], textMatch[5]));
    }
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

module.exports = { analyzeReceipt, extractFinancialData, normalizeTime };
