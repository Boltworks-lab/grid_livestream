import { createStreamSchema } from '@grid/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';

export function GoLiveScreen() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<'FREE' | 'PPV' | 'SUBS'>('FREE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const parsed = createStreamSchema.safeParse({
      title: String(form.get('title') ?? ''),
      category: String(form.get('category') ?? '') || undefined,
      visibility: String(form.get('visibility') ?? 'PUBLIC'),
      access,
      ppvPriceDiamonds: form.get('ppvPrice') ? Number(form.get('ppvPrice')) : undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue.message);
      return;
    }
    setBusy(true);
    try {
      const { data, error: createError } = await api.POST('/streams', {
        body: parsed.data as never,
      });
      if (!data) {
        setError((createError as { message?: string })?.message ?? 'could not create stream');
        return;
      }
      const live = await api.POST('/streams/{id}/go-live', {
        params: { path: { id: (data as { id: string }).id } },
      });
      if (live.response.ok) navigate(`/stream/${(data as { id: string }).id}`);
      else setError('created, but going live failed — try again from Discover');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <section className="panel">
        <h2>Go live</h2>
        <p className="muted">Set up your stream — you can end it any time.</p>
        <form onSubmit={onSubmit}>
          <label>
            Title
            <input name="title" required maxLength={120} placeholder="What are you streaming?" />
          </label>
          <label>
            Category
            <select name="category" defaultValue="">
              <option value="">— none —</option>
              {['Gaming', 'Music', 'IRL', 'Fitness', 'Art'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Visibility</legend>
            {(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const).map((v) => (
              <label key={v} className="radio">
                <input type="radio" name="visibility" value={v} defaultChecked={v === 'PUBLIC'} />
                {v === 'PUBLIC' ? 'Public' : v === 'FOLLOWERS' ? 'Followers' : 'Private (invite)'}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Access</legend>
            {(
              [
                ['FREE', 'Free'],
                ['PPV', 'Pay-per-view'],
                ['SUBS', 'Subscribers only'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="radio">
                <input
                  type="radio"
                  name="access"
                  value={value}
                  checked={access === value}
                  onChange={() => setAccess(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {access === 'PPV' && (
            <label>
              Unlock price (💎 diamonds)
              <input name="ppvPrice" type="number" min={1} max={1000000} defaultValue={50} />
            </label>
          )}
          {access === 'SUBS' && (
            <p className="muted small">
              Subscriptions launch in Phase 6 — viewers can’t unlock yet.
            </p>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? '…' : 'Start streaming'}
          </button>
        </form>
      </section>
    </main>
  );
}
