import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

interface ConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  kycStatus: string;
  holdUntil: string | null;
  minPayoutCoins: number;
  coinValueCents: number;
}

interface PayoutItem {
  id: string;
  coinAmount: number;
  fiatAmountCents: number;
  fiatCurrency: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export function PayoutPanel() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [coins, setCoins] = useState(0);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [s, p, w] = await Promise.all([
      api.GET('/payouts/connect/status'),
      api.GET('/payouts'),
      api.GET('/wallet'),
    ]);
    if (s.data) setStatus(s.data as ConnectStatus);
    if (p.data) setPayouts(p.data as PayoutItem[]);
    if (w.data) setCoins(w.data.coins);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onboard() {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await api.POST('/payouts/connect/onboard');
      if (data?.url) window.location.href = data.url;
      else setMessage((error as { message?: string })?.message ?? 'onboarding unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    setBusy(true);
    setMessage(null);
    try {
      const coinAmount = Number(amount);
      const { data, error, response } = await api.POST('/payouts', {
        body: { coinAmount, idempotencyKey: crypto.randomUUID() },
      });
      if (data) {
        setMessage(
          `Payout requested — $${(data.fiatAmountCents / 100).toFixed(2)} pending review.`,
        );
        setAmount('');
        window.dispatchEvent(new CustomEvent('grid:wallet-changed'));
        await reload();
      } else {
        setMessage(
          response.status === 422
            ? 'Not enough coins'
            : ((error as { message?: string })?.message ?? 'request failed'),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const held = status.holdUntil !== null && new Date(status.holdUntil) > new Date();

  return (
    <section className="panel">
      <h3>Payouts</h3>
      <p className="muted small">
        {coins.toLocaleString()} coins ≈ ${((coins * status.coinValueCents) / 100).toFixed(2)} ·
        minimum payout {status.minPayoutCoins.toLocaleString()} coins
      </p>

      {!status.connected ? (
        <>
          <p className="muted">Connect a payout account (Stripe handles identity + banking).</p>
          <button className="primary" type="button" disabled={busy} onClick={() => void onboard()}>
            {busy ? '…' : 'Set up payouts'}
          </button>
        </>
      ) : !status.payoutsEnabled ? (
        <>
          <p className="muted">
            Verification in progress (status: {status.kycStatus}). Finish any remaining steps:
          </p>
          <button className="primary" type="button" disabled={busy} onClick={() => void onboard()}>
            {busy ? '…' : 'Continue onboarding'}
          </button>
        </>
      ) : held ? (
        <p className="muted">
          New-creator payout hold until {new Date(status.holdUntil!).toLocaleDateString()} (brief §7
          financial safety).
        </p>
      ) : (
        <div className="row">
          <input
            type="number"
            min={status.minPayoutCoins}
            placeholder={`coins (min ${status.minPayoutCoins})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="primary"
            type="button"
            disabled={busy || !amount}
            onClick={() => void request()}
          >
            {busy ? '…' : 'Request payout'}
          </button>
        </div>
      )}

      {message && <p className="muted small">{message}</p>}

      {payouts.length > 0 && (
        <ul className="history">
          {payouts.map((p) => (
            <li key={p.id}>
              <span>${(p.fiatAmountCents / 100).toFixed(2)}</span>
              <span
                className={
                  p.status === 'PAID' ? 'amount-in' : p.status === 'FAILED' ? 'amount-out' : ''
                }
              >
                {p.status}
              </span>
              <span className="muted">{new Date(p.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
