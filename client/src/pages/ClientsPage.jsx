import { useMemo, useState } from 'react';
import { Activity, ChevronRight, Edit3, Plus, Search, Trash2, Users, Zap } from 'lucide-react';
import { ClientModal } from '../components/ClientModal.jsx';
import { EmptyState, GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';

const filters = [
  ['all', 'All'], ['token_bucket', 'Token Bucket'], ['sliding_window', 'Sliding Window'], ['active', 'Active'], ['inactive', 'Inactive'],
];

function formatLastActivity(timestamp) {
  if (!timestamp) return 'No requests yet';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

export function ClientsPage({ clients, navigate, saveClient, deleteClient, saving }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalClient, setModalClient] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredClients = useMemo(() => clients.filter((client) => {
    const matchesSearch = client.clientKey.toLowerCase().includes(search.toLowerCase());
    const active = client.lastActivityAt && Date.now() - new Date(client.lastActivityAt).getTime() < 5 * 60_000;
    const matchesFilter = filter === 'all' || client.algorithm === filter || (filter === 'active' && active) || (filter === 'inactive' && !active);
    return matchesSearch && matchesFilter;
  }), [clients, filter, search]);

  function openCreate() { setModalClient(null); setModalOpen(true); }
  function openEdit(client) { setModalClient(client); setModalOpen(true); }

  async function save(configuration) {
    await saveClient(configuration, modalClient || null);
    setModalOpen(false);
  }

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Access policies" title="Clients" description="Manage rate limits across applications, API consumers, and backend services." actions={<button className="button primary" onClick={openCreate}><Plus size={15} /> Create client</button>} />
      <GlassSurface className="client-toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients…" aria-label="Search clients" /></label>
        <div className="filter-tabs" role="group" aria-label="Filter clients">{filters.map(([value, label]) => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
        <span className="result-count">{filteredClients.length} of {clients.length}</span>
      </GlassSurface>

      {filteredClients.length === 0 ? <EmptyState icon={<Users size={22} />} title={clients.length ? 'No matching clients' : 'Create your first policy'} description={clients.length ? 'Try a different search or filter.' : 'Add a client to begin protecting requests with a persistent limit.'} action={!clients.length && <button className="button primary" onClick={openCreate}><Plus size={15} /> Create client</button>} /> : (
        <GlassSurface className="client-table-panel">
          <div className="client-table-head"><span>Client</span><span>Algorithm</span><span>Limit</span><span>Status</span><span>Requests</span><span>Last activity</span><span>Actions</span></div>
          <div className="client-table-body">{filteredClients.map((client) => {
            const active = client.lastActivityAt && Date.now() - new Date(client.lastActivityAt).getTime() < 5 * 60_000;
            return <div
              className="client-table-row"
              key={client.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/clients/${encodeURIComponent(client.clientKey)}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/clients/${encodeURIComponent(client.clientKey)}`);
                }
              }}
            >
              <span className="client-identity"><i>{client.clientKey.slice(0, 2).toUpperCase()}</i><span><strong>{client.clientKey}</strong><small>Client #{client.id}</small></span></span>
              <span className="algorithm-cell">{client.algorithm === 'token_bucket' ? <Zap size={15} /> : <Activity size={15} />}<span>{client.algorithm.replace('_', ' ')}</span></span>
              <span className="limit-cell">{client.algorithm === 'token_bucket' ? <><strong>{client.burstSize}</strong><small>{client.requestsPerSecond}/sec refill</small></> : <><strong>{client.maxRequests}</strong><small>per {client.windowSeconds}s</small></>}</span>
              <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Idle'}</StatusBadge>
              <span className="mono-value">{(client.totalRequests ?? 0).toLocaleString()}</span>
              <span className="last-activity">{formatLastActivity(client.lastActivityAt)}</span>
              <span className="row-actions"><button onClick={(event) => { event.stopPropagation(); openEdit(client); }} aria-label={`Edit ${client.clientKey}`}><Edit3 size={15} /></button><button className="danger" onClick={(event) => { event.stopPropagation(); deleteClient(client.clientKey); }} aria-label={`Delete ${client.clientKey}`}><Trash2 size={15} /></button><ChevronRight size={15} /></span>
            </div>;
          })}</div>
        </GlassSurface>
      )}
      {modalOpen && <ClientModal client={modalClient} onClose={() => setModalOpen(false)} onSave={save} saving={saving} />}
    </div>
  );
}
