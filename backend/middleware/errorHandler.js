const { AppError, NotFoundError } = require('../utils/appError');
const logger = require('../lib/logger');

function serializeError(err) {
  return {
    name: err?.name || 'Error',
    message: err?.message || 'Error desconocido',
    code: err?.code,
    statusCode: err?.statusCode || err?.status,
    details: err?.details,
    context: err?.context,
  };
}

function logError(err, req) {
  logger.error('Request error', {
    method: req?.method,
    path: req?.originalUrl,
    context: err?.context || {},
    error: serializeError(err),
  });
}

function notFoundHandler(req, res, next) {
  next(new NotFoundError('La ruta solicitada no existe.', {
    context: {
      method: req.method,
      path: req.originalUrl,
    },
  }));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err?.statusCode || err?.status || 500;
  const isOperational = err instanceof AppError || Boolean(err?.isOperational);
  const details = err?.details;
  const message = isOperational
    ? err.message
    : 'Error interno del servidor. Intenta nuevamente más tarde.';

  logError(err, req);

  const response = { error: message };
  if (details !== undefined) {
    response.details = details;
  }

  if (process.env.NODE_ENV === 'development' && !isOperational && err?.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
