import { useEffect, useState } from 'react';
import { Activity, ArrowDown, CheckCircle2, ChevronDown, Code2, Database, LockKeyhole, Play, RotateCcw, Server, ShieldCheck, Timer, Users, XCircle, Zap } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';

const requestSteps = [
  ['01', 'Identify the client', 'The caller sends a stable clientKey that maps the request to one stored policy.', 'rateLimitController validates the JSON body before the service queries PostgreSQL.'],
  ['02', 'Load configuration', 'The service loads this client’s algorithm and limits. Different callers can use different rules.', 'rateLimiterService selects requests_per_second, burst_size, max_requests, and window_seconds.'],
  ['03', 'Protect shared state', 'Requests for the same client must not spend the same token or window slot.', 'SELECT … FOR UPDATE locks the clients row as a distributed per-client mutex.'],
  ['04', 'Run an atomic transaction', 'Read, calculate, decide, persist, and commit happen as one indivisible operation.', 'PostgreSQL BEGIN/COMMIT boundaries ensure other transactions never see a half-finished decision.'],
  ['05', 'Return the decision', 'Allowed traffic receives HTTP 200. Limited traffic receives HTTP 429 and retry metadata.', 'The controller sets X-RateLimit-Limit, Remaining, Reset, and Retry-After headers.'],
];

function ProcessSteps() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="process-layout">
      <div className="process-step-list">{requestSteps.map(([number, title, quick], index) => <button className={selected === index ? 'active' : ''} onClick={() => setSelected(index)} key={number}><span>{number}</span><div><strong>{title}</strong><small>{quick}</small></div></button>)}</div>
      <GlassSurface className="process-detail"><span className="process-number">{requestSteps[selected][0]}</span><p className="eyebrow">Quick explanation</p><h3>{requestSteps[selected][1]}</h3><p>{requestSteps[selected][2]}</p><details><summary>Technical details <ChevronDown size={15} /></summary><div><Code2 size={17} /><p>{requestSteps[selected][3]}</p></div></details>{selected === 0 && <pre><code>{'{\n  "clientKey": "payment-service"\n}'}</code></pre>}{selected === 4 && <div className="http-decisions"><StatusBadge tone="success">HTTP 200 · ALLOWED</StatusBadge><StatusBadge tone="danger">HTTP 429 · LIMITED</StatusBadge></div>}</GlassSurface>
    </div>
  );
}

