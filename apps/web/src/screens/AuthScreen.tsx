import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';

type Mode = 'signin' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const failure =
        mode === 'signin'
          ? await login({
              identifier: String(form.get('identifier') ?? ''),
              password: String(form.get('password') ?? ''),
            })
          : await register({
              email: String(form.get('email') ?? ''),
              handle: String(form.get('handle') ?? ''),
              password: String(form.get('password') ?? ''),
              dob: String(form.get('dob') ?? ''),
            });
      if (failure) setError(failure);
    } catch {
      setError('Could not reach the server — is the API running?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">▶</span>
          <h1>Grid</h1>
        </div>
        <p className="tagline">Go live. Get gifted. Get paid.</p>

        <div className="mode-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} key={mode}>
          {mode === 'signin' ? (
            <label>
              Email or handle
              <input name="identifier" autoComplete="username" required minLength={3} />
            </label>
          ) : (
            <>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Handle
                <input
                  name="handle"
                  pattern="[a-z0-9_]{3,24}"
                  title="3-24 chars: a-z, 0-9, _"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Date of birth <span className="hint">(18+ only)</span>
                <input name="dob" type="date" required />
              </label>
            </>
          )}
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="fineprint">
          By continuing you confirm you are 18 or older and accept the Terms &amp; Community
          Guidelines.
        </p>
      </div>
    </main>
  );
}
