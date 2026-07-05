import type { GiftCatalogItem } from '@grid/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';

export function GiftBar({ streamId, disabled }: { streamId: string; disabled: boolean }) {
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [busyGift, setBusyGift] = useState<string | null>(null);
  const [error, setError] = useState<'insufficient' | 'other' | null>(null);

  useEffect(() => {
    void api.GET('/gifts/catalog').then(({ data }) => {
      if (data) setCatalog(data as GiftCatalogItem[]);
    });
  }, []);

  async function send(gift: GiftCatalogItem) {
    setError(null);
    setBusyGift(gift.id);
    try {
      const { data, response } = await api.POST('/streams/{id}/gifts', {
        params: { path: { id: streamId } },
        body: { giftId: gift.id, qty: 1, idempotencyKey: crypto.randomUUID() },
      });
      if (data) {
        window.dispatchEvent(new CustomEvent('grid:wallet-changed'));
      } else if (response.status === 422) {
        setError('insufficient');
      } else {
        setError('other');
      }
    } catch {
      setError('other');
    } finally {
      setBusyGift(null);
    }
  }

  return (
    <div className="gift-bar">
      <div className="gift-scroll">
        {catalog.map((gift) => (
          <button
            key={gift.id}
            type="button"
            className="gift-btn"
            disabled={disabled || busyGift !== null}
            title={`${gift.name} — 💎${gift.priceDiamonds}`}
            onClick={() => void send(gift)}
          >
            <span className="gift-emoji">{busyGift === gift.id ? '…' : gift.emoji}</span>
            <span className="gift-price">💎{gift.priceDiamonds.toLocaleString()}</span>
          </button>
        ))}
      </div>
      {error === 'insufficient' && (
        <p className="error small">
          Not enough diamonds — <Link to="/me">recharge your wallet</Link>
        </p>
      )}
      {error === 'other' && <p className="error small">Could not send the gift</p>}
    </div>
  );
}
