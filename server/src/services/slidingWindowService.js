const MILLISECONDS_PER_SECOND = 1000;

export function calculateSlidingWindow({ eventTimestamps, maxRequests, windowSeconds, now }) {
  const cutoff = now.getTime() - windowSeconds * MILLISECONDS_PER_SECOND;
  const activeEvents = eventTimestamps
    .map((timestamp) => new Date(timestamp))
    .filter((timestamp) => timestamp.getTime() > cutoff)
    .sort((left, right) => left.getTime() - right.getTime());
  const allowed = activeEvents.length < maxRequests;
  if (allowed) activeEvents.push(now);

  const oldestEvent = activeEvents[0] ?? now;
  const resetAt = new Date(oldestEvent.getTime() + windowSeconds * MILLISECONDS_PER_SECOND);
  const remaining = Math.max(0, maxRequests - activeEvents.length);

  return {
    allowed,
    activeEvents,
    limit: maxRequests,
    remaining,
    resetAt,
    retryAfterSeconds: allowed
      ? undefined
      : Math.max(0, (resetAt.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND),
  };
}

export async function checkSlidingWindow(connection, clientConfiguration, now) {
  const cutoff = new Date(now.getTime() - clientConfiguration.window_seconds * MILLISECONDS_PER_SECOND);

  await connection.query(
    'DELETE FROM sliding_window_events WHERE client_id = $1 AND requested_at <= $2',
    [clientConfiguration.id, cutoff],
  );

  const windowResult = await connection.query(
    `SELECT COUNT(*)::INTEGER AS request_count, MIN(requested_at) AS oldest_request
       FROM sliding_window_events
      WHERE client_id = $1`,
    [clientConfiguration.id],
  );

  const requestCount = windowResult.rows[0].request_count;
  const allowed = requestCount < clientConfiguration.max_requests;
  const countAfterRequest = allowed ? requestCount + 1 : requestCount;

  if (allowed) {
    await connection.query(
      'INSERT INTO sliding_window_events (client_id, requested_at) VALUES ($1, $2)',
      [clientConfiguration.id, now],
    );
  }

  const oldestRequest = windowResult.rows[0].oldest_request
    ? new Date(windowResult.rows[0].oldest_request)
    : now;
  const resetAt = new Date(
    oldestRequest.getTime() + clientConfiguration.window_seconds * MILLISECONDS_PER_SECOND,
  );

  return {
    allowed,
    limit: clientConfiguration.max_requests,
    remaining: Math.max(0, clientConfiguration.max_requests - countAfterRequest),
    resetAt,
    retryAfterSeconds: allowed
      ? undefined
      : Math.max(0, (resetAt.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND),
  };
}
