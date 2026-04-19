const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
const { SHEETS_SCHEMA_MAP } = require('../config/sheetsSchema');
const {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
} = require('../utils/appError');
const logger = require('../lib/logger');

/**
 * In-memory store para desarrollo sin Google Sheets.
 * Estructura: { sheetName: [{ col1: val1, ... }, ...] }
 */
const memoryStore = {};
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 250;
const MAX_BATCH_PAYLOAD_BYTES = 2 * 1024 * 1024;
const BATCH_CHUNK_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSheetValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildContext(sheetName, operation, extra = {}) {
  return {
    sheetName,
    operation,
    ...extra,
  };
}

function getSheetHeaders(sheetName) {
  return SHEETS_SCHEMA_MAP[sheetName] || null;
}

function toColumnLetter(columnNumber) {
  let current = columnNumber;
  let column = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function isExactHeaderMatch(actualHeaders = [], expectedHeaders = []) {
  return actualHeaders.length === expectedHeaders.length
    && actualHeaders.every((header, index) => header === expectedHeaders[index]);
}

function isLegacyPagosHeaderWithoutBancoId(headers = []) {
  return headers.length === 12
    && headers[0] === 'id'
    && headers[1] === 'estado'
    && headers[2] === 'usuario'
    && headers[3] === 'caja'
    && headers[4] === 'banco'
    && headers[5] === 'monto'
    && headers[6] === 'tipo'
    && headers[7] === 'comprobante_url'
    && headers[8] === 'comprobante_file_id'
    && headers[9] === 'fecha_comprobante'
    && headers[10] === 'fecha_registro'
    && headers[11] === 'agente';
}

function isLegacyPagosHeaderWithoutBancoIdAndReceiptFile(headers = []) {
  return headers.length === 11
    && headers[0] === 'id'
    && headers[1] === 'estado'
    && headers[2] === 'usuario'
    && headers[3] === 'caja'
    && headers[4] === 'banco'
    && headers[5] === 'monto'
    && headers[6] === 'tipo'
    && headers[7] === 'comprobante_url'
    && headers[8] === 'fecha_comprobante'
    && headers[9] === 'fecha_registro'
    && headers[10] === 'agente';
}

async function getTargetSheetId(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });

  const targetSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
  return targetSheet?.properties?.sheetId ?? null;
}

async function ensureSheetSchema(sheets, spreadsheetId, sheetName, expectedHeaders, operation) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const actualHeaders = response.data.values?.[0] || [];
  if (isExactHeaderMatch(actualHeaders, expectedHeaders)) {
    return;
  }

  if (
    sheetName === 'pagos'
    && (
      isLegacyPagosHeaderWithoutBancoId(actualHeaders)
      || isLegacyPagosHeaderWithoutBancoIdAndReceiptFile(actualHeaders)
    )
  ) {
    logger.warn('Migrating legacy pagos schema to restore the expected headers', {
      context: buildContext(sheetName, operation, {
        schemaMigration: true,
        fromHeaders: actualHeaders,
        toHeaders: expectedHeaders,
      }),
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${toColumnLetter(expectedHeaders.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [expectedHeaders] },
    });

    return;
  }

  if (actualHeaders.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(64 + expectedHeaders.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [expectedHeaders] },
    });
    return;
  }

  logger.warn('Google Sheets header mismatch detected', {
    context: buildContext(sheetName, operation, {
      expectedHeaders,
      actualHeaders,
    }),
  });
}

function buildRowObject(row, headers) {
  if (Array.isArray(row)) {
    return headers.reduce((acc, header, index) => {
      acc[header] = row[index] ?? '';
      return acc;
    }, {});
  }

  return { ...row };
}

function buildRowValues(row, headers) {
  if (Array.isArray(row)) {
    return row.map(normalizeSheetValue);
  }

  return headers.map((header) => normalizeSheetValue(row[header]));
}

function estimatePayloadBytes(rows) {
  return Buffer.byteLength(JSON.stringify(rows), 'utf8');
}

