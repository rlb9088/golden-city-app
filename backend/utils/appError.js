class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = options.code || this.name;
    this.details = options.details;
    this.context = options.context || {};
    this.isOperational = true;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'La solicitud es inválida.', options = {}) {
    super(message, 400, options);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Autenticación requerida.', options = {}) {
    super(message, 401, options);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción.', options = {}) {
    super(message, 403, options);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.', options = {}) {
    super(message, 404, options);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Se excedió el límite de solicitudes. Intenta nuevamente en unos segundos.', options = {}) {
    super(message, 429, options);
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'No se pudo completar la operación con un servicio externo.', options = {}) {
    super(message, 500, options);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Datos inválidos.', details, options = {}) {
    super(message, 400, { ...options, details });
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  ValidationError,
};
