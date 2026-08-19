import { Router } from 'express';
import {
  createClientController,
  deleteClientController,
  getClientController,
  listClientsController,
  updateClientController,
} from '../controllers/clientController.js';
import {
  getClientActivityController,
  getOverviewController,
  getTrafficAnalyticsController,
} from '../controllers/overviewController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();

adminRouter.get('/overview', asyncHandler(getOverviewController));
adminRouter.get('/analytics', asyncHandler(getTrafficAnalyticsController));
adminRouter.get('/clients', asyncHandler(listClientsController));
adminRouter.get('/clients/:clientKey/activity', asyncHandler(getClientActivityController));
adminRouter.get('/clients/:clientKey', asyncHandler(getClientController));
adminRouter.post('/clients', asyncHandler(createClientController));
adminRouter.put('/clients/:clientKey', asyncHandler(updateClientController));
adminRouter.delete('/clients/:clientKey', asyncHandler(deleteClientController));