function chunkRowsBySize(rows, maxBytes) {
  const chunks = [];
  let currentChunk = [];
  let currentBytes = 2; // account for array brackets in JSON.stringify

  for (const row of rows) {
    const rowBytes = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
    const wouldExceedLimit = currentChunk.length > 0 && (currentBytes + rowBytes) > maxBytes;

    if (wouldExceedLimit) {
      chunks.push(currentChunk);
      currentChunk = [row];
      currentBytes = 2 + rowBytes;
      continue;
    }

    currentChunk.push(row);
    currentBytes += rowBytes;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function parseUpdatedRange(updatedRange) {
  const rangeText = String(updatedRange ?? '');
  const rowMatches = [...rangeText.matchAll(/(\d+)/g)].map((match) => Number(match[1]));

  if (rowMatches.length === 0) {
    return { startRow: null, endRow: null };
  }

  if (rowMatches.length === 1) {
    return { startRow: rowMatches[0], endRow: rowMatches[0] };
  }

  return {
    startRow: rowMatches[0],
    endRow: rowMatches[rowMatches.length - 1],
  };
}

async function delay(ms) {
  await sleep(ms);
}

async function appendChunkWithRetry(sheets, spreadsheetId, sheetName, chunk, operationContext) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: chunk },
      });
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isRetryableError(error) && !isLastAttempt) {
        const delayMs = BASE_RETRY_DELAY_MS * (2 ** (attempt - 1));
        logger.warn('Retrying Google Sheets batch chunk', {
          context: buildContext(sheetName, 'appendBatch', {
            ...operationContext,
            attempt,
            delayMs,
          }),
          error,
        });
        await delay(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function rollbackAppendedChunks(sheets, spreadsheetId, sheetName, sheetId, appendedRanges) {
  if (!appendedRanges.length) {
    return;
  }

  const requests = [];

  for (const range of [...appendedRanges].reverse()) {
    const { startRow, endRow } = parseUpdatedRange(range?.updatedRange);

    if (!Number.isInteger(startRow) || !Number.isInteger(endRow)) {
      continue;
    }

    requests.push({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: startRow - 1,
          endIndex: endRow,
        },
      },
    });
  }

  if (!requests.length) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  logger.warn('Rolled back partial Google Sheets batch append', {
    context: buildContext(sheetName, 'appendBatch', {
      rolledBackChunks: appendedRanges.length,
    }),
  });
}

function getStatusCode(error) {
  return error?.statusCode || error?.status || error?.response?.status;
}

function isRetryableError(error) {
  const statusCode = getStatusCode(error);
  const code = error?.code;
  const retryableStatusCodes = new Set([429, 500, 502, 503, 504]);
  const retryableCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED']);

  return retryableStatusCodes.has(statusCode) || retryableCodes.has(code);
}

function normalizeRepositoryError(error, sheetName, operation, extraContext = {}) {
  const statusCode = getStatusCode(error);
  const context = buildContext(sheetName, operation, extraContext);

  if (statusCode === 429) {
    return new RateLimitError('Límite de solicitudes excedido al consultar Google Sheets.', {
      context,
      details: error?.message,
    });
  }

  if (statusCode === 404) {
    return new NotFoundError('No se encontró la hoja solicitada en Google Sheets.', {
      context,
      details: error?.message,
    });
  }

  if (statusCode === 400) {
    return new BadRequestError('Google Sheets rechazó la operación solicitada.', {
      context,
      details: error?.message,
    });
  }

  if (statusCode === 401) {
    return new UnauthorizedError('No se pudo autenticar contra Google Sheets.', {
      context,
      details: error?.message,
    });
  }

  if (statusCode === 403) {
    return new ForbiddenError('Google Sheets denegó el acceso a esta operación.', {
      context,
      details: error?.message,
    });
  }

  return new ExternalServiceError('No se pudo completar la operación con Google Sheets.', {
    context,
    details: error?.message,
  });
}

