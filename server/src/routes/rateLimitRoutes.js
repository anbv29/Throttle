import { Router } from 'express';
import { checkRateLimitController } from '../controllers/rateLimitController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const rateLimitRouter = Router();

rateLimitRouter.post('/check', asyncHandler(checkRateLimitController));
