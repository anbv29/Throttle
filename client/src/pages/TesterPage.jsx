import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Database, FlaskConical, Gauge, LockKeyhole, Play, Send, ShieldCheck, Timer, Users, XCircle, Zap } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';

const flowStages = [
  [Send, 'Request', 'Receive the client key'],
  [Users, 'Identify client', 'Load its policy'],
  [Gauge, 'Select algorithm', 'Token Bucket or Sliding Window'],
  [LockKeyhole, 'Protect state', 'Lock the client row'],
  [Database, 'Atomic operation', 'Calculate and persist'],
  [ShieldCheck, 'Decision', 'ALLOW or DENY'],
];

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function TesterPage({ clients, onCheck }) {
  const [clientKey, setClientKey] = useState('');
  const [activeStage, setActiveStage] = useState(-1);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [requestCount, setRequestCount] = useState(100);
  const [concurrency, setConcurrency] = useState(25);
  const [bulk, setBulk] = useState(null);

  useEffect(() => { if (!clientKey && clients.length) setClientKey(clients[0].clientKey); }, [clientKey, clients]);
  const selectedClient = clients.find((client) => client.clientKey === clientKey);

  async function sendOne() {
    if (!clientKey.trim()) return;
    setSending(true); setResult(null); setActiveStage(0);
    try {
      const requestPromise = onCheck(clientKey.trim());
      for (let index = 1; index < flowStages.length; index += 1) { await wait(130); setActiveStage(index); }
      const decision = await requestPromise;
      setResult(decision);
    } finally { setSending(false); }
  }

  async function runBulkTest() {
    const total = Math.min(1000, Math.max(1, Number(requestCount)));
    const batchSize = Math.min(500, Math.max(1, Number(concurrency)));
    const startedAt = performance.now();
    const metrics = { running: true, completed: 0, allowed: 0, denied: 0, errors: 0, requestsPerSecond: 0 };
    setBulk({ ...metrics });
    for (let offset = 0; offset < total; offset += batchSize) {
      const currentBatch = Math.min(batchSize, total - offset);
      const responses = await Promise.allSettled(Array.from({ length: currentBatch }, () => onCheck(clientKey.trim())));
      responses.forEach((response) => {
        if (response.status === 'rejected') metrics.errors += 1;
        else if (response.value.allowed) metrics.allowed += 1;
        else metrics.denied += 1;
      });
      metrics.completed += currentBatch;
      metrics.requestsPerSecond = metrics.completed / ((performance.now() - startedAt) / 1000);
      setBulk({ ...metrics });
      await wait(30);
    }
    setBulk({ ...metrics, running: false, elapsedMilliseconds: performance.now() - startedAt });
  }

  const normalizedRequestCount = Math.min(1000, Math.max(1, Number(requestCount) || 1));
  const progress = bulk ? Math.round((bulk.completed / normalizedRequestCount) * 100) : 0;
  const configuredLimit = selectedClient?.algorithm === 'token_bucket' ? selectedClient.burstSize : selectedClient?.maxRequests;
  const correctnessPassed = bulk && bulk.errors === 0 && (!configuredLimit || bulk.allowed <= configuredLimit);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Interactive request lab" title="Live request tester" description="Watch a real check move through the same API, transaction, and PostgreSQL state your applications use." />
      <div className="tester-command-grid">
        <GlassSurface className="request-control-panel">
          <div className="panel-heading"><div><h2>Request controls</h2><p>Select any configured client or enter a key.</p></div><StatusBadge tone="success">Live API</StatusBadge></div>
          <label className="premium-field"><span>Client key</span><input list="tester-clients" value={clientKey} onChange={(event) => setClientKey(event.target.value)} placeholder="payment-service" /><datalist id="tester-clients">{clients.map((client) => <option key={client.id} value={client.clientKey} />)}</datalist></label>
          {selectedClient && <div className="selected-policy"><span>{selectedClient.algorithm === 'token_bucket' ? <Zap /> : <Activity />}</span><div><small>SELECTED POLICY</small><strong>{selectedClient.algorithm.replace('_', ' ')}</strong><p>{selectedClient.algorithm === 'token_bucket' ? `${selectedClient.requestsPerSecond}/sec · burst ${selectedClient.burstSize}` : `${selectedClient.maxRequests} requests / ${selectedClient.windowSeconds}s`}</p></div></div>}
          <button className="send-request-button" onClick={sendOne} disabled={sending || !clientKey.trim()}><span><Send size={20} /></span><div><strong>{sending ? 'PROCESSING REQUEST' : 'SEND REQUEST'}</strong><small>POST /api/v1/rate-limit/check</small></div></button>
          {result && <GlassSurface className={`tester-result ${result.allowed ? 'allowed' : 'denied'}`}><span className="result-icon">{result.allowed ? <CheckCircle2 /> : <XCircle />}</span><div><small>BACKEND DECISION</small><h3>{result.allowed ? 'Request allowed' : 'Rate limit exceeded'}</h3><p>{result.algorithm?.replace('_', ' ')} · reset {new Date(result.resetAt).toLocaleTimeString()}</p></div><div className="result-numbers"><span><small>Remaining</small><strong>{result.remaining}</strong></span><span><small>Limit</small><strong>{result.limit}</strong></span></div></GlassSurface>}
        </GlassSurface>

        <GlassSurface className="request-flow-panel">
          <div className="panel-heading"><div><h2>Atomic decision flow</h2><p>Actual backend responsibilities, visualized.</p></div>{sending && <span className="processing-chip"><i /> Processing</span>}</div>
          <div className="vertical-flow">{flowStages.map(([Icon, title, description], index) => <div className={`${index === activeStage ? 'active' : ''} ${result && index <= activeStage ? 'complete' : ''}`} key={title}><span className="flow-step-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{description}</small></span>{index < flowStages.length - 1 && <i className="flow-step-line" />}</div>)}</div>
          <div className="atomic-note"><LockKeyhole size={17} /><p><strong>No process-local shortcut.</strong> The client row is locked and state is committed atomically in PostgreSQL.</p></div>
        </GlassSurface>
      </div>

      <GlassSurface className="bulk-test-panel">
        <div className="panel-heading"><div><h2>Bulk & concurrency test</h2><p>Prove correctness when many requests compete for the same shared state.</p></div><StatusBadge tone="violet">Real requests</StatusBadge></div>
        <div className="bulk-layout">
          <div className="bulk-controls">
            <div className="bulk-fields"><label className="premium-field"><span>Number of requests</span><input type="number" min="1" max="1000" value={requestCount} onChange={(event) => setRequestCount(Number(event.target.value))} /></label><label className="premium-field"><span>Concurrency</span><input type="number" min="1" max="500" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></label></div>
            <div className="bulk-explanation"><ShieldCheck size={18} /><p>This test checks more than speed. It verifies that simultaneous requests never exceed the configured limit because of a race condition.{configuredLimit ? ` This client's immediate limit is ${configuredLimit}.` : ''}</p></div>
            <button className="button primary large" onClick={runBulkTest} disabled={bulk?.running || !clientKey.trim()}><Play size={16} /> {bulk?.running ? 'Test in progress…' : 'Run concurrency test'}</button>
          </div>
          <div className="bulk-progress-card">
            <div className="progress-heading"><span>{bulk?.running ? 'Processing requests…' : bulk ? 'Test complete' : 'Ready to test'}</span><strong>{bulk ? `${Math.min(100, progress)}%` : '—'}</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, progress)}%` }} /></div>
            <div className="bulk-metrics">
              <span><CheckCircle2 /><small>Allowed</small><strong>{bulk?.allowed ?? 0}</strong></span><span><XCircle /><small>Denied</small><strong>{bulk?.denied ?? 0}</strong></span><span><ShieldCheck /><small>Errors</small><strong>{bulk?.errors ?? 0}</strong></span><span><Timer /><small>Requests/sec</small><strong>{bulk ? Math.round(bulk.requestsPerSecond) : 0}</strong></span>
            </div>
            {bulk && !bulk.running && <div className={`correctness-result ${correctnessPassed ? 'pass' : 'fail'}`}><ShieldCheck size={17} /><span><strong>{correctnessPassed ? 'Correctness check passed' : 'Review test result'}</strong><small>{correctnessPassed ? `${bulk.allowed} allowed decisions committed without exceeding the configured limit.` : `${bulk.errors} request errors occurred, or the allowed count exceeded the expected immediate limit.`}</small></span></div>}
          </div>
        </div>
      </GlassSurface>
    </div>
  );
}