async function runSheetsOperation(sheetName, operation, callback, extraContext = {}) {
  let sheets;

  try {
    sheets = await getSheetsClient();
  } catch (error) {
    throw normalizeRepositoryError(error, sheetName, operation, extraContext);
  }

  if (!sheets) {
    return callback({ mode: 'memory' });
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const spreadsheetId = getSheetId();
      return await callback({ sheets, spreadsheetId, mode: 'sheets', attempt });
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isRetryableError(error) && !isLastAttempt) {
        const delayMs = BASE_RETRY_DELAY_MS * (2 ** (attempt - 1));
        logger.warn('Retrying Google Sheets operation', {
          context: buildContext(sheetName, operation, { ...extraContext, attempt, delayMs }),
          error,
        });
        await sleep(delayMs);
        continue;
      }

      throw normalizeRepositoryError(error, sheetName, operation, extraContext);
    }
  }

  throw normalizeRepositoryError(lastError, sheetName, operation, extraContext);
}

/**
 * Lee todas las filas de una hoja.
 * Retorna array de objetos con headers como keys.
 */
async function getAll(sheetName) {
  return runSheetsOperation(sheetName, 'getAll', async ({ sheets, spreadsheetId, mode }) => {
    if (mode === 'memory') {
      return (memoryStore[sheetName] || []).map((row, index) => ({
        ...row,
        _rowIndex: index + 2,
      }));
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map((row, index) => {
      const obj = { _rowIndex: index + 2 }; // 1-indexed + header row
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? '';
      });
      return obj;
    });
  });
}

/**
 * Agrega una fila al final de la hoja.
 * @param {string} sheetName
 * @param {object} data - Objeto con keys que coinciden con headers
 * @param {string[]} headers - Orden de columnas
 */
async function append(sheetName, data, headers) {
  return runSheetsOperation(sheetName, 'append', async ({ sheets, spreadsheetId, mode }) => {
    if (mode === 'memory') {
      if (!memoryStore[sheetName]) memoryStore[sheetName] = [];
      memoryStore[sheetName].push({ ...data });
      return { status: 'success', mode: 'memory' };
    }

    await ensureSheetSchema(sheets, spreadsheetId, sheetName, headers, 'append');
    const row = headers.map((h) => normalizeSheetValue(data[h]));

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return { status: 'success', mode: 'sheets' };
  });
}

/**
 * Agrega múltiples filas al final de la hoja.
 * @param {string} sheetName
 * @param {Array<object|Array>} rows
 */
async function appendBatch(sheetName, rows) {
  if (!Array.isArray(rows)) {
    throw new BadRequestError('Las filas a insertar deben ser un array.', {
      context: buildContext(sheetName, 'appendBatch'),
    });
  }

  const headers = getSheetHeaders(sheetName);
  if (!headers) {
    throw new BadRequestError('La hoja solicitada no existe o no tiene schema configurado.', {
      context: buildContext(sheetName, 'appendBatch'),
    });
  }

  const normalizedRows = rows.map((row) => buildRowValues(row, headers));
  const payloadBytes = estimatePayloadBytes(normalizedRows);

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (error) {
    throw normalizeRepositoryError(error, sheetName, 'appendBatch');
  }

  if (!sheets) {
    if (!memoryStore[sheetName]) memoryStore[sheetName] = [];
    for (const row of rows) {
      memoryStore[sheetName].push(buildRowObject(row, headers));
    }
    return { status: 'success', mode: 'memory', chunks: 1, payloadBytes };
  }

  const spreadsheetId = getSheetId();
  const shouldChunk = payloadBytes > MAX_BATCH_PAYLOAD_BYTES;
  const chunks = shouldChunk ? chunkRowsBySize(normalizedRows, MAX_BATCH_PAYLOAD_BYTES) : [normalizedRows];
  const successfulChunks = [];
  let sheetId = null;

  try {
    if (shouldChunk) {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      });

      const targetSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
      sheetId = targetSheet?.properties?.sheetId;

      if (sheetId === undefined || sheetId === null) {
        throw new NotFoundError('No se encontró la hoja solicitada en Google Sheets.', {
          context: buildContext(sheetName, 'appendBatch'),
        });
      }
    }

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const response = await appendChunkWithRetry(sheets, spreadsheetId, sheetName, chunk, {
        chunkIndex: chunkIndex + 1,
        chunkCount: chunks.length,
        chunkRows: chunk.length,
      });

      const parsedRange = parseUpdatedRange(response?.data?.updates?.updatedRange);
      successfulChunks.push({
        updatedRange: response?.data?.updates?.updatedRange,
        ...parsedRange,
      });

      if (chunkIndex < chunks.length - 1) {
        await delay(BATCH_CHUNK_DELAY_MS);
      }
    }

    return {
      status: 'success',
      mode: 'sheets',
      chunks: chunks.length,
      payloadBytes,
    };
  } catch (error) {
    if (shouldChunk && sheetId !== null) {
      try {
        await rollbackAppendedChunks(sheets, spreadsheetId, sheetName, sheetId, successfulChunks);
      } catch (rollbackError) {
        throw normalizeRepositoryError(rollbackError, sheetName, 'appendBatch', {
          chunks: successfulChunks.length,
          payloadBytes,
          rollbackFailed: true,
        });
      }
    }

    throw normalizeRepositoryError(error, sheetName, 'appendBatch', {
      chunks: chunks.length,
      successfulChunks: successfulChunks.length,
      payloadBytes,
      chunked: shouldChunk,
    });
  }
}

