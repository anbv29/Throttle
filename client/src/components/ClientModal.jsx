import { useEffect, useState } from 'react';
import { Activity, Check, Gauge, X, Zap } from 'lucide-react';
import { GlassSurface } from './Glass.jsx';

const blankForm = {
  clientKey: '', algorithm: 'token_bucket', requestsPerSecond: 10,
  burstSize: 50, maxRequests: 100, windowSeconds: 60,
};

const algorithmOptions = [
  {
    value: 'token_bucket', title: 'Token Bucket', Icon: Zap,
    description: 'Controlled bursts with a steady average request rate.',
    benefits: ['Burst traffic', 'Flexible request patterns', 'Smooth average limits'],
  },
  {
    value: 'sliding_window', title: 'Sliding Window', Icon: Activity,
    description: 'Exact request counts inside a continuously moving window.',
    benefits: ['Strict quotas', 'Precise request limits', 'Predictable time windows'],
  },
];

export function ClientModal({ client, onClose, onSave, saving }) {
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    setForm(client ? {
      ...blankForm, ...client,
      requestsPerSecond: client.requestsPerSecond ?? 10,
      burstSize: client.burstSize ?? 50,
      maxRequests: client.maxRequests ?? 100,
      windowSeconds: client.windowSeconds ?? 60,
    } : blankForm);
  }, [client]);

  function update(event) {
    const { name, value, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave(form.algorithm === 'token_bucket' ? {
      clientKey: form.clientKey.trim(), algorithm: form.algorithm,
      requestsPerSecond: form.requestsPerSecond, burstSize: form.burstSize,
    } : {
      clientKey: form.clientKey.trim(), algorithm: form.algorithm,
      maxRequests: form.maxRequests, windowSeconds: form.windowSeconds,
    });
  }

  const explanation = form.algorithm === 'token_bucket'
    ? `This client can temporarily use up to ${form.burstSize} tokens. The bucket continuously refills at ${form.requestsPerSecond} token${form.requestsPerSecond === 1 ? '' : 's'} per second.`
    : `This client can make ${form.maxRequests} request${form.maxRequests === 1 ? '' : 's'} during any continuously moving ${form.windowSeconds}-second window.`;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <GlassSurface as="form" className="client-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">Client policy</p><h2 id="client-modal-title">{client ? 'Edit rate limit' : 'Create a client'}</h2><p>Choose the control model that matches this caller.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <label className="premium-field"><span>Client key</span><input name="clientKey" value={form.clientKey} onChange={update} placeholder="payment-service" pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" required /><small>Sent by your application with every rate-limit check.</small></label>
        <fieldset className="algorithm-fieldset"><legend>Choose your rate-limiting algorithm</legend><div className="algorithm-choice-grid">
          {algorithmOptions.map(({ value, title, Icon, description, benefits }) => <label className={form.algorithm === value ? 'selected' : ''} key={value}><input type="radio" name="algorithm" value={value} checked={form.algorithm === value} onChange={update} /><span className="choice-icon"><Icon size={20} /></span><strong>{title}</strong><p>{description}</p><small>Best for</small><ul>{benefits.map((benefit) => <li key={benefit}><Check size={12} />{benefit}</li>)}</ul></label>)}
        </div></fieldset>
        <div className="configuration-fields">
          {form.algorithm === 'token_bucket' ? <>
            <label className="premium-field"><span>Requests per second</span><input type="number" name="requestsPerSecond" min="0.000001" step="any" value={form.requestsPerSecond} onChange={update} required /></label>
            <label className="premium-field"><span>Burst capacity</span><input type="number" name="burstSize" min="1" step="1" value={form.burstSize} onChange={update} required /></label>
          </> : <>
            <label className="premium-field"><span>Maximum requests</span><input type="number" name="maxRequests" min="1" step="1" value={form.maxRequests} onChange={update} required /></label>
            <label className="premium-field"><span>Window duration (seconds)</span><input type="number" name="windowSeconds" min="1" step="1" value={form.windowSeconds} onChange={update} required /></label>
          </>}
        </div>
        <div className="configuration-explainer"><Gauge size={17} /><p>{explanation}</p></div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving policy…' : client ? 'Save changes' : 'Create client'}</button></div>
      </GlassSurface>
    </div>
  );
}
