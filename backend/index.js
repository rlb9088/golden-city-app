const { bootstrapEnvironment } = require('./config/bootstrapEnv');

bootstrapEnvironment();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const authService = require('./services/auth.service');
const logger = require('./lib/logger');

const app = express();
app.set('trust proxy', 1);

const port = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

function parseRateLimitConfig(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  const match = String(rawValue)
    .trim()
    .toLowerCase()
    .match(/^(\d+)\s*\/\s*(?:(\d+)\s*)?(ms|millisecond|milliseconds|s|sec|secs|second|seconds|min|m|minute|minutes|h|hr|hour|hours)$/);

  if (!match) {
    return fallback;
  }

  const max = Number(match[1]);
  const windowAmount = Number(match[2] || '1');
  const unit = match[3];

  const unitMs = unit === 'ms' || unit === 'millisecond' || unit === 'milliseconds'
    ? 1
    : unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds'
      ? 1000
      : unit === 'min' || unit === 'm' || unit === 'minute' || unit === 'minutes'
        ? 60 * 1000
        : 60 * 60 * 1000;

  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(windowAmount) || windowAmount <= 0) {
    return fallback;
  }

  return {
    max,
    windowMs: windowAmount * unitMs,
  };
}

const defaultGlobalRateLimit = process.env.NODE_ENV === 'development'
  ? 600
  : process.env.NODE_ENV === 'test'
    ? 10
    : 120;

const globalRateLimitConfig = parseRateLimitConfig(process.env.RATE_LIMIT_GLOBAL, {
  max: defaultGlobalRateLimit,
  windowMs: 60 * 1000,
});

const loginRateLimitConfig = parseRateLimitConfig(process.env.RATE_LIMIT_LOGIN, {
  max: 5,
  windowMs: 15 * 60 * 1000,
});

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
logger.info('CORS configured', { context: { corsOrigin } });
app.use(helmet());
app.use((req, res, next) => {
  if (!res.getHeader('Strict-Transport-Security')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const loginLimiter = rateLimit({
  ...loginRateLimitConfig,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
});

const globalLimiter = rateLimit({
  ...globalRateLimitConfig,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS' || req.originalUrl === '/api/health',
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', globalLimiter);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/pagos', require('./routes/pagos.routes'));
app.use('/api/ingresos', require('./routes/ingresos.routes'));
app.use('/api/gastos', require('./routes/gastos.routes'));
app.use('/api/bancos', require('./routes/bancos.routes'));
app.use('/api/balance', require('./routes/balance.routes'));
app.use('/api/config', require('./routes/config.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/ocr', require('./routes/ocr.routes'));

if (process.env.NODE_ENV !== 'test') {
  void authService.ensureAuthSheetSeed().catch((error) => {
    if (String(error?.message || '').startsWith('FATAL:')) {
      logger.error('Invalid auth configuration during bootstrap', {
        context: { component: 'auth.bootstrap' },
        error,
      });
      process.exit(1);
    }

    logger.warn('Could not prepare auth sheet', {
      context: { component: 'auth.bootstrap' },
      error,
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    logger.info('Golden City Backend running', {
      context: {
        port,
        mode: (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_SHEET_ID)
          ? 'Google Sheets'
          : 'In-Memory (dev)',
      },
    });
  });
}

module.exports = app;
