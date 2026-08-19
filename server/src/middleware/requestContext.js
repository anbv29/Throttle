import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContext(request, response, next) {
  const suppliedRequestId = request.get('X-Request-ID');
  request.requestId = suppliedRequestId && SAFE_REQUEST_ID.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID();
  response.set('X-Request-ID', request.requestId);

  if (env.requestLogging) {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'http_request',
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMilliseconds: Number(durationMilliseconds.toFixed(2)),
      }));
    });
  }

  next();
}
