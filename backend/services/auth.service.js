const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repo = require('../repositories/sheetsRepository');
const { BadRequestError, UnauthorizedError } = require('../utils/appError');
const logger = require('../lib/logger');

const SHEET_NAME = 'config_agentes';
const HEADERS = ['id', 'nombre', 'username', 'password_hash', 'role', 'activo'];
const BCRYPT_ROUNDS = 10;
const DEFAULT_ACCESS_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_EXPIRES_IN = '7d';
const DEV_JWT_SECRET_FALLBACK = 'golden-city-dev-secret';
const FATAL_PREFIX = 'FATAL:';
const DEFAULT_AUTH_USER_CACHE_TTL_MS = 60 * 1000;

let bootstrapUsers;
let authUserCache = {
  rows: null,
  expiresAt: 0,
};
let authUserLoadPromise = null;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${FATAL_PREFIX} JWT_SECRET no configurada en produccion`);
  }

  logger.warn('JWT_SECRET not defined. Using insecure development fallback.', {
    context: { component: 'auth.jwt' },
  });
  return DEV_JWT_SECRET_FALLBACK;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_EXPIRES_IN;
}

function getJwtRefreshExpiresIn() {
  return process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRES_IN;
}

function getJwtRefreshSecret() {
  return `${getJwtSecret()}_refresh`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  return role === 'admin' ? 'admin' : 'agent';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes';
}

function normalizeActive(value) {
  return normalizeBoolean(value);
}

function normalizeAgentRow(row) {
  return {
    id: normalizeText(row.id),
    nombre: normalizeText(row.nombre) || normalizeText(row.username),
    username: normalizeText(row.username).toLowerCase(),
    password_hash: normalizeText(row.password_hash),
    role: normalizeRole(row.role),
    activo: normalizeActive(row.activo),
  };
}

function sanitizeAgentRow(row) {
  const { password_hash, ...rest } = normalizeAgentRow(row);
  return rest;
}

function buildBootstrapUsers() {
  if (bootstrapUsers) {
    return bootstrapUsers;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;

  if (isProduction && !adminPassword) {
    throw new Error(`${FATAL_PREFIX} AUTH_BOOTSTRAP_ADMIN_PASSWORD no definida en produccion`);
  }

  if (!isProduction && !adminPassword) {
    logger.warn('Bootstrap admin password not defined. Using insecure development default.', {
      context: { component: 'auth.bootstrap' },
    });
  }

  const adminUser = {
    id: 'AUTH-ADMIN',
    nombre: process.env.AUTH_BOOTSTRAP_ADMIN_NAME || 'Administrador',
    username: process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME || 'admin',
    password: adminPassword || 'admin123',
    role: 'admin',
    activo: true,
  };

  bootstrapUsers = [
    {
      id: adminUser.id,
      nombre: normalizeText(adminUser.nombre) || adminUser.username,
      username: normalizeText(adminUser.username).toLowerCase(),
      password_hash: bcrypt.hashSync(normalizeText(adminUser.password), BCRYPT_ROUNDS),
      role: normalizeRole(adminUser.role),
      activo: normalizeActive(adminUser.activo),
    },
  ];

  return bootstrapUsers;
}

function clearAuthUserCache() {
  authUserCache = {
    rows: null,
    expiresAt: 0,
  };
}

function primeAuthUserCache(rows) {
  authUserCache = {
    rows: Array.isArray(rows) ? rows : null,
    expiresAt: Date.now() + DEFAULT_AUTH_USER_CACHE_TTL_MS,
  };
}

function getCachedAuthUsers() {
  if (!Array.isArray(authUserCache.rows) || authUserCache.rows.length === 0) {
    return null;
  }

  if (Date.now() > authUserCache.expiresAt) {
    return null;
  }

  return authUserCache.rows;
}

function getBootstrapAdminUser() {
  return buildBootstrapUsers()[0] || null;
}

function isBootstrapAdminCredentials(username, password) {
  const bootstrapAdmin = getBootstrapAdminUser();
  if (!bootstrapAdmin) {
    return false;
  }

  return bootstrapAdmin.username === normalizeText(username).toLowerCase()
    && bcrypt.compareSync(normalizeText(password), bootstrapAdmin.password_hash);
}

async function getAgentRowsRaw() {
  const cachedUsers = getCachedAuthUsers();
  if (cachedUsers) {
    return cachedUsers;
  }

  if (!authUserLoadPromise) {
    authUserLoadPromise = (async () => {
      try {
        const rows = await repo.getAll(SHEET_NAME);
        const normalizedRows = rows.length ? rows.map(normalizeAgentRow) : buildBootstrapUsers();
        primeAuthUserCache(normalizedRows);
        return normalizedRows;
      } catch (error) {
        const staleUsers = authUserCache.rows;
        if (Array.isArray(staleUsers) && staleUsers.length > 0) {
          logger.warn('Using cached auth users after Google Sheets error', {
            context: { component: 'auth.cache', sheetName: SHEET_NAME },
            error,
          });
          return staleUsers;
        }

        throw error;
      } finally {
        authUserLoadPromise = null;
      }
    })();
  }

  return authUserLoadPromise;
}

async function getAuthUsers() {
  return getAgentRowsRaw();
}

async function getAuthUserByUsername(username) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const users = await getAgentRowsRaw();
  return users.find((user) => user.username === normalizedUsername) || null;
}

async function getAuthUserById(userId) {
  const normalizedUserId = normalizeText(userId);
  const users = await getAgentRowsRaw();
  return users.find((user) => user.id === normalizedUserId) || null;
}

function buildSession(user) {
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    nombre: user.nombre,
  };
}

function signSessionWithRefresh(user) {
  const session = buildSession(user);
  const expiresIn = getJwtExpiresIn();
  const refreshExpiresIn = getJwtRefreshExpiresIn();
  const accessToken = jwt.sign(session, getJwtSecret(), { expiresIn });
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    getJwtRefreshSecret(),
    { expiresIn: refreshExpiresIn },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn,
    user: session,
  };
}

function assertActiveUser(user) {
  if (!user?.activo) {
    throw new UnauthorizedError('El usuario esta inactivo.', {
      context: {
        userId: user?.id,
        username: user?.username,
      },
    });
  }
}

async function login(username, password) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const normalizedPassword = normalizeText(password);

  if (!normalizedUsername || !normalizedPassword) {
    throw new BadRequestError('Usuario y contrasena son obligatorios.', {
      context: { username: normalizedUsername },
    });
  }

  if (isBootstrapAdminCredentials(normalizedUsername, normalizedPassword)) {
    return signSessionWithRefresh(getBootstrapAdminUser());
  }

  const user = await getAuthUserByUsername(normalizedUsername);
  if (!user) {
    throw new UnauthorizedError('Credenciales invalidas.', {
      context: { username: normalizedUsername },
    });
  }

  assertActiveUser(user);

  const passwordOk = await bcrypt.compare(normalizedPassword, user.password_hash);
  if (!passwordOk) {
    throw new UnauthorizedError('Credenciales invalidas.', {
      context: { username: normalizedUsername },
    });
  }

  return signSessionWithRefresh(user);
}

async function refresh(refreshToken) {
  const normalizedRefreshToken = normalizeText(refreshToken);

  if (!normalizedRefreshToken) {
    throw new UnauthorizedError('Refresh token invalido.', {
      context: { component: 'auth.refresh' },
    });
  }

  let payload;
  try {
    payload = jwt.verify(normalizedRefreshToken, getJwtRefreshSecret());
  } catch (error) {
    throw new UnauthorizedError('Refresh token invalido.', {
      context: { component: 'auth.refresh' },
      details: error?.message,
    });
  }

  if (payload?.type !== 'refresh' || !payload?.userId) {
    throw new UnauthorizedError('Refresh token invalido.', {
      context: { component: 'auth.refresh', reason: 'invalid-payload' },
    });
  }

  const user = await getAuthUserById(payload.userId);
  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado.', {
      context: { component: 'auth.refresh', userId: payload.userId },
    });
  }

  assertActiveUser(user);

  return signSessionWithRefresh(user);
}

function verifyToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  return buildSession({
    id: payload.userId,
    username: payload.username,
    role: payload.role,
    nombre: payload.nombre || payload.username,
  });
}

async function ensureAuthSheetSeed() {
  getJwtSecret();
  buildBootstrapUsers();

  const rows = await repo.getAll(SHEET_NAME);
  if (rows.length > 0) {
    primeAuthUserCache(rows.map(normalizeAgentRow));
    return false;
  }

  for (const user of buildBootstrapUsers()) {
    await repo.append(SHEET_NAME, user, HEADERS);
  }

  primeAuthUserCache(buildBootstrapUsers());
  return true;
}

module.exports = {
  HEADERS,
  SHEET_NAME,
  clearAuthUserCache,
  ensureAuthSheetSeed,
  getAuthUserByUsername,
  getAuthUserById,
  getAuthUsers,
  login,
  refresh,
  signSessionWithRefresh,
  verifyToken,
};
