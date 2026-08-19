import { AppError } from '../utils/AppError.js';

export function notFoundHandler(request, response, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.path} was not found`));
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  let normalizedError = error;

  if (error.type === 'entity.parse.failed') {
    normalizedError = new AppError(400, 'INVALID_JSON', 'Request body contains invalid JSON');
  } else if (error.code === '23505') {
    normalizedError = new AppError(409, 'DUPLICATE_CLIENT_KEY', 'A client with this key already exists');
  } else if (error.code === '23514' || error.code === '22P02') {
    normalizedError = new AppError(400, 'VALIDATION_ERROR', 'Invalid rate limit configuration');
  }

  if (!(normalizedError instanceof AppError)) {
    console.error('Unhandled request error', error);
    normalizedError = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  const body = {
    error: normalizedError.code,
    message: normalizedError.message,
    requestId: request.requestId,
  };
  if (normalizedError.details) body.details = normalizedError.details;

  response.status(normalizedError.statusCode).json(body);
}
