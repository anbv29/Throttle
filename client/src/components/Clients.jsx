import { ClientForm } from './ClientForm.jsx';

export function Clients({ clients, editingClient, onEdit, onCancelEdit, onSave, onDelete, saving }) {
  return (
    <section className="page-panel" aria-labelledby="clients-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Access policies</p>
          <h2 id="clients-title">Client management</h2>
          <p>Create and maintain an independent policy for every caller.</p>
        </div>
        <span className="count-badge">{clients.length} clients</span>
      </div>

      <div className="client-layout">
        <ClientForm
          editingClient={editingClient}
          onSave={onSave}
          onCancel={onCancelEdit}
          saving={saving}
        />

        <div className="client-list" aria-live="polite">
          {clients.length === 0 ? (
            <div className="empty-state client-empty">
              <span className="empty-mark">＋</span>
              <h3>No configured clients</h3>
              <p>Create one using the form to start controlling traffic.</p>
            </div>
          ) : clients.map((client) => (
            <article className="client-card" key={client.id}>
              <div className="client-card-top">
                <div className="client-monogram">{client.clientKey.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3>{client.clientKey}</h3>
                  <span className="algorithm-label">{client.algorithm.replace('_', ' ')}</span>
                </div>
                <span className="active-label">Active</span>
              </div>
              <div className="client-stats">
                {client.algorithm === 'token_bucket' ? (
                  <>
                    <span><small>Refill rate</small><strong>{client.requestsPerSecond}/sec</strong></span>
                    <span><small>Burst</small><strong>{client.burstSize}</strong></span>
                  </>
                ) : (
                  <>
                    <span><small>Request limit</small><strong>{client.maxRequests}</strong></span>
                    <span><small>Window</small><strong>{client.windowSeconds}s</strong></span>
                  </>
                )}
              </div>
              <div className="client-actions">
                <button className="button secondary" onClick={() => onEdit(client)}>Edit</button>
                <button className="button danger" onClick={() => onDelete(client.clientKey)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
