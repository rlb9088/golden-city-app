const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repo = require('../repositories/sheetsRepository');
const { BadRequestError, UnauthorizedError } = require('../utils/appError');
const logger = require('../lib/logger');

const SHEET_NAME = 'config_auth_users';
const HEADERS = ['id', 'username', 'password_hash', 'role', 'nombre'];
const BCRYPT_ROUNDS = 10;
const DEFAULT_ACCESS_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_EXPIRES_IN = '7d';
const DEV_JWT_SECRET_FALLBACK = 'golden-city-dev-secret';
const FATAL_PREFIX = 'FATAL:';

let bootstrapUsers;

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

function buildBootstrapUsers() {
  if (bootstrapUsers) {
    return bootstrapUsers;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
  const agentPassword = process.env.AUTH_BOOTSTRAP_AGENT_PASSWORD;

  if (isProduction && !adminPassword) {
    throw new Error(`${FATAL_PREFIX} AUTH_BOOTSTRAP_ADMIN_PASSWORD no definida en produccion`);
  }

  if (isProduction && !agentPassword) {
    throw new Error(`${FATAL_PREFIX} AUTH_BOOTSTRAP_AGENT_PASSWORD no definida en produccion`);
  }

  if (!isProduction && (!adminPassword || !agentPassword)) {
    logger.warn('Bootstrap passwords not defined. Using insecure development defaults.', {
      context: { component: 'auth.bootstrap' },
    });
  }

  const defaults = [
    {
      id: 'AUTH-ADMIN',
      username: process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME || 'admin',
      password: adminPassword || 'admin123',
      role: 'admin',
      nombre: process.env.AUTH_BOOTSTRAP_ADMIN_NAME || 'Administrador',
    },
    {
      id: 'AUTH-AGENT',
      username: process.env.AUTH_BOOTSTRAP_AGENT_USERNAME || 'agent',
      password: agentPassword || 'agent123',
      role: 'agent',
      nombre: process.env.AUTH_BOOTSTRAP_AGENT_NAME || 'Agente',
    },
  ];

  bootstrapUsers = defaults.map((user) => ({
    id: user.id,
    username: normalizeText(user.username),
    password_hash: bcrypt.hashSync(normalizeText(user.password), BCRYPT_ROUNDS),
    role: normalizeRole(user.role),
    nombre: normalizeText(user.nombre) || user.username,
  }));

  return bootstrapUsers;
}

function normalizeAuthRow(row) {
  return {
    id: normalizeText(row.id),
    username: normalizeText(row.username),
    password_hash: normalizeText(row.password_hash),
    role: normalizeRole(row.role),
    nombre: normalizeText(row.nombre) || normalizeText(row.username),
  };
}

async function getAuthUsers() {
  const rows = await repo.getAll(SHEET_NAME);
  if (!rows.length) {
    return buildBootstrapUsers();
  }

  return rows.map(normalizeAuthRow);
}

async function getAuthUserByUsername(username) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const users = await getAuthUsers();
  return users.find((user) => user.username.toLowerCase() === normalizedUsername) || null;
}

async function getAuthUserById(userId) {
  const normalizedUserId = normalizeText(userId);
  const users = await getAuthUsers();
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

async function login(username, password) {
  const normalizedUsername = normalizeText(username);
  const normalizedPassword = normalizeText(password);

  if (!normalizedUsername || !normalizedPassword) {
    throw new BadRequestError('Usuario y contrasena son obligatorios.', {
      context: { username: normalizedUsername },
    });
  }

  const user = await getAuthUserByUsername(normalizedUsername);
  if (!user) {
    throw new UnauthorizedError('Credenciales invalidas.', {
      context: { username: normalizedUsername },
    });
  }

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
    return false;
  }

  for (const user of buildBootstrapUsers()) {
    await repo.append(SHEET_NAME, user, HEADERS);
  }

  return true;
}

module.exports = {
  HEADERS,
  SHEET_NAME,
  ensureAuthSheetSeed,
  getAuthUserByUsername,
  getAuthUserById,
  getAuthUsers,
  login,
  refresh,
  signSessionWithRefresh,
  verifyToken,
};
