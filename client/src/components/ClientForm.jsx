import { useEffect, useState } from 'react';

const blankForm = {
  clientKey: '',
  algorithm: 'token_bucket',
  requestsPerSecond: 5,
  burstSize: 10,
  maxRequests: 100,
  windowSeconds: 60,
};

export function ClientForm({ editingClient, onSave, onCancel, saving }) {
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    setForm(editingClient ? {
      ...blankForm,
      ...editingClient,
      requestsPerSecond: editingClient.requestsPerSecond ?? 5,
      burstSize: editingClient.burstSize ?? 10,
      maxRequests: editingClient.maxRequests ?? 100,
      windowSeconds: editingClient.windowSeconds ?? 60,
    } : blankForm);
  }, [editingClient]);

  function updateField(event) {
    const { name, value, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'number' ? Number(value) : value,
    }));
  }

  function submit(event) {
    event.preventDefault();
    const configuration = form.algorithm === 'token_bucket'
      ? {
          clientKey: form.clientKey.trim(),
          algorithm: form.algorithm,
          requestsPerSecond: form.requestsPerSecond,
          burstSize: form.burstSize,
        }
      : {
          clientKey: form.clientKey.trim(),
          algorithm: form.algorithm,
          maxRequests: form.maxRequests,
          windowSeconds: form.windowSeconds,
        };
    onSave(configuration);
  }

  return (
    <form className="client-form" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h3>{editingClient ? 'Edit client' : 'Add a client'}</h3>
        </div>
        {editingClient && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}
      </div>

      <label>
        Client key
        <input
          name="clientKey"
          value={form.clientKey}
          onChange={updateField}
          placeholder="payments_api"
          required
          pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"
        />
        <small>Unique key sent by the calling application.</small>
      </label>

      <fieldset>
        <legend>Rate-limiting algorithm</legend>
        <div className="algorithm-picker">
          <label className={form.algorithm === 'token_bucket' ? 'selected' : ''}>
            <input
              type="radio"
              name="algorithm"
              value="token_bucket"
              checked={form.algorithm === 'token_bucket'}
              onChange={updateField}
            />
            <span><b>Token bucket</b><small>Bursts with a steady refill</small></span>
          </label>
          <label className={form.algorithm === 'sliding_window' ? 'selected' : ''}>
            <input
              type="radio"
              name="algorithm"
              value="sliding_window"
              checked={form.algorithm === 'sliding_window'}
              onChange={updateField}
            />
            <span><b>Sliding window</b><small>Exact count over rolling time</small></span>
          </label>
        </div>
      </fieldset>

      <div className="form-grid">
        {form.algorithm === 'token_bucket' ? (
          <>
            <label>
              Requests / second
              <input type="number" name="requestsPerSecond" min="0.000001" step="any" value={form.requestsPerSecond} onChange={updateField} required />
            </label>
            <label>
              Burst size
              <input type="number" name="burstSize" min="1" step="1" value={form.burstSize} onChange={updateField} required />
            </label>
          </>
        ) : (
          <>
            <label>
              Maximum requests
              <input type="number" name="maxRequests" min="1" step="1" value={form.maxRequests} onChange={updateField} required />
            </label>
            <label>
              Window seconds
              <input type="number" name="windowSeconds" min="1" step="1" value={form.windowSeconds} onChange={updateField} required />
            </label>
          </>
        )}
      </div>

      <button className="button primary full" type="submit" disabled={saving}>
        {saving ? 'Saving…' : editingClient ? 'Save changes' : 'Create client'}
      </button>
    </form>
  );
}
