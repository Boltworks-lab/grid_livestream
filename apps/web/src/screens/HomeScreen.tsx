import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

export function HomeScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const displayName = String(form.get('displayName') ?? '').trim();
    const bio = String(form.get('bio') ?? '').trim();
    const { data } = await api.PATCH('/users/me', {
      body: {
        ...(displayName ? { displayName } : {}),
        ...(bio ? { bio } : {}),
      },
    });
    if (data) {
      await refreshUser();
      setSaved(true);
    }
    setBusy(false);
  }

  return (
    <main className="home-wrap">
      <header className="topbar">
        <div className="brand small">
          <span className="brand-mark">▶</span>
          <b>Grid</b>
        </div>
        <div className="me">
          <span className="handle">@{user.handle}</span>
          <button type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Welcome, {user.displayName ?? `@${user.handle}`}</h2>
        <p className="muted">
          Phase 2 shell — Discover, live rooms, wallet and gifting arrive in Phases 3–5.
        </p>
      </section>

      <section className="panel">
        <h3>Profile</h3>
        <form onSubmit={saveProfile}>
          <label>
            Display name
            <input name="displayName" defaultValue={user.displayName ?? ''} maxLength={50} />
          </label>
          <label>
            Bio
            <textarea name="bio" defaultValue={user.bio ?? ''} maxLength={300} rows={3} />
          </label>
          <div className="row">
            <button className="primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Save profile'}
            </button>
            {saved && <span className="saved">Saved ✓</span>}
          </div>
        </form>
      </section>
    </main>
  );
}
