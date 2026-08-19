import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, Clock3, FlaskConical, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { GlassSurface, PageHeader, Skeleton, StatusBadge } from '../components/Glass.jsx';
import { api } from '../lib/api.js';

export function ClientDetailsPage({ clientKey, clients, navigate, onCheck }) {
  const client = clients.find((item) => item.clientKey === clientKey);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [testing, setTesting] = useState(false);
  const [lastDecision, setLastDecision] = useState(null);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setActivity((await api.clientActivity(clientKey)).body);
    } catch (error) {
      setLoadError(error.message || 'Could not load client activity.');
    } finally {
      setLoading(false);
    }
  }, [clientKey]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  const usagePercent = useMemo(() => {
    if (!activity || !client) return 0;
    const state = activity.currentState;
    return client.algorithm === 'token_bucket'
      ? Math.min(100, (state.availableTokens / state.capacity) * 100)
      : Math.min(100, (state.currentUsage / state.limit) * 100);
  }, [activity, client]);

  if (!client) return <div className="page-wrap"><GlassSurface className="not-found"><h2>Client not found</h2><p>The requested configuration may have been deleted.</p><button className="button primary" onClick={() => navigate('/clients')}>Back to clients</button></GlassSurface></div>;

  if (!loading && (!activity || loadError)) return <div className="page-wrap"><GlassSurface className="not-found"><h2>Activity unavailable</h2><p>{loadError || 'The client activity response was empty.'}</p><button className="button primary" onClick={loadActivity}>Try again</button></GlassSurface></div>;

  async function testRequest() {
    setTesting(true);
    try { setLastDecision(await onCheck(clientKey)); await loadActivity(); } finally { setTesting(false); }
  }

  const state = activity?.currentState;
  return (
    <div className="page-wrap">
      <button className="breadcrumb-back" onClick={() => navigate('/clients')}><ArrowLeft size={15} /> All clients</button>
      <PageHeader eyebrow="Client details" title={client.clientKey} description="Current limiter state, durable statistics, and real request activity." actions={<><button className="button secondary" onClick={loadActivity}><RefreshCw size={14} /> Refresh</button><button className="button primary" onClick={testRequest} disabled={testing}><FlaskConical size={14} /> {testing ? 'Checking…' : 'Send request'}</button></>} />
      <div className="details-hero-grid">
        <GlassSurface className={`state-visual ${client.algorithm}`}>
          <div className="state-visual-heading"><span className="algorithm-emblem">{client.algorithm === 'token_bucket' ? <Zap /> : <Activity />}</span><div><small>CURRENT ALGORITHM</small><h2>{client.algorithm.replace('_', ' ')}</h2></div><StatusBadge tone="success">Persistent state</StatusBadge></div>
          {loading ? <Skeleton className="state-skeleton" /> : client.algorithm === 'token_bucket' ? <>
            <div className="large-bucket"><span style={{ height: `${usagePercent}%` }} /><div className="large-token-grid">{Array.from({ length: Math.min(20, client.burstSize) }, (_, index) => <i className={index < Math.round((state.availableTokens / state.capacity) * Math.min(20, client.burstSize)) ? 'filled' : ''} key={index} />)}</div></div>
            <div className="state-primary-value"><strong>{Math.floor(state.availableTokens)} <small>/ {state.capacity}</small></strong><span>Tokens available</span></div>
            <div className="state-config-row"><span><small>Refill rate</small><strong>{state.refillRate} tokens/sec</strong></span><span><small>Last state update</small><strong>{state.lastRefillAt ? new Date(state.lastRefillAt).toLocaleTimeString() : '—'}</strong></span></div>
          </> : <>
            <div className="large-window"><div className="window-axis"><span>{state.windowSeconds}s ago</span><span>Active window</span><span>Now</span></div><div className="detail-events">{activity.recentActivity.filter((event) => event.allowed).slice(0, Math.min(18, state.currentUsage)).map((event, index) => <i style={{ left: `${Math.max(4, 94 - index * (88 / Math.max(1, state.currentUsage)))}%` }} key={event.requestedAt} />)}</div><span className="window-now" /></div>
            <div className="state-primary-value"><strong>{state.currentUsage} <small>/ {state.limit}</small></strong><span>Requests used in active window</span></div>
            <div className="state-config-row"><span><small>Remaining</small><strong>{state.remaining} requests</strong></span><span><small>Window duration</small><strong>{state.windowSeconds} seconds</strong></span></div>
          </>}
        </GlassSurface>
        <div className="detail-side-stack">
          {lastDecision && <GlassSurface className={`last-decision ${lastDecision.allowed ? 'allowed' : 'denied'}`}><span>{lastDecision.allowed ? <CheckCircle2 /> : '×'}</span><div><small>LATEST TEST</small><strong>{lastDecision.allowed ? 'Request allowed' : 'Rate limit exceeded'}</strong><p>{lastDecision.remaining} remaining · reset {new Date(lastDecision.resetAt).toLocaleTimeString()}</p></div></GlassSurface>}
          <GlassSurface className="client-summary-card"><h3>Lifetime statistics</h3>{loading ? <Skeleton className="summary-skeleton" /> : <div className="summary-stat-grid"><span><Activity /><small>Total requests</small><strong>{activity.summary.totalRequests.toLocaleString()}</strong></span><span><CheckCircle2 /><small>Allowed</small><strong>{activity.summary.allowedRequests.toLocaleString()}</strong></span><span><ShieldCheck /><small>Denied</small><strong>{activity.summary.deniedRequests.toLocaleString()}</strong></span><span><Clock3 /><small>Average decision</small><strong>{activity.summary.averageResponseTimeMs.toFixed(1)} ms</strong></span></div>}</GlassSurface>
          <GlassSurface className="configuration-card"><h3>Configuration</h3><dl>{client.algorithm === 'token_bucket' ? <><div><dt>Requests per second</dt><dd>{client.requestsPerSecond}</dd></div><div><dt>Burst capacity</dt><dd>{client.burstSize}</dd></div></> : <><div><dt>Maximum requests</dt><dd>{client.maxRequests}</dd></div><div><dt>Window seconds</dt><dd>{client.windowSeconds}</dd></div></>}<div><dt>Created</dt><dd>{new Date(client.createdAt).toLocaleDateString()}</dd></div></dl></GlassSurface>
        </div>
      </div>
      <GlassSurface className="recent-panel"><div className="panel-heading"><div><h2>Client activity</h2><p>Latest durable decisions for {client.clientKey}.</p></div></div>{loading ? <Skeleton className="chart-skeleton" /> : <div className="activity-stream">{activity.recentActivity.length ? activity.recentActivity.map((event) => <div key={event.requestedAt}><StatusBadge tone={event.allowed ? 'success' : 'danger'}>{event.allowed ? 'Allowed' : 'Denied'}</StatusBadge><span>{event.remaining} remaining</span><span>{event.responseTimeMs == null ? '—' : `${event.responseTimeMs.toFixed(1)} ms`}</span><time>{new Date(event.requestedAt).toLocaleString()}</time></div>) : <p className="inline-empty">No requests recorded for this client yet.</p>}</div>}</GlassSurface>
    </div>
  );
}
