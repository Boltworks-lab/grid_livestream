import { useEffect, useState } from 'react';

import { adminApi, staffToken } from './lib/api';

type LoginStep =
  | { step: 'credentials' }
  | { step: 'enroll'; enrollToken: string; otpauthUrl: string }
  | { step: 'totp'; challengeToken: string };

function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [state, setState] = useState<LoginStep>({ step: 'credentials' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const { data, message } = await adminApi<
      | { step: 'enroll'; enrollToken: string; otpauthUrl: string }
      | { step: 'totp'; challengeToken: string }
    >('POST', '/admin/auth/login', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });
    setBusy(false);
    if (!data) return setError(message ?? 'login failed');
    setState(data);
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const code = String(new FormData(e.currentTarget).get('code') ?? '');
    const endpoint =
      state.step === 'enroll' ? '/admin/auth/totp/enroll' : '/admin/auth/totp/verify';
    const token =
      state.step === 'enroll'
        ? state.enrollToken
        : (state as { challengeToken: string }).challengeToken;
    const { data, message } = await adminApi<{ staffToken: string }>('POST', endpoint, {
      token,
      code,
    });
    setBusy(false);
    if (!data) return setError(message ?? 'invalid code');
    staffToken.set(data.staffToken);
    onAuthed();
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Grid Admin</h1>
        {state.step === 'credentials' && (
          <form onSubmit={(e) => void submitCredentials(e)}>
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={busy}>{busy ? '…' : 'Continue'}</button>
          </form>
        )}
        {state.step === 'enroll' && (
          <form onSubmit={(e) => void submitCode(e)}>
            <p>
              First login: add this to your authenticator app (TOTP is mandatory for staff), then
              enter the 6-digit code.
            </p>
            <code className="otpauth">{state.otpauthUrl}</code>
            <label>
              Code
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" required autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={busy}>{busy ? '…' : 'Enable 2FA & sign in'}</button>
          </form>
        )}
        {state.step === 'totp' && (
          <form onSubmit={(e) => void submitCode(e)}>
            <label>
              Authenticator code
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" required autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={busy}>{busy ? '…' : 'Sign in'}</button>
          </form>
        )}
      </div>
    </main>
  );
}

const TABS = ['Payouts', 'Reports', 'Users', 'Economics', 'Audit'] as const;
type Tab = (typeof TABS)[number];

interface PayoutRow {
  id: string;
  creatorHandle: string;
  coinAmount: number;
  fiatAmountCents: number;
  status: string;
  createdAt: string;
}
interface ReportRow {
  id: string;
  reporterHandle: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}
interface AuditRow {
  id: string;
  staffEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('Payouts');
  return (
    <main>
      <header className="bar">
        <b>Grid Admin</b>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={onLogout}>
          Sign out
        </button>
      </header>
      <section className="content">
        {tab === 'Payouts' && <PayoutsTab />}
        {tab === 'Reports' && <ReportsTab />}
        {tab === 'Users' && <UsersTab />}
        {tab === 'Economics' && <EconomicsTab />}
        {tab === 'Audit' && <AuditTab />}
      </section>
    </main>
  );
}

