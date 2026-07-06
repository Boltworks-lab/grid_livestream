import { useEffect, useState } from 'react';

import { api } from '../lib/api';

interface Notification {
  id: string;
  kind: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICON: Record<string, string> = {
  gift_received: '🎁',
  new_follower: '➕',
};

export function InboxScreen() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    void api.GET('/notifications').then(({ data }) => {
      if (data?.items) setItems(data.items as Notification[]);
    });
    void api.POST('/notifications/read-all');
  }, []);

  return (
    <main className="page narrow">
      <h2>Inbox</h2>
      {items.length === 0 ? (
        <p className="muted pad">No notifications yet.</p>
      ) : (
        <ul className="inbox">
          {items.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <span className="inbox-icon">{ICON[n.kind] ?? '🔔'}</span>
              <span className="inbox-body">
                {n.body}
                <span className="inbox-time">{new Date(n.createdAt).toLocaleString()}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
