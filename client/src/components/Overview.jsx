function MetricCard({ label, value, tone }) {
  return (
    <article className={`metric-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(timestamp));
}

export function Overview({ overview, loading, onRefresh }) {
  const total = overview.totalAllowed + overview.totalDenied;
  const successRate = total === 0 ? 0 : Math.round((overview.totalAllowed / total) * 100);

  return (
    <section className="page-panel" aria-labelledby="overview-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">System pulse</p>
          <h2 id="overview-title">Traffic overview</h2>
        </div>
        <button className="button secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Configured clients" value={overview.totalClients} />
        <MetricCard label="Requests allowed" value={overview.totalAllowed} tone="positive" />
        <MetricCard label="Requests denied" value={overview.totalDenied} tone="negative" />
        <MetricCard label="Allow rate" value={successRate} tone="accent" />
      </div>

      <div className="activity-card">
        <div className="activity-title">
          <div>
            <h3>Recent decisions</h3>
            <p>The latest checks committed by the service.</p>
          </div>
          <span className="live-indicator"><i /> Live</span>
        </div>

        {overview.recentActivity.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark">◎</span>
            <h3>No requests yet</h3>
            <p>Use the live tester to generate your first rate-limit decision.</p>
          </div>
        ) : (
          <div className="activity-list">
            {overview.recentActivity.map((item, index) => (
              <div className="activity-row" key={`${item.requestedAt}-${index}`}>
                <span className={`decision-dot ${item.allowed ? 'allowed' : 'denied'}`} />
                <div className="activity-client">
                  <strong>{item.clientKey}</strong>
                  <span>{item.algorithm.replace('_', ' ')}</span>
                </div>
                <span className={`status-pill ${item.allowed ? 'allowed' : 'denied'}`}>
                  {item.allowed ? 'Allowed' : 'Denied'}
                </span>
                <span className="remaining">{item.remaining} left</span>
                <time>{formatTime(item.requestedAt)}</time>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