function PayoutsTab() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const load = () =>
    void adminApi<PayoutRow[]>('GET', '/admin/payouts').then(({ data }) => data && setRows(data));
  useEffect(load, []);
  async function act(id: string, verb: 'approve' | 'reject') {
    await adminApi(
      'POST',
      `/admin/payouts/${id}/${verb}`,
      verb === 'reject' ? { reason: 'rejected by staff' } : undefined,
    );
    load();
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Creator</th>
          <th>Coins</th>
          <th>Fiat</th>
          <th>Requested</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="muted">
              Queue is empty
            </td>
          </tr>
        )}
        {rows.map((p) => (
          <tr key={p.id}>
            <td>@{p.creatorHandle}</td>
            <td>{p.coinAmount.toLocaleString()}</td>
            <td>${(p.fiatAmountCents / 100).toFixed(2)}</td>
            <td>{new Date(p.createdAt).toLocaleString()}</td>
            <td>
              <button onClick={() => void act(p.id, 'approve')}>Approve</button>{' '}
              <button className="danger" onClick={() => void act(p.id, 'reject')}>
                Reject
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportsTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const load = () =>
    void adminApi<ReportRow[]>('GET', '/admin/reports').then(({ data }) => data && setRows(data));
  useEffect(load, []);
  async function act(id: string, action: string) {
    if (action === 'DISMISS') await adminApi('POST', `/admin/reports/${id}/dismiss`);
    else
      await adminApi('POST', `/admin/reports/${id}/action`, {
        action,
        reason: 'moderated via admin',
      });
    load();
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Reporter</th>
          <th>Target</th>
          <th>Reason</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="muted">
              Queue is empty
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id}>
            <td>@{r.reporterHandle}</td>
            <td>
              {r.targetType}: {r.targetId.slice(0, 12)}…
            </td>
            <td>{r.reason}</td>
            <td>
              {r.targetType === 'CHAT_MESSAGE' && (
                <button onClick={() => void act(r.id, 'REMOVE_CONTENT')}>Remove</button>
              )}
              {r.targetType === 'USER' && (
                <>
                  <button onClick={() => void act(r.id, 'SUSPEND')}>Suspend</button>{' '}
                  <button className="danger" onClick={() => void act(r.id, 'BAN')}>
                    Ban
                  </button>
                </>
              )}{' '}
              <button onClick={() => void act(r.id, 'WARN')}>Warn</button>{' '}
              <button className="ghost" onClick={() => void act(r.id, 'DISMISS')}>
                Dismiss
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersTab() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const { data, message: err } = await adminApi<Record<string, unknown>>(
      'GET',
      `/admin/users/lookup?q=${encodeURIComponent(query)}`,
    );
    if (data) setResult(data);
    else {
      setResult(null);
      setMessage(err ?? 'not found');
    }
  }
  return (
    <div>
      <form onSubmit={(e) => void search(e)} className="row">
        <input
          placeholder="handle or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button>Lookup</button>
      </form>
      {message && <p className="muted">{message}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      <p className="muted">
        Money data is read-only (brief §6.3) — adjustments go through the ledger.
      </p>
    </div>
  );
}

function EconomicsTab() {
  const [json, setJson] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void adminApi<object>('GET', '/admin/economics').then(
      ({ data }) => data && setJson(JSON.stringify(data, null, 2)),
    );
  }, []);
  async function save() {
    setMessage(null);
    try {
      const { data, message: err } = await adminApi<object>(
        'PUT',
        '/admin/economics',
        JSON.parse(json),
      );
      setMessage(data ? 'Saved — live within 30s (ADR 0005). Audited.' : (err ?? 'save failed'));
    } catch {
      setMessage('invalid JSON');
    }
  }
  return (
    <div>
      <p className="muted">
        Fee rates, coin peg, payout minimum & hold — changes apply to NEW transactions only.
      </p>
      <textarea rows={12} value={json} onChange={(e) => setJson(e.target.value)} />
      <div className="row">
        <button onClick={() => void save()}>Save economics</button>
        {message && <span className="muted">{message}</span>}
      </div>
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => {
    void adminApi<AuditRow[]>('GET', '/admin/audit').then(({ data }) => data && setRows(data));
  }, []);
  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Staff</th>
          <th>Action</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td>{new Date(a.createdAt).toLocaleString()}</td>
            <td>{a.staffEmail}</td>
            <td>{a.action}</td>
            <td>
              {a.targetType}: {a.targetId?.slice(0, 12)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function App() {
  const [authed, setAuthed] = useState(() => staffToken.get() !== null);
  if (!authed) return <LoginScreen onAuthed={() => setAuthed(true)} />;
  return (
    <Dashboard
      onLogout={() => {
        staffToken.set(null);
        setAuthed(false);
      }}
    />
  );
}
