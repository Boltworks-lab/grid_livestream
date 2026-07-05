import { DIAMOND_PACKAGES, type WalletBalances, type WalletTransaction } from '@grid/shared';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

const KIND_LABEL: Record<WalletTransaction['kind'], string> = {
  TOPUP: 'Top-up',
  GIFT: 'Gift',
  PPV_UNLOCK: 'Unlock',
  SUB: 'Subscription',
  PAYOUT: 'Payout',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
};

export function WalletPanel() {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [history, setHistory] = useState<WalletTransaction[]>([]);
  const [busyPackage, setBusyPackage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(() => {
    const status = new URLSearchParams(window.location.search).get('topup');
    if (status === 'success') return 'Payment received — diamonds land as soon as Stripe confirms.';
    if (status === 'cancelled') return 'Top-up cancelled.';
    return null;
  });

  const reload = useCallback(async () => {
    const [b, t] = await Promise.all([api.GET('/wallet'), api.GET('/wallet/transactions')]);
    if (b.data) setBalances(b.data);
    if (t.data?.items) setHistory(t.data.items as WalletTransaction[]);
  }, []);

  useEffect(() => {
    void reload();
    // after a successful checkout the webhook may lag a moment — refetch briefly
    if (banner?.startsWith('Payment received')) {
      const timer = setInterval(() => void reload(), 3000);
      const stop = setTimeout(() => clearInterval(timer), 30_000);
      return () => {
        clearInterval(timer);
        clearTimeout(stop);
      };
    }
  }, [reload, banner]);

  async function recharge(packageId: string) {
    setError(null);
    setBusyPackage(packageId);
    try {
      const { data, error: apiError } = await api.POST('/wallet/topup/checkout', {
        body: { packageId },
      });
      if (!data?.checkoutUrl) {
        setError(apiError?.message ?? 'Could not start checkout');
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError('Could not reach the server');
    } finally {
      setBusyPackage(null);
    }
  }

  return (
    <section className="panel">
      <h3>Wallet</h3>

      {banner && (
        <p className="banner" role="status">
          {banner}{' '}
          <button type="button" className="linkish" onClick={() => setBanner(null)}>
            dismiss
          </button>
        </p>
      )}

      <div className="balances">
        <div className="balance">
          <span className="bal-label">💎 Diamonds</span>
          <b className="bal-diamonds">{balances ? balances.diamonds.toLocaleString() : '—'}</b>
        </div>
        <div className="balance">
          <span className="bal-label">🪙 Earnings (coins)</span>
          <b className="bal-coins">{balances ? balances.coins.toLocaleString() : '—'}</b>
        </div>
      </div>

      <h4>Recharge</h4>
      <div className="packages">
        {DIAMOND_PACKAGES.map((pack) => (
          <button
            key={pack.id}
            type="button"
            className="package"
            disabled={busyPackage !== null}
            onClick={() => void recharge(pack.id)}
          >
            <span className="pack-diamonds">💎 {pack.diamonds.toLocaleString()}</span>
            {pack.bonus > 0 && <span className="pack-bonus">+{pack.bonus} bonus</span>}
            <span className="pack-price">
              {busyPackage === pack.id ? '…' : `$${(pack.usdCents / 100).toFixed(2)}`}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="fineprint">
        Test mode — use card 4242 4242 4242 4242, any future date, any CVC.
      </p>

      {history.length > 0 && (
        <>
          <h4>History</h4>
          <ul className="history">
            {history.map((tx, i) => (
              <li key={`${tx.id}-${i}`}>
                <span>{KIND_LABEL[tx.kind]}</span>
                <span className={tx.amount >= 0 ? 'amount-in' : 'amount-out'}>
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount.toLocaleString()} {tx.currency === 'DIAMOND' ? '💎' : '🪙'}
                </span>
                <span className="muted">{new Date(tx.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
