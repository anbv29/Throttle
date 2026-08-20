import { Activity, CheckCircle2, Clock3, Database, Gauge, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { EmptyState, GlassSurface, PageHeader, Skeleton, StatusBadge } from '../components/Glass.jsx';
import { TrafficChart } from '../components/TrafficChart.jsx';

function KpiCard({ icon: Icon, label, value, context, tone = 'blue', loading }) {
  return (
    <GlassSurface className={`kpi-card tone-${tone}`}>
      <div className="kpi-top"><span className="kpi-icon"><Icon size={17} /></span><span className="data-label">Live data</span></div>
      {loading ? <Skeleton className="metric-skeleton" /> : <strong>{value}</strong>}
      <span className="kpi-label">{label}</span><small>{context}</small>
    </GlassSurface>
  );
}

function formatActivityTime(timestamp) {
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    -Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000)), 'minute',
  );
}

export function DashboardPage({ overview, analytics, range, setRange, loading, refresh, apiOnline, health }) {
  const totalRequests = overview.totalAllowed + overview.totalDenied;
  const allowRate = totalRequests ? Math.round((overview.totalAllowed / totalRequests) * 100) : 0;
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Operations" title="Rate limiter overview" description="Current traffic, stored decisions, and service health." actions={<button className="button secondary" onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>} />
      <div className="kpi-grid six">
        <KpiCard icon={Users} label="Total clients" value={overview.totalClients.toLocaleString()} context="Configured policies" loading={loading} />
        <KpiCard icon={Gauge} label="Active clients" value={(overview.activeClients ?? 0).toLocaleString()} context="Traffic in last 5 minutes" tone="violet" loading={loading} />
        <KpiCard icon={Activity} label="Requests processed" value={totalRequests.toLocaleString()} context="Durable activity history" tone="cyan" loading={loading} />
        <KpiCard icon={CheckCircle2} label="Allowed" value={overview.totalAllowed.toLocaleString()} context={`${allowRate}% allow rate`} tone="green" loading={loading} />
        <KpiCard icon={XCircle} label="Denied" value={overview.totalDenied.toLocaleString()} context="Protected responses" tone="red" loading={loading} />
        <KpiCard icon={Clock3} label="Average decision" value={`${Number(overview.averageResponseTimeMs ?? 0).toFixed(1)} ms`} context="Measured processing time" tone="amber" loading={loading} />
      </div>

      <div className="dashboard-main-grid">
        <TrafficChart analytics={analytics} range={range} onRangeChange={setRange} loading={loading} />
        <GlassSurface className="status-panel">
          <div className="panel-heading"><div><h2>System status</h2><p>Actual service readiness.</p></div><StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Operational' : 'Offline'}</StatusBadge></div>
          <div className="status-list">
            <div><span className="system-icon green"><Database size={17} /></span><span><strong>PostgreSQL</strong><small>Persistent shared state</small></span><StatusBadge tone={health?.database === 'ready' ? 'success' : 'danger'}>{health?.database === 'ready' ? 'Connected' : 'Unavailable'}</StatusBadge></div>
            <div><span className="system-icon blue"><ShieldCheck size={17} /></span><span><strong>Rate limiter</strong><small>Decision engine</small></span><StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Online' : 'Offline'}</StatusBadge></div>
            <div><span className="system-icon violet"><Activity size={17} /></span><span><strong>API readiness</strong><small>{health?.databaseLatencyMilliseconds != null ? `${health.databaseLatencyMilliseconds} ms database query` : 'Awaiting health data'}</small></span><StatusBadge tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Healthy' : 'Failed'}</StatusBadge></div>
          </div>
          <div className="correctness-note"><ShieldCheck size={17} /><div><strong>Concurrency protection active</strong><p>Same-client decisions serialize through PostgreSQL row locks.</p></div></div>
        </GlassSurface>
      </div>

      <GlassSurface className="recent-panel">
        <div className="panel-heading"><div><h2>Recent decisions</h2><p>Latest committed rate-limit activity.</p></div><span className="live-chip"><i /> Auto-refreshing</span></div>
        {!loading && overview.recentActivity.length === 0 ? <EmptyState icon="◎" title="No traffic yet" description="Send a request from the live tester to populate real activity." /> : (
          <div className="activity-table" role="table" aria-label="Recent rate limit decisions">
            <div className="activity-table-head" role="row"><span>Client</span><span>Algorithm</span><span>Decision</span><span>Remaining</span><span>Processing</span><span>When</span></div>
            {loading ? Array.from({ length: 4 }, (_, index) => <Skeleton className="table-skeleton" key={index} />) : overview.recentActivity.map((item, index) => (
              <div className="activity-table-row" role="row" key={`${item.requestedAt}-${index}`}>
                <strong>{item.clientKey}</strong><span className="capitalize">{item.algorithm.replace('_', ' ')}</span><StatusBadge tone={item.allowed ? 'success' : 'danger'}>{item.allowed ? 'Allowed' : 'Denied'}</StatusBadge><span>{item.remaining}</span><span>{item.responseTimeMs == null ? '—' : `${item.responseTimeMs.toFixed(1)} ms`}</span><time>{formatActivityTime(item.requestedAt)}</time>
              </div>
            ))}
          </div>
        )}
      </GlassSurface>
    </div>
  );
}
