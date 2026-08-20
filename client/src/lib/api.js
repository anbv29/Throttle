const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiUnavailable = response.status >= 500 && !body.error;
    const error = new Error(
      body.message ?? (apiUnavailable
        ? 'The API is unavailable. Start the backend and PostgreSQL, then retry.'
        : `Request failed with status ${response.status}`),
    );
    error.code = body.error ?? (apiUnavailable ? 'API_UNAVAILABLE' : 'REQUEST_FAILED');
    error.details = body.details;
    error.status = response.status;
    error.headers = response.headers;
    error.body = body;
    throw error;
  }

  return { body, headers: response.headers, status: response.status };
}

export const api = {
  overview: () => apiRequest('/api/v1/admin/overview'),
  analytics: (range = '15m') => apiRequest(`/api/v1/admin/analytics?range=${encodeURIComponent(range)}`),
  clients: () => apiRequest('/api/v1/admin/clients'),
  clientActivity: (clientKey) => apiRequest(
    `/api/v1/admin/clients/${encodeURIComponent(clientKey)}/activity`,
  ),
  health: () => apiRequest('/health/ready'),
  createClient: (configuration) => apiRequest('/api/v1/admin/clients', {
    method: 'POST',
    body: JSON.stringify(configuration),
  }),
  updateClient: (originalKey, configuration) => apiRequest(
    `/api/v1/admin/clients/${encodeURIComponent(originalKey)}`,
    { method: 'PUT', body: JSON.stringify(configuration) },
  ),
  deleteClient: (clientKey) => apiRequest(
    `/api/v1/admin/clients/${encodeURIComponent(clientKey)}`,
    { method: 'DELETE' },
  ),
  check: async (clientKey, { signal } = {}) => {
    try {
      return await apiRequest('/api/v1/rate-limit/check', {
        method: 'POST',
        body: JSON.stringify({ clientKey }),
        signal,
      });
    } catch (error) {
      if (error.status === 429) {
        return { body: error.body, headers: error.headers, status: error.status };
      }
      throw error;
    }
  },
};
