import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import { adminRouter } from './routes/adminRoutes.js';
import { rateLimitRouter } from './routes/rateLimitRoutes.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { AppError } from './utils/AppError.js';
import { runMigrations } from './db/migrate.js';

let migrationPromise;

const exposedRateLimitHeaders = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

// Checks whether the browser origin matches the public request origin.
function isSameOrigin(request, origin) {
  const forwardedProtocol = request.get('x-forwarded-proto')?.split(',')[0].trim();
  const forwardedHost = request.get('x-forwarded-host')?.split(',')[0].trim();
  const protocol = forwardedProtocol || request.protocol;
  const host = forwardedHost || request.get('host');
  return Boolean(host && origin === `${protocol}://${host}`);
}

// Allows secure Vercel preview deployments to call the API.
function isVercelPreviewOrigin(origin) {
  if (!process.env.VERCEL || !origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === 'https:' && parsedOrigin.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

// Builds the CORS policy for the current request.
function createCorsOptions(request, callback) {
  const origin = request.get('origin');
  const allowed = !origin
    || env.corsOrigins.includes('*')
    || env.corsOrigins.includes(origin)
    || isSameOrigin(request, origin)
    || isVercelPreviewOrigin(origin);

  if (!allowed) {
    callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed'));
    return;
  }

  callback(null, {
    origin: Boolean(origin),
    exposedHeaders: exposedRateLimitHeaders,
  });
}

// Prepares the database before a serverless request continues.
function ensureServerlessDatabaseReady(request, response, next) {
  if (!migrationPromise) {
    migrationPromise = runMigrations().catch((error) => {
      migrationPromise = undefined;
      throw error;
    });
  }
  migrationPromise.then(() => next()).catch(next);
}

// Creates and configures the Express application.
export function createApp({ migrateOnRequest = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet());
  app.use(cors(createCorsOptions));
  app.use(express.json({ limit: '32kb' }));

  app.get('/health/live', (request, response) => {
    response.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  });

  if (migrateOnRequest) app.use(ensureServerlessDatabaseReady);

  const readinessHandler = asyncHandler(async (request, response) => {
    const startedAt = process.hrtime.bigint();
    await pool.query('SELECT 1');
    const databaseLatencyMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    response.json({
      status: 'ok',
      database: 'ready',
      databaseLatencyMilliseconds: Number(databaseLatencyMilliseconds.toFixed(2)),
    });
  });

  app.get('/health', readinessHandler);
  app.get('/health/ready', readinessHandler);

  app.use('/api/v1/rate-limit', rateLimitRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp({ migrateOnRequest: true });
