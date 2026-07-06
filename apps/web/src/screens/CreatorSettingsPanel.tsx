import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

/** Creator-set subscription price (§3.2). Blank/0 disables subscriptions. */
export function CreatorSettingsPanel() {
  const { user } = useAuth();
  const [dollars, setDollars] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void api
      .GET('/subscriptions/{creatorId}/status', { params: { path: { creatorId: user.id } } })
      .then(({ data }) => {
        if (data?.priceCents) setDollars((data.priceCents / 100).toFixed(2));
      });
  }, [user]);

  async function save() {
    setBusy(true);
    setMessage(null);
    const priceCents = dollars ? Math.round(Number(dollars) * 100) : null;
    const { response } = await api.PUT('/subscriptions/price', { body: { priceCents } });
    setMessage(response.ok ? 'Saved.' : 'Price must be at least $1.00');
    setBusy(false);
  }

  return (
    <section className="panel">
      <h3>Subscriptions</h3>
      <p className="muted small">
        Set your monthly price — you keep the platform’s share as coins each cycle. Leave blank to
        turn subscriptions off.
      </p>
      <div className="row">
        <span className="prefix">$</span>
        <input
          type="number"
          min="1"
          step="0.01"
          placeholder="4.99"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
        />
        <span className="muted">/ month</span>
        <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? '…' : 'Save price'}
        </button>
        {message && <span className="muted">{message}</span>}
      </div>
    </section>
  );
}
