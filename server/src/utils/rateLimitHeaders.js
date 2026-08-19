export function setRateLimitHeaders(response, result) {
  response.set({
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
  });

  if (!result.allowed && result.retryAfterSeconds !== undefined) {
    response.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterSeconds))));
  }
}
