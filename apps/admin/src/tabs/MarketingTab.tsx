import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';

interface BannerRow {
  id: string;
  title: string;
  placement: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}
interface PromoRow {
  id: string;
  code: string;
  kind: string;
  value: number;
  active: boolean;
  redemptionCount: number;
  maxRedemptions: number | null;
}

export function MarketingTab() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = () => {
    void adminApi<BannerRow[]>('GET', '/admin/marketing/banners').then(({ data, message: err }) => {
      if (data) setBanners(data);
      else setMessage(err ?? 'requires marketing.manage');
    });
    void adminApi<PromoRow[]>('GET', '/admin/marketing/promos').then(
      ({ data }) => data && setPromos(data),
    );
  };
  useEffect(load, []);

  async function createBanner(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const endsAt = form.get('endsAt');
    await adminApi('POST', '/admin/marketing/banners', {
      title: String(form.get('title')),
      placement: String(form.get('placement')),
      ...(endsAt ? { endsAt: new Date(String(endsAt)).toISOString() } : {}),
    });
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function createPromo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const endsAt = form.get('endsAt');
    await adminApi('POST', '/admin/marketing/promos', {
      code: String(form.get('code')),
      kind: String(form.get('kind')),
      value: Number(form.get('value')),
      ...(endsAt ? { endsAt: new Date(String(endsAt)).toISOString() } : {}),
    });
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleBanner(banner: BannerRow) {
    await adminApi('PUT', `/admin/marketing/banners/${banner.id}`, { active: !banner.active });
    load();
  }

  return (
    <div>
      {message && <p className="muted">{message}</p>}
      <h3>Ad banners</h3>
      <form onSubmit={(e) => void createBanner(e)} className="row">
        <input name="title" placeholder="banner title" required />
        <select name="placement">
          <option>ALL</option>
          <option>WEB</option>
          <option>MOBILE</option>
        </select>
        <input name="endsAt" type="datetime-local" title="ends at (optional)" />
        <button>Add banner</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Placement</th>
            <th>Window</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {banners.map((b) => (
            <tr key={b.id}>
              <td>{b.title}</td>
              <td>{b.placement}</td>
              <td>
                {b.startsAt ? new Date(b.startsAt).toLocaleDateString() : 'now'} →{' '}
                {b.endsAt ? new Date(b.endsAt).toLocaleDateString() : 'no end'}
              </td>
              <td>{b.active ? 'yes' : 'no'}</td>
              <td>
                <button className="ghost" onClick={() => void toggleBanner(b)}>
                  {b.active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Promo / discount codes</h3>
      <form onSubmit={(e) => void createPromo(e)} className="row">
        <input name="code" placeholder="CODE" required />
        <select name="kind">
          <option>PERCENT_OFF</option>
          <option>BONUS_DIAMONDS</option>
        </select>
        <input name="value" type="number" min="1" placeholder="value" required />
        <input name="endsAt" type="datetime-local" title="ends at (optional)" />
        <button>Add promo</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Kind</th>
            <th>Value</th>
            <th>Used</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.kind}</td>
              <td>{p.value}</td>
              <td>
                {p.redemptionCount}
                {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}
              </td>
              <td>{p.active ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Audience/platform targeting stays a JSON rules field and redemption is scaffolded — both get
        fleshed out later (docs/deferred.md).
      </p>
    </div>
  );
}