/**
 * Actualiza una fila específica.
 * @param {string} sheetName
 * @param {number} rowIndex - Índice de fila (1-indexed, incluyendo header)
 * @param {object} data
 * @param {string[]} headers
 */
async function update(sheetName, rowIndex, data, headers) {
  return runSheetsOperation(sheetName, 'update', async ({ sheets, spreadsheetId, mode }) => {
    if (mode === 'memory') {
      if (!memoryStore[sheetName]) {
        throw new NotFoundError('La hoja solicitada no existe en memoria.', {
          context: buildContext(sheetName, 'update', { rowIndex }),
        });
      }

      const idx = rowIndex - 2; // Convert to 0-indexed (subtract header row)
      if (idx >= 0 && idx < memoryStore[sheetName].length) {
        memoryStore[sheetName][idx] = { ...memoryStore[sheetName][idx], ...data };
        return { status: 'success', mode: 'memory' };
      }

      throw new NotFoundError('La fila solicitada no existe.', {
        context: buildContext(sheetName, 'update', { rowIndex }),
      });
    }

    await ensureSheetSchema(sheets, spreadsheetId, sheetName, headers, 'update');
    const row = headers.map((h) => normalizeSheetValue(data[h]));

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    return { status: 'success', mode: 'sheets' };
  }, { rowIndex });
}

/**
 * Elimina una fila específica.
 * @param {string} sheetName
 * @param {number} rowIndex - Índice de fila (1-indexed, incluyendo header)
 */
async function deleteRow(sheetName, rowIndex) {
  return runSheetsOperation(sheetName, 'deleteRow', async ({ sheets, spreadsheetId, mode }) => {
    if (!Number.isInteger(rowIndex) || rowIndex <= 1) {
      throw new BadRequestError('La fila solicitada no es válida.', {
        context: buildContext(sheetName, 'deleteRow', { rowIndex }),
      });
    }

    if (mode === 'memory') {
      if (!memoryStore[sheetName]) {
        throw new NotFoundError('La hoja solicitada no existe en memoria.', {
          context: buildContext(sheetName, 'deleteRow', { rowIndex }),
        });
      }

      const idx = rowIndex - 2; // Convert to 0-indexed (subtract header row)
      if (idx >= 0 && idx < memoryStore[sheetName].length) {
        const [deleted] = memoryStore[sheetName].splice(idx, 1);
        return { status: 'success', mode: 'memory', deleted };
      }

      throw new NotFoundError('La fila solicitada no existe.', {
        context: buildContext(sheetName, 'deleteRow', { rowIndex }),
      });
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    const targetSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
    const sheetId = targetSheet?.properties?.sheetId;

    if (sheetId === undefined || sheetId === null) {
      throw new NotFoundError('No se encontró la hoja solicitada en Google Sheets.', {
        context: buildContext(sheetName, 'deleteRow', { rowIndex }),
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    return { status: 'success', mode: 'sheets' };
  }, { rowIndex });
}

/**
 * Busca filas donde una columna tiene un valor específico.
 */
async function findByColumn(sheetName, column, value) {
  const all = await getAll(sheetName);
  return all.filter((row) => row[column] === value);
}

module.exports = { getAll, append, appendBatch, update, deleteRow, findByColumn };
