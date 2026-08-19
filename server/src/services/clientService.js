import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { AppError } from '../utils/AppError.js';

const CLIENT_COLUMNS = `
  c.id, c.client_key, c.algorithm, c.requests_per_second, c.burst_size,
  c.max_requests, c.window_seconds, c.created_at, c.updated_at,
  t.available_tokens, t.last_refill_at,
  COALESCE(a.total_requests, 0) AS total_requests, a.last_activity_at
`;

const CLIENT_JOINS = `
  LEFT JOIN token_bucket_state t ON t.client_id = c.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS total_requests, MAX(requested_at) AS last_activity_at
    FROM rate_limit_activity
    WHERE client_id = c.id
  ) a ON TRUE
`;

function mapClient(row) {
  return {
    id: row.id,
    clientKey: row.client_key,
    algorithm: row.algorithm,
    requestsPerSecond: row.requests_per_second,
    burstSize: row.burst_size,
    maxRequests: row.max_requests,
    windowSeconds: row.window_seconds,
    state: row.algorithm === 'token_bucket'
      ? {
          availableTokens: row.available_tokens,
          lastRefillAt: row.last_refill_at,
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalRequests: row.total_requests ?? 0,
    lastActivityAt: row.last_activity_at,
  };
}

export async function listClients() {
  const result = await pool.query(
    `SELECT ${CLIENT_COLUMNS}
       FROM clients c
       ${CLIENT_JOINS}
      ORDER BY c.created_at DESC`,
  );
  return result.rows.map(mapClient);
}

export async function getClient(clientKey) {
  const result = await pool.query(
    `SELECT ${CLIENT_COLUMNS}
       FROM clients c
       ${CLIENT_JOINS}
      WHERE c.client_key = $1`,
    [clientKey],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client configuration not found');
  }
  return mapClient(result.rows[0]);
}

export async function createClient(configuration) {
  return withTransaction(async (connection) => {
    const result = await connection.query(
      `INSERT INTO clients
         (client_key, algorithm, requests_per_second, burst_size, max_requests, window_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        configuration.clientKey,
        configuration.algorithm,
        configuration.requestsPerSecond,
        configuration.burstSize,
        configuration.maxRequests,
        configuration.windowSeconds,
      ],
    );

    if (configuration.algorithm === 'token_bucket') {
      await connection.query(
        `INSERT INTO token_bucket_state (client_id, available_tokens)
         VALUES ($1, $2)`,
        [result.rows[0].id, configuration.burstSize],
      );
    }

    return getClientWithConnection(connection, configuration.clientKey);
  });
}

export async function updateClient(existingClientKey, configuration) {
  return withTransaction(async (connection) => {
    const lockedClient = await connection.query(
      'SELECT id FROM clients WHERE client_key = $1 FOR UPDATE',
      [existingClientKey],
    );
    if (lockedClient.rowCount === 0) {
      throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client configuration not found');
    }
    const clientId = lockedClient.rows[0].id;

    await connection.query(
      `UPDATE clients
          SET client_key = $1,
              algorithm = $2,
              requests_per_second = $3,
              burst_size = $4,
              max_requests = $5,
              window_seconds = $6,
              updated_at = clock_timestamp()
        WHERE id = $7`,
      [
        configuration.clientKey,
        configuration.algorithm,
        configuration.requestsPerSecond,
        configuration.burstSize,
        configuration.maxRequests,
        configuration.windowSeconds,
        clientId,
      ],
    );

    await connection.query('DELETE FROM token_bucket_state WHERE client_id = $1', [clientId]);
    await connection.query('DELETE FROM sliding_window_events WHERE client_id = $1', [clientId]);
    if (configuration.algorithm === 'token_bucket') {
      await connection.query(
        'INSERT INTO token_bucket_state (client_id, available_tokens) VALUES ($1, $2)',
        [clientId, configuration.burstSize],
      );
    }

    return getClientWithConnection(connection, configuration.clientKey);
  });
}

export async function deleteClient(clientKey) {
  const result = await pool.query('DELETE FROM clients WHERE client_key = $1 RETURNING client_key', [clientKey]);
  if (result.rowCount === 0) {
    throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client configuration not found');
  }
}

async function getClientWithConnection(connection, clientKey) {
  const result = await connection.query(
    `SELECT ${CLIENT_COLUMNS}
       FROM clients c
       ${CLIENT_JOINS}
      WHERE c.client_key = $1`,
    [clientKey],
  );
  return mapClient(result.rows[0]);
}
