import { useEffect, useState } from 'react';

function formatReset(timestamp) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  }).format(new Date(timestamp));
}

export function Tester({ clients, onCheck }) {
  const [clientKey, setClientKey] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!clientKey && clients.length > 0) setClientKey(clients[0].clientKey);
  }, [clients, clientKey]);

  async function sendOne() {
    if (!clientKey.trim()) return;
    setSending(true);
    try {
      const decision = await onCheck(clientKey.trim());
      setResult(decision);
      setHistory((current) => [decision, ...current].slice(0, 12));
    } finally {
      setSending(false);
    }
  }

  async function sendBurst() {
    if (!clientKey.trim()) return;
    setSending(true);
    try {
      const decisions = await Promise.all(
        Array.from({ length: 10 }, () => onCheck(clientKey.trim())),
      );
      setResult(decisions.at(-1));
      setHistory((current) => [...decisions.reverse(), ...current].slice(0, 12));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="page-panel" aria-labelledby="tester-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Interactive console</p>
          <h2 id="tester-title">Live rate-limit tester</h2>
          <p>Send real requests through the same endpoint your services use.</p>
        </div>
      </div>

      <div className="tester-layout">
        <div className="tester-console">
          <label>
            Client key
            <input
              list="client-keys"
              value={clientKey}
              onChange={(event) => setClientKey(event.target.value)}
              placeholder="Select or enter a client key"
            />
            <datalist id="client-keys">
              {clients.map((client) => <option value={client.clientKey} key={client.id} />)}
            </datalist>
          </label>

          <div className="tester-buttons">
            <button className="button primary" onClick={sendOne} disabled={sending || !clientKey.trim()}>
              {sending ? 'Sending…' : 'Send request'}
            </button>
            <button className="button secondary" onClick={sendBurst} disabled={sending || !clientKey.trim()}>
              Send burst × 10
            </button>
          </div>

          <div className={`decision-panel ${result ? (result.allowed ? 'allowed' : 'denied') : ''}`}>
            {result ? (
              <>
                <div className="decision-heading">
                  <span className="decision-symbol">{result.allowed ? '✓' : '×'}</span>
                  <div><small>Decision</small><strong>{result.allowed ? 'ALLOWED' : 'DENIED'}</strong></div>
                </div>
                <div className="decision-grid">
                  <span><small>Algorithm</small><strong>{result.algorithm?.replace('_', ' ')}</strong></span>
                  <span><small>Limit</small><strong>{result.limit}</strong></span>
                  <span><small>Remaining</small><strong>{result.remaining}</strong></span>
                  <span><small>Reset at</small><strong>{formatReset(result.resetAt)}</strong></span>
                </div>
              </>
            ) : (
              <div className="decision-placeholder">
                <span>→</span><p>Your next decision will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="test-history">
          <h3>Session history</h3>
          <p>Most recent browser requests</p>
          {history.length === 0 ? (
            <div className="history-empty">No checks in this session.</div>
          ) : (
            <ol>
              {history.map((item, index) => (
                <li key={`${item.checkedAt}-${index}`}>
                  <span className={`status-pill ${item.allowed ? 'allowed' : 'denied'}`}>
                    {item.allowed ? 'Allowed' : 'Denied'}
                  </span>
                  <span>{item.remaining} remaining</span>
                  <time>{new Date(item.checkedAt).toLocaleTimeString()}</time>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
