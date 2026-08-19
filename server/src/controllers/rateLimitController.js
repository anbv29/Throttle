import { checkRateLimit } from '../services/rateLimiterService.js';
import { setRateLimitHeaders } from '../utils/rateLimitHeaders.js';
import { validateRateLimitCheck } from '../validators/clientValidator.js';

export async function checkRateLimitController(request, response) {
  const { clientKey } = validateRateLimitCheck(request.body);
  const result = await checkRateLimit(clientKey);
  setRateLimitHeaders(response, result);

  const body = {
    allowed: result.allowed,
    clientKey: result.clientKey,
    algorithm: result.algorithm,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt.toISOString(),
  };

  if (!result.allowed) body.message = 'Rate limit exceeded';
  response.status(result.allowed ? 200 : 429).json(body);
}
