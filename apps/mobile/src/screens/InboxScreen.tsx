import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/notifications');
    if (data?.items) setItems(data.items as Notification[]);
  }, []);

  useEffect(() => {
    void load();
    void api.POST('/notifications/read-all');
  }, [load]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.wrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color.purple}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Text style={styles.h2}>Inbox</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        items.map((n) => (
          <View key={n.id} style={[styles.row, !n.read && styles.unread]}>
            <Text style={styles.icon}>{ICON[n.kind] ?? '🔔'}</Text>
            <View style={styles.body}>
              <Text style={styles.text}>{n.body}</Text>
              <Text style={styles.time}>{new Date(n.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  wrap: { padding: space.xl, paddingTop: 60 },
  h2: { color: color.t1, fontSize: 20, fontWeight: '700', marginBottom: 14 },
  empty: { color: color.t2, marginTop: 40, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: color.bg1,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.rl,
    padding: 14,
    marginBottom: 10,
  },
  unread: { borderColor: alpha.borderAccent, backgroundColor: color.bg2 },
  icon: { fontSize: 20 },
  body: { flex: 1, gap: 3 },
  text: { color: color.t1, fontSize: 13 },
  time: { color: color.t3, fontSize: 11 },
});
