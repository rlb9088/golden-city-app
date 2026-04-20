const { ValidationError, BadRequestError } = require('../utils/appError');
const { todayLima } = require('../config/timezone');

function normalizeDateOnly(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function validateQuery(schema, options = {}) {
  const { fieldName = 'fecha' } = options;

  return function validateQueryMiddleware(req, res, next) {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return next(new ValidationError('Parámetros de consulta inválidos.', errors, {
          context: {
            route: req.originalUrl,
          },
        }));
      }

      const normalizedFecha = normalizeDateOnly(result.data?.[fieldName]);
      if (normalizedFecha && normalizedFecha > todayLima()) {
        return next(new BadRequestError('La fecha no puede ser futura.', {
          context: {
            route: req.originalUrl,
            field: fieldName,
            fecha: normalizedFecha,
            today: todayLima(),
          },
        }));
      }

      req.validatedQuery = result.data;
      return next();
    } catch (err) {
      return next(new ValidationError('Error de validación de consulta.', err.message, {
        context: {
          route: req.originalUrl,
        },
      }));
    }
  };
}

module.exports = { validateQuery };
