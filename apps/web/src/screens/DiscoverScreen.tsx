import type { StreamSummary } from '@grid/shared';
import { gradient } from '@grid/ui-tokens';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';

const CATEGORIES = ['All', 'Gaming', 'Music', 'IRL', 'Fitness', 'Art'];

/** deterministic card gradient per stream (prototype thumbs are gradients) */
function thumbStyle(id: string): React.CSSProperties {
  const palettes = [gradient.brand, gradient.goLive, gradient.top];
  const pick = palettes[id.charCodeAt(0) % palettes.length];
  return { background: `linear-gradient(135deg, ${pick[0]}33, ${pick[1]}55)` };
}

export function DiscoverScreen() {
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState<StreamSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await api.GET('/streams', {
        params: { query: category === 'All' ? {} : { category } },
      });
      if (!cancelled && data) setItems(data.items as StreamSummary[]);
    };
    void load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [category]);

  return (
    <main className="page">
      <div className="chips">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="muted pad">Loading live streams…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <p>Nobody is live{category !== 'All' ? ` in ${category}` : ''} right now.</p>
          <Link className="primary-link" to="/go-live">
            Be the first — go live
          </Link>
        </div>
      ) : (
        <div className="stream-grid">
          {items.map((s) => {
            const locked = !s.entitled;
            return (
              <Link key={s.id} to={`/stream/${s.id}`} className="stream-card">
                <div className={`thumb ${locked ? 'locked' : ''}`} style={thumbStyle(s.id)}>
                  <span className="live-tag">LIVE · {s.viewerCount}</span>
                  {locked && (
                    <span className="lock-badge">
                      🔒{s.access === 'PPV' && s.ppvPriceDiamonds ? ` 💎${s.ppvPriceDiamonds}` : ''}
                    </span>
                  )}
                  {s.category && <span className="cat-tag">{s.category}</span>}
                </div>
                <p className="card-title">{s.title}</p>
                <p className="card-creator">@{s.creatorHandle}</p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
