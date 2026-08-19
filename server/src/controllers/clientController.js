import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from '../services/clientService.js';
import { validateClientConfiguration, validateClientKey } from '../validators/clientValidator.js';

export async function listClientsController(request, response) {
  response.json({ clients: await listClients() });
}

export async function getClientController(request, response) {
  const clientKey = validateClientKey(request.params.clientKey);
  response.json({ client: await getClient(clientKey) });
}

export async function createClientController(request, response) {
  const configuration = validateClientConfiguration(request.body);
  const client = await createClient(configuration);
  response.status(201).json({ client });
}

export async function updateClientController(request, response) {
  const existingClientKey = validateClientKey(request.params.clientKey);
  const configuration = validateClientConfiguration(request.body);
  const client = await updateClient(existingClientKey, configuration);
  response.json({ client });
}

export async function deleteClientController(request, response) {
  const clientKey = validateClientKey(request.params.clientKey);
  await deleteClient(clientKey);
  response.status(204).send();
}
