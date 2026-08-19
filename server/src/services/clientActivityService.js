import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

export async function getClientActivity(clientKey, limit = 50) {
  const clientResult = await pool.query(
    `SELECT c.id, c.client_key, c.algorithm, c.requests_per_second, c.burst_size,
            c.max_requests, c.window_seconds, t.available_tokens, t.last_refill_at,
            CASE WHEN c.algorithm = 'sliding_window' THEN (
              SELECT COUNT(*)::INTEGER
              FROM sliding_window_events e
              WHERE e.client_id = c.id
                AND e.requested_at > clock_timestamp() - make_interval(secs => c.window_seconds)
            ) ELSE NULL END AS window_usage
       FROM clients c
       LEFT JOIN token_bucket_state t ON t.client_id = c.id
      WHERE c.client_key = $1`,
    [clientKey],
  );
  if (clientResult.rowCount === 0) {
    throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client configuration not found');
  }

  const client = clientResult.rows[0];
  const activityResult = await pool.query(
    `SELECT allowed, remaining, requested_at, response_time_ms
       FROM rate_limit_activity
      WHERE client_key = $1
      ORDER BY requested_at DESC
      LIMIT $2`,
    [clientKey, limit],
  );
  const summaryResult = await pool.query(
    `SELECT COUNT(*)::INTEGER AS total_requests,
            COUNT(*) FILTER (WHERE allowed)::INTEGER AS allowed_requests,
            COUNT(*) FILTER (WHERE NOT allowed)::INTEGER AS denied_requests,
            COALESCE(AVG(response_time_ms), 0) AS average_response_time_ms,
            MAX(requested_at) AS last_activity_at
       FROM rate_limit_activity
      WHERE client_key = $1`,
    [clientKey],
  );
  const summary = summaryResult.rows[0];

  return {
    currentState: client.algorithm === 'token_bucket'
      ? {
          availableTokens: Number(client.available_tokens ?? client.burst_size),
          capacity: client.burst_size,
          refillRate: Number(client.requests_per_second),
          lastRefillAt: client.last_refill_at,
        }
      : {
          currentUsage: client.window_usage,
          limit: client.max_requests,
          windowSeconds: client.window_seconds,
          remaining: Math.max(0, client.max_requests - client.window_usage),
        },
    summary: {
      totalRequests: summary.total_requests,
      allowedRequests: summary.allowed_requests,
      deniedRequests: summary.denied_requests,
      averageResponseTimeMs: Number(summary.average_response_time_ms),
      lastActivityAt: summary.last_activity_at,
    },
    recentActivity: activityResult.rows.map((row) => ({
      allowed: row.allowed,
      remaining: row.remaining,
      requestedAt: row.requested_at,
      responseTimeMs: row.response_time_ms === null ? null : Number(row.response_time_ms),
    })),
  };
}
