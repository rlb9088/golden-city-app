const { UnauthorizedError, ForbiddenError } = require('../utils/appError');
const authService = require('../services/auth.service');

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

function verifyToken(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return next(new UnauthorizedError('Autenticación requerida.', {
      context: {
        route: req.originalUrl,
      },
    }));
  }

  try {
    const auth = authService.verifyToken(token);
    req.auth = {
      ...auth,
      user: auth.nombre || auth.username,
    };
    return next();
  } catch (error) {
    return next(new UnauthorizedError('Token inválido o expirado.', {
      context: {
        route: req.originalUrl,
      },
      details: error?.message,
    }));
  }
}

function requireAuth(req, res, next) {
  if (!req.auth) {
    return next(new UnauthorizedError('Autenticación requerida.', {
      context: {
        route: req.originalUrl,
      },
    }));
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.auth) {
    return next(new UnauthorizedError('Autenticación requerida.', {
      context: {
        route: req.originalUrl,
      },
    }));
  }

  if (req.auth.role !== 'admin') {
    return next(new ForbiddenError('Solo administradores pueden realizar esta acción.', {
      context: {
        route: req.originalUrl,
        role: req.auth?.role || 'unknown',
      },
    }));
  }

  return next();
}

module.exports = { verifyToken, requireAuth, requireAdmin };
