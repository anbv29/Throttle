import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { GlassSurface, Skeleton } from './Glass.jsx';

function ChartBars({ points }) {
  const maximum = Math.max(1, ...points.map((point) => point.incoming));
  const reduceMotion = useReducedMotion();
  return (
    <div className="traffic-bars" role="img" aria-label="Traffic history showing incoming, allowed, and denied requests">
      <div className="chart-grid-lines" aria-hidden="true"><i /><i /><i /><i /></div>
      {points.map((point, index) => {
        const incomingHeight = Math.max(2, (point.incoming / maximum) * 100);
        const allowedHeight = Math.max(0, (point.allowed / maximum) * 100);
        const deniedHeight = Math.max(0, (point.denied / maximum) * 100);
        return (
          <div className="traffic-column" key={`${point.timestamp}-${index}`}>
            <motion.div
              className="bar-stack"
              initial={reduceMotion ? false : { height: 0 }}
              animate={{ height: `${incomingHeight}%` }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : Math.min(index * 0.012, 0.25), ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="bar allowed" style={{ height: `${point.incoming ? (allowedHeight / incomingHeight) * 100 : 0}%` }} />
              <span className="bar denied" style={{ height: `${point.incoming ? (deniedHeight / incomingHeight) * 100 : 0}%` }} />
            </motion.div>
            <div className="chart-tooltip">
              <strong>{new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              <span>{point.incoming} incoming</span>
              <span>{point.allowed} allowed</span>
              <span>{point.denied} denied</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrafficChart({ analytics, range, onRangeChange, loading }) {
  const totals = useMemo(() => (analytics?.points ?? []).reduce((accumulator, point) => ({
    incoming: accumulator.incoming + point.incoming,
    allowed: accumulator.allowed + point.allowed,
    denied: accumulator.denied + point.denied,
  }), { incoming: 0, allowed: 0, denied: 0 }), [analytics]);

  return (
    <GlassSurface className="traffic-panel">
      <div className="panel-heading">
        <div>
          <div className="heading-with-live"><h2>Request traffic</h2><span className="live-chip"><i /> Database history</span></div>
          <p>Allowed and denied decisions persisted by PostgreSQL.</p>
        </div>
        <div className="range-control" role="group" aria-label="Traffic time range">
          {['1m', '5m', '15m', '1h', '24h'].map((option) => (
            <button key={option} className={range === option ? 'active' : ''} onClick={() => onRangeChange(option)}>{option}</button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <span><i className="incoming" />Incoming <strong>{totals.incoming.toLocaleString()}</strong></span>
        <span><i className="allowed" />Allowed <strong>{totals.allowed.toLocaleString()}</strong></span>
        <span><i className="denied" />Denied <strong>{totals.denied.toLocaleString()}</strong></span>
      </div>
      {loading ? <Skeleton className="chart-skeleton" /> : <ChartBars points={analytics?.points ?? []} />}
    </GlassSurface>
  );
}
