const MILLISECONDS_PER_SECOND = 1000;

export function calculateTokenBucket({
  availableTokens,
  lastRefillAt,
  requestsPerSecond,
  burstSize,
  now,
}) {
  const elapsedSeconds = Math.max(0, (now.getTime() - lastRefillAt.getTime()) / MILLISECONDS_PER_SECOND);
  const refilledTokens = Math.min(
    burstSize,
    Number(availableTokens) + elapsedSeconds * Number(requestsPerSecond),
  );
  const allowed = refilledTokens >= 1;
  const tokensAfterRequest = allowed ? refilledTokens - 1 : refilledTokens;
  const secondsUntilFull = Math.max(0, (burstSize - tokensAfterRequest) / requestsPerSecond);
  const resetAt = new Date(now.getTime() + secondsUntilFull * MILLISECONDS_PER_SECOND);
  const retryAfterSeconds = allowed
    ? undefined
    : Math.max(0, (1 - refilledTokens) / requestsPerSecond);

  return {
    allowed,
    availableTokens: tokensAfterRequest,
    remaining: Math.max(0, Math.floor(tokensAfterRequest + Number.EPSILON)),
    limit: burstSize,
    resetAt,
    retryAfterSeconds,
  };
}

export async function checkTokenBucket(connection, clientConfiguration, now) {
  const stateResult = await connection.query(
    `SELECT available_tokens, last_refill_at
       FROM token_bucket_state
      WHERE client_id = $1`,
    [clientConfiguration.id],
  );

  const state = stateResult.rows[0] ?? {
    available_tokens: clientConfiguration.burst_size,
    last_refill_at: now,
  };

  const result = calculateTokenBucket({
    availableTokens: state.available_tokens,
    lastRefillAt: new Date(state.last_refill_at),
    requestsPerSecond: Number(clientConfiguration.requests_per_second),
    burstSize: clientConfiguration.burst_size,
    now,
  });

  await connection.query(
    `INSERT INTO token_bucket_state (client_id, available_tokens, last_refill_at, updated_at)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (client_id) DO UPDATE
       SET available_tokens = EXCLUDED.available_tokens,
           last_refill_at = EXCLUDED.last_refill_at,
           updated_at = EXCLUDED.updated_at`,
    [clientConfiguration.id, result.availableTokens, now],
  );

  return result;
}
