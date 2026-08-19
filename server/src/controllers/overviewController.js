import { getOverview } from '../services/overviewService.js';
import { getTrafficAnalytics } from '../services/analyticsService.js';
import { getClientActivity } from '../services/clientActivityService.js';
import { validateClientKey } from '../validators/clientValidator.js';

export async function getOverviewController(request, response) {
  response.json(await getOverview());
}

export async function getTrafficAnalyticsController(request, response) {
  response.json(await getTrafficAnalytics(request.query.range));
}

export async function getClientActivityController(request, response) {
  const clientKey = validateClientKey(request.params.clientKey);
  response.json(await getClientActivity(clientKey));
}
