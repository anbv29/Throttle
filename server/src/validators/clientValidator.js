import { AppError } from '../utils/AppError.js';

const CLIENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ALGORITHMS = new Set(['token_bucket', 'sliding_window']);
const MAX_POSTGRES_INTEGER = 2_147_483_647;

function validationError(details) {
  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid rate limit configuration', details);
}

function validatePositiveNumber(value, field, { integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    validationError({ [field]: `${field} must be a positive number` });
  }
  if (integer && !Number.isSafeInteger(value)) {
    validationError({ [field]: `${field} must be a positive integer` });
  }
  if (integer && value > MAX_POSTGRES_INTEGER) {
    validationError({ [field]: `${field} must not exceed ${MAX_POSTGRES_INTEGER}` });
  }
  return value;
}

export function validateClientKey(value) {
  if (typeof value !== 'string' || !CLIENT_KEY_PATTERN.test(value)) {
    validationError({
      clientKey:
        'clientKey must be 1-128 characters and contain only letters, numbers, dots, underscores, colons, or hyphens',
    });
  }
  return value;
}

export function validateClientConfiguration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    validationError({ body: 'A JSON object is required' });
  }

  const clientKey = validateClientKey(body.clientKey);
  if (!ALGORITHMS.has(body.algorithm)) {
    validationError({ algorithm: 'algorithm must be token_bucket or sliding_window' });
  }

  if (body.algorithm === 'token_bucket') {
    return {
      clientKey,
      algorithm: body.algorithm,
      requestsPerSecond: validatePositiveNumber(body.requestsPerSecond, 'requestsPerSecond'),
      burstSize: validatePositiveNumber(body.burstSize, 'burstSize', { integer: true }),
      maxRequests: null,
      windowSeconds: null,
    };
  }

  return {
    clientKey,
    algorithm: body.algorithm,
    requestsPerSecond: null,
    burstSize: null,
    maxRequests: validatePositiveNumber(body.maxRequests, 'maxRequests', { integer: true }),
    windowSeconds: validatePositiveNumber(body.windowSeconds, 'windowSeconds', { integer: true }),
  };
}

export function validateRateLimitCheck(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    validationError({ body: 'A JSON object is required' });
  }
  return { clientKey: validateClientKey(body.clientKey) };
}
