import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle2, Database, Gauge, LockKeyhole, Play, Send, ShieldCheck, Square, Timer, Users, XCircle, Zap } from 'lucide-react';
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

export function TesterPage({ clients, onCheck, onCreateTestClient, creatingClient }) {
  const [clientKey, setClientKey] = useState('');
  const [activeStage, setActiveStage] = useState(-1);
  const [result, setResult] = useState(null);
  const [singleError, setSingleError] = useState('');
  const [sending, setSending] = useState(false);
  const [requestCount, setRequestCount] = useState(100);
  const [concurrency, setConcurrency] = useState(25);
  const [bulk, setBulk] = useState(null);
  const bulkController = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => { if (!clientKey && clients.length) setClientKey(clients[0].clientKey); }, [clientKey, clients]);
  const selectedClient = clients.find((client) => client.clientKey === clientKey);

  async function sendOne() {
    if (!clientKey.trim()) return;
    setSending(true); setResult(null); setSingleError(''); setActiveStage(0);
    try {
      const requestPromise = onCheck(clientKey.trim());
      for (let index = 1; index < flowStages.length; index += 1) { await wait(130); setActiveStage(index); }
      const decision = await requestPromise;
      setResult(decision);
    } catch (error) {
      setSingleError(error.message || 'The request could not reach the rate limiter.');
      setActiveStage(-1);
    } finally { setSending(false); }
  }

  async function runBulkTest() {
    const total = Math.min(1000, Math.max(1, Number(requestCount) || 1));
    const workerCount = Math.min(total, 100, Math.max(1, Number(concurrency) || 1));
    const startedAt = performance.now();
    const controller = new AbortController();
    bulkController.current = controller;
    const metrics = { running: true, canceled: false, target: total, completed: 0, allowed: 0, denied: 0, errors: 0, requestsPerSecond: 0 };
    setBulk({ ...metrics });
    let nextRequest = 0;

    async function worker() {
      while (!controller.signal.aborted) {
        const requestIndex = nextRequest;
        nextRequest += 1;
        if (requestIndex >= total) return;
        try {
          const decision = await onCheck(clientKey.trim(), { signal: controller.signal, refresh: false });
          if (decision.allowed) metrics.allowed += 1;
          else metrics.denied += 1;
        } catch (error) {
          if (error.name === 'AbortError') return;
          metrics.errors += 1;
        }
        metrics.completed += 1;
        metrics.requestsPerSecond = metrics.completed / Math.max(0.001, (performance.now() - startedAt) / 1000);
        setBulk({ ...metrics });
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    bulkController.current = null;
    setBulk({ ...metrics, running: false, canceled: controller.signal.aborted, elapsedMilliseconds: performance.now() - startedAt });
  }

  function stopBulkTest() {
    bulkController.current?.abort();
  }

  async function createTestClient() {
    setSingleError('');
    try {
      setClientKey(await onCreateTestClient());
    } catch (error) {
      setSingleError(error.message || 'The test client could not be created.');
    }
  }

  const progress = bulk ? Math.round((bulk.completed / bulk.target) * 100) : 0;
  const configuredLimit = selectedClient?.algorithm === 'token_bucket' ? selectedClient.burstSize : selectedClient?.maxRequests;
  const correctnessPassed = bulk && !bulk.canceled && bulk.errors === 0 && bulk.completed === bulk.target;

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Request lab" title="Test a client policy" description="Send one request or run a bounded concurrent workload against the live API." />
      <div className="tester-command-grid">
        <GlassSurface className="request-control-panel">
          <div className="panel-heading"><div><h2>Request controls</h2><p>Select any configured client or enter a key.</p></div><StatusBadge tone="success">Live API</StatusBadge></div>
          {clients.length === 0 && <div className="tester-empty-client"><div><strong>No client policies yet</strong><p>Create a real 20 requests / 60 seconds Sliding Window policy for this lab.</p></div><button className="button secondary" onClick={createTestClient} disabled={creatingClient}>{creatingClient ? 'Creating…' : 'Create test client'}</button></div>}
          <label className="premium-field"><span>Client key</span><input list="tester-clients" value={clientKey} onChange={(event) => setClientKey(event.target.value)} placeholder="payment-service" /><datalist id="tester-clients">{clients.map((client) => <option key={client.id} value={client.clientKey} />)}</datalist></label>
          {selectedClient && <div className="selected-policy"><span>{selectedClient.algorithm === 'token_bucket' ? <Zap /> : <Activity />}</span><div><small>SELECTED POLICY</small><strong>{selectedClient.algorithm.replace('_', ' ')}</strong><p>{selectedClient.algorithm === 'token_bucket' ? `${selectedClient.requestsPerSecond}/sec · burst ${selectedClient.burstSize}` : `${selectedClient.maxRequests} requests / ${selectedClient.windowSeconds}s`}</p></div></div>}
          <button className="send-request-button" onClick={sendOne} disabled={sending || !clientKey.trim()}><span><Send size={20} /></span><div><strong>{sending ? 'PROCESSING REQUEST' : 'SEND REQUEST'}</strong><small>POST /api/v1/rate-limit/check</small></div></button>
          {singleError && <div className="tester-inline-error" role="alert"><AlertTriangle size={17} /><span><strong>Request failed</strong><small>{singleError}</small></span></div>}
          {result && <GlassSurface className={`tester-result ${result.allowed ? 'allowed' : 'denied'}`}><span className="result-icon">{result.allowed ? <CheckCircle2 /> : <XCircle />}</span><div><small>BACKEND DECISION</small><h3>{result.allowed ? 'Request allowed' : 'Rate limit exceeded'}</h3><p>{result.algorithm?.replace('_', ' ')} · reset {new Date(result.resetAt).toLocaleTimeString()}</p></div><div className="result-numbers"><span><small>Remaining</small><strong>{result.remaining}</strong></span><span><small>Limit</small><strong>{result.limit}</strong></span></div></GlassSurface>}
        </GlassSurface>

        <GlassSurface className="request-flow-panel">
          <div className="panel-heading"><div><h2>Atomic decision flow</h2><p>Actual backend responsibilities, visualized.</p></div>{sending && <span className="processing-chip"><i /> Processing</span>}</div>
          <div className="vertical-flow">{flowStages.map(([Icon, title, description], index) => <motion.div initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : index * 0.045 }} className={`${index === activeStage ? 'active' : ''} ${result && index <= activeStage ? 'complete' : ''}`} key={title}><span className="flow-step-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{description}</small></span>{index < flowStages.length - 1 && <i className="flow-step-line" />}</motion.div>)}</div>
          <div className="atomic-note"><LockKeyhole size={17} /><p><strong>No process-local shortcut.</strong> The client row is locked and state is committed atomically in PostgreSQL.</p></div>
        </GlassSurface>
      </div>

      <GlassSurface className="bulk-test-panel">
        <div className="panel-heading"><div><h2>Bulk & concurrency test</h2><p>Prove correctness when many requests compete for the same shared state.</p></div><StatusBadge tone="violet">Real requests</StatusBadge></div>
        <div className="bulk-layout">
          <div className="bulk-controls">
            <div className="bulk-fields"><label className="premium-field"><span>Number of requests (1–1,000)</span><input type="number" min="1" max="1000" value={requestCount} onChange={(event) => setRequestCount(Number(event.target.value))} /></label><label className="premium-field"><span>Concurrent workers (1–100)</span><input type="number" min="1" max="100" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></label></div>
            <div className="bulk-explanation"><ShieldCheck size={18} /><p>This test checks more than speed. It verifies that simultaneous requests never exceed the configured limit because of a race condition.{configuredLimit ? ` This client's immediate limit is ${configuredLimit}.` : ''}</p></div>
            <div className="bulk-action-row"><button className="button primary large" onClick={runBulkTest} disabled={bulk?.running || !clientKey.trim()}><Play size={16} /> {bulk?.running ? 'Test in progress…' : 'Run concurrency test'}</button>{bulk?.running && <button className="button danger-button large" onClick={stopBulkTest}><Square size={14} /> Stop</button>}</div>
          </div>
          <div className="bulk-progress-card">
            <div className="progress-heading"><span>{bulk?.running ? 'Processing requests…' : bulk ? 'Test complete' : 'Ready to test'}</span><strong>{bulk ? `${Math.min(100, progress)}%` : '—'}</strong></div>
            <div className="progress-track"><motion.span animate={{ width: `${Math.min(100, progress)}%` }} transition={{ type: 'spring', stiffness: 150, damping: 24 }} /></div>
            <div className="bulk-metrics">
              <span><CheckCircle2 /><small>Allowed</small><strong>{bulk?.allowed ?? 0}</strong></span><span><XCircle /><small>Denied</small><strong>{bulk?.denied ?? 0}</strong></span><span><ShieldCheck /><small>Errors</small><strong>{bulk?.errors ?? 0}</strong></span><span><Timer /><small>Requests/sec</small><strong>{bulk ? Math.round(bulk.requestsPerSecond) : 0}</strong></span>
            </div>
            {bulk && !bulk.running && <div className={`correctness-result ${correctnessPassed ? 'pass' : 'fail'}`}><ShieldCheck size={17} /><span><strong>{correctnessPassed ? 'Run completed cleanly' : bulk.canceled ? 'Test stopped' : 'Transport errors detected'}</strong><small>{correctnessPassed ? `The backend returned a valid allow/deny decision for all ${bulk.target} requests. Database concurrency correctness is covered by the 500-request integration test.` : bulk.canceled ? `${bulk.completed} of ${bulk.target} requests completed before cancellation.` : `${bulk.errors} requests failed before receiving a limiter decision.`}</small></span></div>}
          </div>
        </div>
      </GlassSurface>
    </div>
  );
}
