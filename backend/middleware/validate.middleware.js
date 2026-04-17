const { ValidationError } = require('../utils/appError');

/**
 * Middleware genérico de validación con Zod.
 * Recibe un schema y valida req.body.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ValidationError('Datos inválidos.', errors, {
          context: {
            route: req.originalUrl,
          },
        }));
      }
      req.validatedData = result.data;
      next();
    } catch (err) {
      return next(new ValidationError('Error de validación.', err.message, {
        context: {
          route: req.originalUrl,
        },
      }));
    }
  };
}

module.exports = { validate };
