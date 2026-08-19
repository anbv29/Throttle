import { useEffect, useState } from 'react';
import {
  Activity, ArrowRight, Boxes, Braces, Check, CircleGauge, CloudCog, Cpu,
  CreditCard, FlaskConical, KeyRound, Network, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';
import { Brand } from '../components/AppShell.jsx';
import { GlassSurface, StatusBadge } from '../components/Glass.jsx';
import { ThemeControl } from '../components/ThemeControl.jsx';

const benefits = [
  [ShieldCheck, 'Protect your APIs', 'Reject abusive traffic before it reaches expensive application logic.'],
  [Zap, 'Control traffic spikes', 'Absorb short bursts without letting sudden load overwhelm downstream systems.'],
  [Network, 'Centralize decisions', 'Share one persistent rate-limiting service across every backend and API.'],
  [KeyRound, 'Configure per client', 'Give services, users, and API keys limits that match their real workload.'],
  [CloudCog, 'Improve reliability', 'Coordinate concurrency through PostgreSQL instead of process-local memory.'],
];

const useCases = [
  [Braces, 'Public APIs', 'Protect published endpoints from abuse and accidental request storms.'],
  [Boxes, 'SaaS platforms', 'Assign fair, plan-aware limits to every tenant and integration.'],
  [Cpu, 'AI APIs', 'Guard costly inference workloads with precise shared quotas.'],
  [KeyRound, 'Authentication', 'Slow credential attacks while preserving healthy sign-in traffic.'],
  [CreditCard, 'Payment APIs', 'Control retries and bursts around latency-sensitive financial operations.'],
  [Network, 'Microservices', 'Use consistent policies across independently deployed services.'],
];

function RequestFlow() {
  return (
    <GlassSurface className="hero-flow" aria-label="Request flow through the rate limiter">
      <div className="flow-toolbar"><span><i /> Live architecture</span><small>POST /api/v1/rate-limit/check</small></div>
      <div className="flow-canvas">
        <div className="flow-node source"><small>CALLERS</small><strong>Applications</strong><span>API keys · Services</span></div>
        <div className="flow-connector first"><i /><i /><i /></div>
        <div className="flow-node limiter">
          <span className="node-icon"><Activity size={18} /></span>
          <small>DECISION ENGINE</small><strong>Rate Limiter API</strong>
          <div><span>Token Bucket</span><span>Sliding Window</span></div>
        </div>
        <div className="flow-split"><span className="allow-line"><i /></span><span className="deny-line"><i /></span></div>
        <div className="flow-results">
          <div className="flow-node allow"><Check size={18} /><strong>ALLOW</strong><small>HTTP 200</small></div>
          <div className="flow-node deny"><span>×</span><strong>DENY</strong><small>HTTP 429</small></div>
        </div>
      </div>
      <div className="flow-footnote"><ShieldCheck size={14} /><span>Atomic decisions backed by persistent PostgreSQL state</span></div>
    </GlassSurface>
  );
}

function AlgorithmShowcase() {
  const [tokens, setTokens] = useState(8);
  const [events, setEvents] = useState([12, 28, 43, 58, 76]);

  useEffect(() => {
    const timer = window.setInterval(() => setTokens((value) => Math.min(10, value + 1)), 1800);
    return () => window.clearInterval(timer);
  }, []);

  function consumeToken() {
    setTokens((value) => Math.max(0, value - 1));
  }

  function addWindowEvent() {
    setEvents((value) => [...value.slice(-6).map((position) => Math.max(5, position - 12)), 92]);
  }

  return (
    <div className="algorithm-showcase-grid">
      <GlassSurface className="algorithm-showcase token-showcase">
        <div className="algorithm-card-heading"><span className="algorithm-icon"><Zap size={19} /></span><div><small>FLEXIBLE CONTROL</small><h3>Token Bucket</h3></div><StatusBadge tone="violet">Burst ready</StatusBadge></div>
        <p>Allows controlled bursts while maintaining a configured average request rate.</p>
        <div className="bucket-demo">
          <div className="bucket-rim" />
          <div className="token-grid">
            {Array.from({ length: 10 }, (_, index) => <i className={index < tokens ? 'filled' : ''} key={index} />)}
          </div>
          <span className="bucket-fill" style={{ height: `${tokens * 10}%` }} />
        </div>
        <div className="algorithm-stats"><span><small>Capacity</small><strong>10</strong></span><span><small>Refill</small><strong>1/sec</strong></span><span><small>Available</small><strong>{tokens}</strong></span></div>
        <button className="button secondary" onClick={consumeToken} disabled={!tokens}>Consume a token <ArrowRight size={14} /></button>
      </GlassSurface>
      <GlassSurface className="algorithm-showcase window-showcase">
        <div className="algorithm-card-heading"><span className="algorithm-icon"><Activity size={19} /></span><div><small>PRECISE CONTROL</small><h3>Sliding Window</h3></div><StatusBadge tone="violet">Rolling time</StatusBadge></div>
        <p>Strictly controls requests occurring inside a continuously moving time window.</p>
        <div className="window-demo">
          <div className="window-track"><span>60 seconds ago</span><span>Now</span></div>
          <div className="window-events">{events.map((position, index) => <i style={{ left: `${position}%` }} key={`${position}-${index}`} />)}</div>
          <div className="window-scan" />
        </div>
        <div className="algorithm-stats"><span><small>Limit</small><strong>10</strong></span><span><small>Window</small><strong>60s</strong></span><span><small>Current</small><strong>{events.length}</strong></span></div>
        <button className="button secondary" onClick={addWindowEvent}>Add request event <ArrowRight size={14} /></button>
      </GlassSurface>
    </div>
  );
}

export function LandingPage({ navigate, theme, setTheme, apiOnline }) {
  return (
    <div className="landing-page">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <GlassSurface as="nav" className="landing-nav">
        <Brand onClick={() => navigate('/')} />
        <div className="landing-links">
          <button onClick={() => navigate('/how-it-works')}>How it works</button>
          <button onClick={() => navigate('/api-guide')}>Developers</button>
          <button onClick={() => navigate('/architecture')}>Architecture</button>
        </div>
        <div className="landing-nav-actions"><StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'API ready' : 'API offline'}</StatusBadge><ThemeControl theme={theme} onChange={setTheme} compact /></div>
      </GlassSurface>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-kicker"><Sparkles size={14} /> PostgreSQL-backed traffic control</div>
            <h1>Control API traffic.<br /><span>Before traffic controls you.</span></h1>
            <p>A standalone rate-limiting service that protects APIs with configurable algorithms, persistent state, and concurrency-safe decisions.</p>
            <div className="hero-actions">
              <button className="button primary large" onClick={() => navigate('/dashboard')}>Explore dashboard <ArrowRight size={16} /></button>
              <button className="button secondary large" onClick={() => navigate('/tester')}><FlaskConical size={16} /> Try live tester</button>
            </div>
            <div className="hero-proof"><span><Check /> Real PostgreSQL state</span><span><Check /> Atomic concurrency</span><span><Check /> Two algorithms</span></div>
          </div>
          <RequestFlow />
        </section>

        <section className="landing-section">
          <div className="section-intro"><p className="eyebrow">Why Gatehouse</p><h2>Infrastructure protection with context.</h2><p>Everything you need to configure, observe, test, and understand rate-limiting decisions.</p></div>
          <div className="benefit-grid">{benefits.map(([Icon, title, description]) => <GlassSurface className="benefit-card" key={title}><Icon size={19} /><h3>{title}</h3><p>{description}</p></GlassSurface>)}</div>
        </section>

        <section className="landing-section algorithms-section">
          <div className="section-intro"><p className="eyebrow">Algorithms</p><h2>Flexible bursts or exact windows.</h2><p>Choose the control model that matches each caller's workload.</p></div>
          <AlgorithmShowcase />
        </section>

        <section className="landing-section">
          <div className="section-intro"><p className="eyebrow">Built for real systems</p><h2>One control plane. Many workloads.</h2></div>
          <div className="use-case-grid">{useCases.map(([Icon, title, description]) => <GlassSurface className="use-case-card" key={title}><span><Icon size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></GlassSurface>)}</div>
        </section>

        <GlassSurface className="landing-cta"><div><p className="eyebrow">Ready to test the real service?</p><h2>See concurrency-safe decisions happen live.</h2></div><button className="button primary large" onClick={() => navigate('/tester')}>Open request lab <ArrowRight size={16} /></button></GlassSurface>
      </main>
      <footer className="landing-footer"><Brand onClick={() => navigate('/')} /><p>Persistent API traffic control, built with PERN.</p></footer>
    </div>
  );
}
