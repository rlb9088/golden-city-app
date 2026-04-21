const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const servicePath = require.resolve('../services/ocr.service');
const visionModulePath = require.resolve('@google-cloud/vision');
const tesseractModulePath = require.resolve('tesseract.js');

function loadServiceWithMocks({ visionFactory, recognizeImpl, googleApplicationCredentials } = {}) {
  delete require.cache[servicePath];
  delete require.cache[visionModulePath];
  delete require.cache[tesseractModulePath];

  require.cache[visionModulePath] = {
    id: visionModulePath,
    filename: visionModulePath,
    loaded: true,
    exports: {
      ImageAnnotatorClient: visionFactory || class ImageAnnotatorClient {
        async documentTextDetection() {
          throw new Error('Vision mock not implemented');
        }
      },
    },
  };

  require.cache[tesseractModulePath] = {
    id: tesseractModulePath,
    filename: tesseractModulePath,
    loaded: true,
    exports: {
      recognize: recognizeImpl || (async () => ({ data: { text: '' } })),
    },
  };

  const previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (googleApplicationCredentials === undefined) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  } else {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = googleApplicationCredentials;
  }

  const service = require('../services/ocr.service');

  return {
    service,
    restore() {
      delete require.cache[servicePath];
      delete require.cache[visionModulePath];
      delete require.cache[tesseractModulePath];

      if (previousCredentials === undefined) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      } else {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
      }
    },
  };
}

test('analyzeReceipt uses Tesseract when Vision credentials are missing', async () => {
  const { service, restore } = loadServiceWithMocks({
    recognizeImpl: async () => ({
      data: {
        text: 'Operacion aprobada\nTotal pagado S/ 50.00\nFecha 01/04/2026',
      },
    }),
  });

  try {
    const result = await service.analyzeReceipt('data:image/png;base64,ZmFrZQ==');

    assert.equal(result.isMock, false);
    assert.equal(result.monto, 50);
    assert.equal(result.fecha, '2026-04-01');
  } finally {
    restore();
  }
});

test('analyzeReceipt falls back to Tesseract when Vision request fails', async () => {
  class BrokenVisionClient {
    async documentTextDetection() {
      throw new Error('Vision unavailable');
    }
  }

  const { service, restore } = loadServiceWithMocks({
    googleApplicationCredentials: path.join(process.cwd(), 'fake-google-creds.json'),
    visionFactory: BrokenVisionClient,
    recognizeImpl: async () => ({
      data: {
        text: 'Monto S/ 100.00\nFecha 05/04/2026',
      },
    }),
  });

  try {
    const result = await service.analyzeReceipt('data:image/png;base64,ZmFrZQ==');

    assert.equal(result.isMock, false);
    assert.equal(result.monto, 100);
    assert.equal(result.fecha, '2026-04-05');
  } finally {
    restore();
  }
});

test('normalizeTime convierte meridiem y conserva horas 24h ambiguas', () => {
  const { service, restore } = loadServiceWithMocks();

  try {
    const cases = [
      { time: '2:30', meridiem: 'PM', expected: '14:30' },
      { time: '12:15', meridiem: 'AM', expected: '00:15' },
      { time: '11:59', meridiem: 'PM', expected: '23:59' },
      { time: '9:00', meridiem: undefined, expected: '09:00' },
      { time: '13:45', meridiem: undefined, expected: '13:45' },
      { time: '12:00', meridiem: 'PM', expected: '12:00' },
      { time: '12:00', meridiem: 'AM', expected: '00:00' },
    ];

    for (const { time, meridiem, expected } of cases) {
      assert.equal(service.normalizeTime(time, meridiem), expected);
    }
  } finally {
    restore();
  }
});

test('extractFinancialData normaliza la hora escrita con p.m.', () => {
  const { service, restore } = loadServiceWithMocks();

  try {
    const result = service.extractFinancialData('15 de Abril 2026, 3:20 p.m.');

    assert.equal(result.date, '2026-04-15 15:20');
  } finally {
    restore();
  }
});
