import dotenv from 'dotenv';

dotenv.config();

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === 'true';
}

function toPositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toPositiveInteger(process.env.PORT, 4000, 'PORT'),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://rate_limiter:rate_limiter_dev@localhost:5432/rate_limiter',
  databaseSsl: toBoolean(process.env.DATABASE_SSL),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  requestLogging: toBoolean(process.env.REQUEST_LOGGING, process.env.NODE_ENV !== 'test'),
  requestTimeoutMs: toPositiveInteger(process.env.REQUEST_TIMEOUT_MS, 30_000, 'REQUEST_TIMEOUT_MS'),
  headersTimeoutMs: toPositiveInteger(process.env.HEADERS_TIMEOUT_MS, 35_000, 'HEADERS_TIMEOUT_MS'),
  keepAliveTimeoutMs: toPositiveInteger(process.env.KEEP_ALIVE_TIMEOUT_MS, 5_000, 'KEEP_ALIVE_TIMEOUT_MS'),
};

if (env.headersTimeoutMs <= env.keepAliveTimeoutMs) {
  throw new Error('HEADERS_TIMEOUT_MS must be greater than KEEP_ALIVE_TIMEOUT_MS');
}
