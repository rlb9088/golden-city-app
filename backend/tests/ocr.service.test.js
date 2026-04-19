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
