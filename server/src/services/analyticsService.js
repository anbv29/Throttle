import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

const RANGE_CONFIGURATION = {
  '1m': { interval: '1 minute', bucket: '5 seconds' },
  '5m': { interval: '5 minutes', bucket: '15 seconds' },
  '15m': { interval: '15 minutes', bucket: '30 seconds' },
  '1h': { interval: '1 hour', bucket: '2 minutes' },
  '24h': { interval: '24 hours', bucket: '1 hour' },
};

export async function getTrafficAnalytics(range = '15m') {
  const configuration = RANGE_CONFIGURATION[range];
  if (!configuration) {
    throw new AppError(400, 'VALIDATION_ERROR', 'range must be one of 1m, 5m, 15m, 1h, or 24h');
  }

  const result = await pool.query(
    `WITH bounds AS (
       SELECT clock_timestamp() AS snapshot_timestamp
     ), buckets AS (
       SELECT generate_series(
         snapshot_timestamp - $1::interval,
         snapshot_timestamp,
         $2::interval
       ) AS bucket_start
       FROM bounds
     )
     SELECT
       b.bucket_start,
       COUNT(a.id)::INTEGER AS incoming,
       COUNT(a.id) FILTER (WHERE a.allowed)::INTEGER AS allowed,
       COUNT(a.id) FILTER (WHERE NOT a.allowed)::INTEGER AS denied,
       COALESCE(AVG(a.response_time_ms), 0) AS average_response_time_ms
     FROM buckets b
     LEFT JOIN rate_limit_activity a
       ON a.requested_at >= b.bucket_start
      AND a.requested_at < b.bucket_start + $2::interval
     GROUP BY b.bucket_start
     ORDER BY b.bucket_start`,
    [configuration.interval, configuration.bucket],
  );

  return {
    range,
    dataSource: 'postgresql_activity_history',
    generatedAt: new Date().toISOString(),
    points: result.rows.map((row) => ({
      timestamp: row.bucket_start,
      incoming: row.incoming,
      allowed: row.allowed,
      denied: row.denied,
      averageResponseTimeMs: Number(row.average_response_time_ms),
    })),
  };
}
