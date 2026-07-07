import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';

interface ModConfig {
  enabled: boolean;
  terms: Record<string, 'allow' | 'flag' | 'block'>;
  allow: string[];
  mlThresholds?: Record<string, number>;
}

/**
 * Automated-moderation filter editor (brief §8). Staff add, RECLASSIFY, and —
 * importantly — REMOVE terms so the platform doesn't over-police. Different
 * communities differ; the list is data, not law. Every save is audited.
 */
export function ModerationTab() {
  const [cfg, setCfg] = useState<ModConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTerm, setNewTerm] = useState('');
  const [newSeverity, setNewSeverity] = useState<'flag' | 'block'>('flag');

  const load = () =>
    void adminApi<ModConfig>('GET', '/admin/moderation/config').then(({ data, message: err }) => {
      if (data) setCfg(data);
      else setMessage(err ?? 'requires moderation.config');
    });
  useEffect(load, []);

  async function save(next: ModConfig) {
    const { data, message: err } = await adminApi<ModConfig>(
      'PUT',
      '/admin/moderation/config',
      next,
    );
    if (data) {
      setCfg(data);
      setMessage('Saved — live within 30s. Audited.');
    } else setMessage(err ?? 'save failed');
  }

  if (!cfg) return <p className="muted">{message ?? 'Loading…'}</p>;

  const addTerm = () => {
    const term = newTerm.trim().toLowerCase();
    if (!term) return;
    void save({ ...cfg, terms: { ...cfg.terms, [term]: newSeverity } });
    setNewTerm('');
  };
  const removeTerm = (term: string) => {
    const terms = { ...cfg.terms };
    delete terms[term];
    void save({ ...cfg, terms });
  };
  const reclassify = (term: string, severity: 'allow' | 'flag' | 'block') =>
    void save({ ...cfg, terms: { ...cfg.terms, [term]: severity } });

  return (
    <div>
      <p className="muted">
        <b>block</b> = never shown (sender told); <b>flag</b> = shown but queued for human review;{' '}
        <b>allow</b> = never touched. Default posture is review, not block — remove or downgrade
        anything that over-flags for your communities.
      </p>
      <label className="row">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => void save({ ...cfg, enabled: e.target.checked })}
        />
        Automated moderation enabled
      </label>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          placeholder="term (matched after normalization)"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
        />
        <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as 'flag')}>
          <option value="flag">flag</option>
          <option value="block">block</option>
        </select>
        <button onClick={addTerm}>Add term</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Term</th>
            <th>Severity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.keys(cfg.terms).length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No terms — nothing is auto-flagged.
              </td>
            </tr>
          )}
          {Object.entries(cfg.terms).map(([term, sev]) => (
            <tr key={term}>
              <td>{term}</td>
              <td>
                <select value={sev} onChange={(e) => reclassify(term, e.target.value as 'allow')}>
                  <option value="allow">allow</option>
                  <option value="flag">flag</option>
                  <option value="block">block</option>
                </select>
              </td>
              <td>
                <button className="danger" onClick={() => removeTerm(term)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && <p className="muted">{message}</p>}
      <p className="muted">
        ML text/image moderation (nuanced categories, stream frame sampling) drops in once a
        provider key is configured — see docs/deferred.md.
      </p>
    </div>
  );
}
