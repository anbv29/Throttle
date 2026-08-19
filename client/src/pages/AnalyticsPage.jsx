import { Activity, CheckCircle2, Clock3, Database, ShieldCheck, XCircle } from 'lucide-react';
import { GlassSurface, PageHeader, StatusBadge } from '../components/Glass.jsx';
import { TrafficChart } from '../components/TrafficChart.jsx';

export function AnalyticsPage({ analytics, overview, range, setRange, loading }) {
  const points = analytics?.points ?? [];
  const windowTotal = points.reduce((sum, point) => sum + point.incoming, 0);
  const averageLatency = points.length ? points.reduce((sum, point) => sum + point.averageResponseTimeMs, 0) / points.length : 0;
  const peak = Math.max(0, ...points.map((point) => point.incoming));
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="PostgreSQL activity history" title="Traffic & analytics" description="Every point is calculated from committed rate-limit decisions—never fake production data." actions={<StatusBadge tone="success"><Database size={13} /> Durable data</StatusBadge>} />
      <div className="analytics-kpis">
        <GlassSurface><Activity /><span><small>Requests in range</small><strong>{windowTotal.toLocaleString()}</strong><p>Selected {range} window</p></span></GlassSurface>
        <GlassSurface><CheckCircle2 /><span><small>Lifetime allowed</small><strong>{overview.totalAllowed.toLocaleString()}</strong><p>Committed decisions</p></span></GlassSurface>
        <GlassSurface><XCircle /><span><small>Lifetime denied</small><strong>{overview.totalDenied.toLocaleString()}</strong><p>Protected requests</p></span></GlassSurface>
        <GlassSurface><Clock3 /><span><small>Range latency</small><strong>{averageLatency.toFixed(1)} ms</strong><p>Average processing</p></span></GlassSurface>
      </div>
      <TrafficChart analytics={analytics} range={range} onRangeChange={setRange} loading={loading} />
      <div className="analytics-insight-grid">
        <GlassSurface><span className="insight-icon"><ShieldCheck /></span><div><p className="eyebrow">Correctness signal</p><h3>Denials prove the limit is working</h3><p>Denied requests are valid decisions, not API failures. They show that the configured policy protected downstream capacity.</p></div></GlassSurface>
        <GlassSurface><span className="insight-icon violet"><Activity /></span><div><p className="eyebrow">Peak bucket activity</p><h3>{peak.toLocaleString()} decisions in one chart interval</h3><p>Chart intervals change with the selected range, keeping history readable without inventing interpolated points.</p></div></GlassSurface>
        <GlassSurface><span className="insight-icon green"><Database /></span><div><p className="eyebrow">Data source</p><h3>PostgreSQL activity records</h3><p>The API groups persisted allowed and denied decisions into time buckets and calculates measured processing time.</p></div></GlassSurface>
      </div>
    </div>
  );
}
