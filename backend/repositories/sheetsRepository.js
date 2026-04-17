const { getSheetsClient, getSheetId } = require('../config/sheetsClient');
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

module.exports = { getAll, append, update, deleteRow, findByColumn };
