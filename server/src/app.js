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

function ensureServerlessDatabaseReady(request, response, next) {
  if (!migrationPromise) {
    migrationPromise = runMigrations().catch((error) => {
      migrationPromise = undefined;
      throw error;
    });
  }
  migrationPromise.then(() => next()).catch(next);
}

export function createApp({ migrateOnRequest = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed'));
    },
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
  }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/health/live', (request, response) => {
    response.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  });

  // Liveness deliberately runs before database initialization. It proves the
  // Function loaded even when hosted PostgreSQL credentials are incorrect.
  // Every database-dependent route below still waits for safe migrations.
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

// Vercel detects this default Express export and turns it into one Function.
// The regular local/Docker server continues to use createApp() from server.js.
export default createApp({ migrateOnRequest: true });
