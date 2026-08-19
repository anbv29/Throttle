import { useState } from 'react';
import { ArrowDown, Braces, Database, Globe2, LockKeyhole, Server, ShieldCheck } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';

const nodes = {
  frontend: { title: 'React + Vite frontend', responsibility: 'Administration, real-time visualization, education, and request testing.', data: 'Client configurations, metrics, health, and decision responses.', why: 'Gives operators one usable control plane without owning authoritative limiter state.' },
  api: { title: 'Express + Node API', responsibility: 'HTTP validation, routing, decision orchestration, safe errors, and rate-limit headers.', data: 'Validated client keys and configuration commands.', why: 'Keeps transport concerns separate from algorithm and database logic.' },
  services: { title: 'Rate limiter services', responsibility: 'Select Token Bucket or Sliding Window and calculate the next state.', data: 'Tokens, timestamps, events, limits, and decisions.', why: 'Focused services make algorithm behavior explicit and testable.' },
  database: { title: 'PostgreSQL', responsibility: 'Persistent configuration, algorithm state, activity history, and concurrency coordination.', data: 'Client rows, bucket balances, window events, and request activity.', why: 'Provides one authoritative state shared by every backend instance.' },
};

export function ArchitecturePage() {
  const [selected, setSelected] = useState('database');
  const detail = nodes[selected];
  return (
    <div className="page-wrap architecture-page">
      <PageHeader eyebrow="Technical architecture" title="A stateless API over durable shared state." description="Explore each layer to see its responsibility, data, and reason for existing." actions={<StatusBadge tone="violet"><LockKeyhole size={13} /> Transaction safe</StatusBadge>} />
      <div className="architecture-layout">
        <div className="architecture-diagram">
          <button className={`architecture-layer frontend ${selected === 'frontend' ? 'active' : ''}`} onClick={() => setSelected('frontend')}><span><Globe2 /></span><div><small>PRESENTATION</small><strong>React Frontend</strong><p>Dashboard · Admin · Tester · Guides</p></div></button>
          <div className="layer-connection"><span>HTTP + JSON</span><ArrowDown /></div>
          <button className={`architecture-layer api ${selected === 'api' ? 'active' : ''}`} onClick={() => setSelected('api')}><span><Server /></span><div><small>APPLICATION</small><strong>Express + Node</strong><p>Routes · Controllers · Validation</p></div></button>
          <div className="internal-service-row"><button className={selected === 'services' ? 'active' : ''} onClick={() => setSelected('services')}><Braces /><span><strong>Rate limiter services</strong><small>Token Bucket · Sliding Window</small></span></button><button className={selected === 'services' ? 'active' : ''} onClick={() => setSelected('services')}><ShieldCheck /><span><strong>Transaction coordinator</strong><small>Read · Decide · Persist</small></span></button></div>
          <div className="layer-connection"><span>SQL transactions</span><ArrowDown /></div>
          <button className={`architecture-layer database ${selected === 'database' ? 'active' : ''}`} onClick={() => setSelected('database')}><span><Database /></span><div><small>AUTHORITATIVE STATE</small><strong>PostgreSQL</strong><p>Configuration · State · Locks · Activity</p></div></button>
        </div>
        <GlassSurface className="architecture-detail"><p className="eyebrow">Selected component</p><h2>{detail.title}</h2><dl><div><dt>Responsibility</dt><dd>{detail.responsibility}</dd></div><div><dt>Data handled</dt><dd>{detail.data}</dd></div><div><dt>Why it exists</dt><dd>{detail.why}</dd></div></dl><div className="architecture-rule"><LockKeyhole size={17} /><p><strong>Critical invariant</strong> A decision and its state update commit together, or neither does.</p></div></GlassSurface>
      </div>
      <div className="architecture-principles"><GlassSurface><span>01</span><h3>Layered responsibilities</h3><p>Routes map endpoints, controllers shape HTTP, services own algorithms, and database modules own transactions.</p></GlassSurface><GlassSurface><span>02</span><h3>Horizontal coordination</h3><p>Multiple Express instances can share the same PostgreSQL locks and persistent state.</p></GlassSurface><GlassSurface><span>03</span><h3>Honest scalability</h3><p>Different clients run concurrently; one extremely hot client serializes to preserve correctness.</p></GlassSurface></div>
    </div>
  );
}
