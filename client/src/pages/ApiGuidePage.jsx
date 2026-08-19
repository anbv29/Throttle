import { useState } from 'react';
import { ArrowDown, Check, Clipboard, Code2, Copy, Layers3, Network, Server } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';

const expressExample = 'async function rateLimit(req, res, next) {\n  const response = await fetch(\n    "http://localhost:4000/api/v1/rate-limit/check",\n    {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({\n        clientKey: req.user.apiKey\n      })\n    }\n  );\n\n  const result = await response.json();\n\n  if (!result.allowed) {\n    return res.status(429).json({\n      message: "Too many requests",\n      retryAfter: response.headers.get("Retry-After")\n    });\n  }\n\n  next();\n}';
const curlExample = 'curl -X POST http://localhost:4000/api/v1/rate-limit/check \\\n  -H "Content-Type: application/json" \\\n  -d \'{"clientKey":"payment-service"}\'';

function CodeBlock({ title, language, code }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <GlassSurface className="code-panel"><div className="code-toolbar"><span><Code2 size={14} />{title}<small>{language}</small></span><button onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{code}</code></pre></GlassSurface>;
}

const patterns = [
  [Network, 'API gateway pattern', ['Client', 'Rate limiter', 'Backend API'], 'Make the decision at the outer edge before traffic reaches application services.'],
  [Layers3, 'Middleware pattern', ['Request', 'Application middleware', 'Rate limiter service', 'Controller'], 'Add a reusable check to selected routes while business logic stays focused.'],
  [Server, 'Microservices pattern', ['Multiple services', 'Shared rate limiter', 'Centralized limits'], 'Coordinate policies and persistent state across independently deployed services.'],
];

export function ApiGuidePage() {
  return (
    <div className="page-wrap guide-page">
      <PageHeader eyebrow="Developer integration" title="Protect an API in minutes." description="Call one endpoint before processing expensive work, then continue or return HTTP 429." actions={<StatusBadge tone="success">POST · JSON</StatusBadge>} />
      <GlassSurface className="integration-flow"><div><Server /><small>YOUR BACKEND</small><strong>Incoming request</strong></div><ArrowDown /><div className="primary"><Clipboard /><small>RATE LIMITER API</small><strong>Check client policy</strong></div><div className="integration-branches"><span><Check /> ALLOW → continue</span><span>× DENY → return 429</span></div></GlassSurface>
      <section className="guide-section"><div className="section-intro"><p className="eyebrow">Express integration</p><h2>Check before the controller runs.</h2><p>The example uses the real local endpoint and propagates retry guidance to the caller.</p></div><div className="guide-code-grid"><CodeBlock title="Express middleware" language="JavaScript" code={expressExample} /><CodeBlock title="Direct API check" language="Shell" code={curlExample} /></div></section>
      <section className="guide-section"><div className="section-intro"><p className="eyebrow">Response contract</p><h2>Everything a caller needs to react.</h2></div><div className="response-contract-grid"><GlassSurface><small>HTTP 200</small><h3>Request allowed</h3><p>Continue the original request. Read remaining capacity from the body or headers.</p><code>X-RateLimit-Remaining: 42</code></GlassSurface><GlassSurface className="danger"><small>HTTP 429</small><h3>Rate limit exceeded</h3><p>Stop processing, return a safe response, and use Retry-After when it is present.</p><code>Retry-After: 2</code></GlassSurface></div></section>
      <section className="guide-section"><div className="section-intro"><p className="eyebrow">Integration patterns</p><h2>Place the decision where it protects the most work.</h2></div><div className="pattern-grid">{patterns.map(([Icon, title, steps, description]) => <GlassSurface key={title}><span className="pattern-icon"><Icon /></span><h3>{title}</h3><div className="mini-flow">{steps.map((step, index) => <span key={step}>{step}{index < steps.length - 1 && <ArrowDown size={12} />}</span>)}</div><p>{description}</p></GlassSurface>)}</div></section>
      <GlassSurface className="benefits-strip"><div><strong>Why use a shared service?</strong><p>Reuse one implementation, centralize rules, maintain consistent limits, monitor decisions in one place, and avoid rebuilding concurrency protection in every application.</p></div></GlassSurface>
    </div>
  );
}
