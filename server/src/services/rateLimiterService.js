import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';
import { checkSlidingWindow } from './slidingWindowService.js';
import { checkTokenBucket } from './tokenBucketService.js';

export async function checkRateLimit(clientKey) {
  const requestStartedAt = performance.now();
  return withTransaction(async (connection) => {
    // This row lock is the per-client mutex shared by every backend instance.
    const configurationResult = await connection.query(
      `SELECT id, client_key, algorithm, requests_per_second, burst_size,
              max_requests, window_seconds
         FROM clients
        WHERE client_key = $1
        FOR UPDATE`,
      [clientKey],
    );

    if (configurationResult.rowCount === 0) {
      throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client configuration not found');
    }

    const clientConfiguration = configurationResult.rows[0];
    const timeResult = await connection.query('SELECT clock_timestamp() AS now');
    const now = new Date(timeResult.rows[0].now);
    const decision = clientConfiguration.algorithm === 'token_bucket'
      ? await checkTokenBucket(connection, clientConfiguration, now)
      : await checkSlidingWindow(connection, clientConfiguration, now);
    const responseTimeMilliseconds = performance.now() - requestStartedAt;

    await connection.query(
      `INSERT INTO rate_limit_activity
         (client_id, client_key, algorithm, allowed, remaining, requested_at, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        clientConfiguration.id,
        clientConfiguration.client_key,
        clientConfiguration.algorithm,
        decision.allowed,
        decision.remaining,
        now,
        responseTimeMilliseconds,
      ],
    );

    return {
      ...decision,
      clientKey: clientConfiguration.client_key,
      algorithm: clientConfiguration.algorithm,
      responseTimeMilliseconds,
    };
  });
}
