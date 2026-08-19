import { pool } from '../db/pool.js';

export async function getOverview() {
  const [summaryResult, activityResult] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM clients) AS total_clients,
        (SELECT COUNT(DISTINCT client_id)::INTEGER
           FROM rate_limit_activity
          WHERE requested_at >= clock_timestamp() - INTERVAL '5 minutes') AS active_clients,
        COUNT(*) FILTER (WHERE allowed)::INTEGER AS total_allowed,
        COUNT(*) FILTER (WHERE NOT allowed)::INTEGER AS total_denied,
        COALESCE(AVG(response_time_ms), 0) AS average_response_time_ms
      FROM rate_limit_activity
    `),
    pool.query(`
      SELECT client_key, algorithm, allowed, remaining, requested_at, response_time_ms
        FROM rate_limit_activity
       ORDER BY requested_at DESC
       LIMIT 20
    `),
  ]);

  const summary = summaryResult.rows[0];
  return {
    totalClients: summary.total_clients,
    activeClients: summary.active_clients ?? 0,
    totalAllowed: summary.total_allowed ?? 0,
    totalDenied: summary.total_denied ?? 0,
    averageResponseTimeMs: Number(summary.average_response_time_ms ?? 0),
    recentActivity: activityResult.rows.map((row) => ({
      clientKey: row.client_key,
      algorithm: row.algorithm,
      allowed: row.allowed,
      remaining: row.remaining,
      requestedAt: row.requested_at,
      responseTimeMs: row.response_time_ms === null ? null : Number(row.response_time_ms),
    })),
  };
}
