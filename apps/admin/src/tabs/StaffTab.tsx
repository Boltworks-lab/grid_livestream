import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';

interface StaffRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
}

const STAFF_ROLES = [
  'ADMIN',
  'MODERATOR',
  'TECH_SUPPORT',
  'BILLING_SUPPORT',
  'SUPPORT',
  'MARKETING',
  'ANALYST',
] as const;

export function StaffTab() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = () =>
    void adminApi<StaffRow[]>('GET', '/admin/staff').then(({ data, message: err }) => {
      if (data) setRows(data);
      else setMessage(err ?? 'requires staff.manage (SUPERADMIN)');
    });
  useEffect(load, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { data, message: err } = await adminApi('POST', '/admin/staff', {
      email: String(form.get('email')),
      name: String(form.get('name')),
      role: String(form.get('role')),
      password: String(form.get('password')),
    });
    setMessage(data ? 'Staff created — they enroll TOTP on first login.' : (err ?? 'failed'));
    load();
  }

  return (
    <div>
      <form onSubmit={(e) => void create(e)} className="row">
        <input name="email" type="email" placeholder="email" required />
        <input name="name" placeholder="name" required />
        <select name="role">
          {STAFF_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <input name="password" type="password" placeholder="initial password (10+)" required />
        <button>Create staff</button>
      </form>
      {message && <p className="muted">{message}</p>}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last login</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{s.email}</td>
              <td>{s.name}</td>
              <td>{s.role}</td>
              <td>{s.status}</td>
              <td>{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Role privileges are the permission matrix in the API (permissions.ts) — coarse for now,
        fleshed out per role over time. Moderator support additionally holds moderation.view_gated:
        audited access to paywalled content for legal monitoring.
      </p>
    </div>
  );
}