function TokenExplainer() {
  const [tokens, setTokens] = useState(10);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setTokens((value) => Math.min(10, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return (
    <GlassSurface className="explainer-card token-explainer">
      <div className="explainer-heading"><span><Zap /></span><div><p className="eyebrow">Interactive algorithm</p><h2>Token Bucket</h2></div><StatusBadge tone={tokens ? 'success' : 'danger'}>{tokens ? `${tokens} available` : 'Empty'}</StatusBadge></div>
      <p>Each request consumes one token. Time continuously adds tokens at the refill rate, stopping at capacity.</p>
      <div className="token-explainer-visual"><div className="explainer-token-grid">{Array.from({ length: 10 }, (_, index) => <i className={index < tokens ? 'filled' : ''} key={index} />)}</div><div className="token-scale"><span>Capacity 10</span><span>Current {tokens}</span></div></div>
      <div className="explainer-actions"><button className="button primary" onClick={() => setTokens((value) => Math.max(0, value - 1))} disabled={!tokens}><Play size={14} /> Send request</button><button className="button secondary" onClick={() => setTokens(10)}><RotateCcw size={14} /> Reset</button><button className="button subtle" onClick={() => setRunning((value) => !value)}><Timer size={14} /> Refill {running ? 'on' : 'off'}</button></div>
      <div className="formula-block"><small>REFILL FORMULA</small><code>min(capacity, currentTokens + elapsedTime × refillRate)</code></div>
    </GlassSurface>
  );
}

function WindowExplainer() {
  const [events, setEvents] = useState([12, 28, 44, 61]);
  useEffect(() => {
    const timer = window.setInterval(() => setEvents((values) => values.map((position) => position - 4).filter((position) => position > 2)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const allowed = events.length < 6;
  function add() { if (allowed) setEvents((values) => [...values, 94]); }
  return (
    <GlassSurface className="explainer-card window-explainer-card">
      <div className="explainer-heading"><span><Activity /></span><div><p className="eyebrow">Interactive algorithm</p><h2>Sliding Window</h2></div><StatusBadge tone={allowed ? 'success' : 'danger'}>{events.length} / 6 active</StatusBadge></div>
      <p>Only requests inside the continuously moving time boundary count. Old events naturally expire from the left.</p>
      <div className="window-explainer-visual"><div className="moving-window-label"><span>60 seconds ago</span><strong>ACTIVE WINDOW</strong><span>Now</span></div><div className="moving-window-track">{events.map((position, index) => <i style={{ left: `${position}%` }} key={`${position}-${index}`} />)}<span /></div></div>
      <div className="explainer-actions"><button className="button primary" onClick={add} disabled={!allowed}><Play size={14} /> {allowed ? 'Add request' : 'Limit reached'}</button><button className="button secondary" onClick={() => setEvents([])}><RotateCcw size={14} /> Clear window</button></div>
      <div className="window-decision-preview"><span><small>Next request</small><strong className={allowed ? 'success-text' : 'danger-text'}>{allowed ? 'ALLOWED' : 'DENIED'}</strong></span><span><small>Remaining</small><strong>{Math.max(0, 6 - events.length)}</strong></span><span><small>Window</small><strong>60 seconds</strong></span></div>
    </GlassSurface>
  );
}

function ConcurrencySection() {
  const [mode, setMode] = useState('safe');
  return (
    <section className="concurrency-section">
      <div className="section-intro"><p className="eyebrow">Correct under pressure</p><h2>What happens when 500 requests arrive at once?</h2><p>PostgreSQL provides shared persistent coordination. It does not make a single hot client infinitely scalable.</p></div>
      <div className="concurrency-flow"><GlassSurface><Users /><strong>500 concurrent requests</strong><small>Same client key</small></GlassSurface><ArrowDown /><GlassSurface><Server /><strong>Express API layer</strong><small>Stateless instances</small></GlassSurface><ArrowDown /><GlassSurface><Database /><strong>PostgreSQL transaction</strong><small>Lock relevant client row</small></GlassSurface><ArrowDown /><GlassSurface><ShieldCheck /><strong>Correct decisions</strong><small>Commit updated state</small></GlassSurface></div>
      <div className="race-tabs"><button className={mode === 'unsafe' ? 'active danger' : ''} onClick={() => setMode('unsafe')}>Unsafe read-modify-write</button><button className={mode === 'safe' ? 'active success' : ''} onClick={() => setMode('safe')}>Safe row locking</button></div>
      <GlassSurface className={`race-demo ${mode}`}>
        <div className="race-token"><span>Token count</span><strong>1</strong></div>
        {mode === 'unsafe' ? <div className="race-columns"><div><span>Request A reads 1</span><CheckCircle2 /><strong>ALLOW</strong></div><div><span>Request B reads 1</span><CheckCircle2 /><strong>ALLOW</strong></div><div className="race-verdict"><XCircle /><strong>Incorrect: one token spent twice</strong></div></div> : <div className="race-columns"><div><span>A locks state · updates to 0</span><CheckCircle2 /><strong>ALLOW</strong></div><div><span>B waits · then reads 0</span><XCircle /><strong>DENY</strong></div><div className="race-verdict"><ShieldCheck /><strong>Correct: no double-spending</strong></div></div>}
      </GlassSurface>
      <div className="tradeoff-note"><Database size={18} /><div><strong>The honest trade-off</strong><p>Same-client requests serialize for correctness. Different clients can proceed in parallel. Very high-scale deployments may eventually partition clients or introduce purpose-built distributed state, while preserving the same atomic invariant.</p></div></div>
    </section>
  );
}

export function HowItWorksPage() {
  return (
    <div className="page-wrap educational-page">
      <PageHeader eyebrow="From request to decision" title="How Throttle works" description="A visual guide to algorithms, database transactions, concurrency safety, and every step the backend performs." />
      <GlassSurface className="big-picture-flow"><div className="architecture-node"><Users /><small>YOUR APPLICATION</small><strong>Can this client make a request?</strong></div><ArrowDown /><div className="architecture-node primary"><ShieldCheck /><small>RATE LIMITER SERVICE</small><strong>Load · Lock · Calculate · Persist</strong></div><div className="decision-branches"><span><CheckCircle2 /> ALLOW</span><span><XCircle /> DENY</span></div></GlassSurface>
      <section className="educational-section"><div className="section-intro"><p className="eyebrow">The request lifecycle</p><h2>Five precise steps. One atomic decision.</h2><p>Select a step for a beginner-friendly explanation and the backend detail beneath it.</p></div><ProcessSteps /></section>
      <section className="educational-section"><div className="section-intro"><p className="eyebrow">Algorithm laboratory</p><h2>See the two control models behave.</h2><p>These are clearly labeled interactive explainers; production state remains in PostgreSQL.</p></div><div className="explainer-grid"><TokenExplainer /><WindowExplainer /></div></section>
      <ConcurrencySection />
    </div>
  );
}
