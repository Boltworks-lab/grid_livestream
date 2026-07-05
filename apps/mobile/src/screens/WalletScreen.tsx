import { DIAMOND_PACKAGES, type WalletBalances, type WalletTransaction } from '@grid/shared';
import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';

export function WalletScreen() {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [history, setHistory] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [b, t] = await Promise.all([api.GET('/wallet'), api.GET('/wallet/transactions')]);
    if (b.data) setBalances(b.data);
    if (t.data?.items) setHistory(t.data.items as WalletTransaction[]);
  }, []);

  useEffect(() => {
    void load();
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
      <Text style={styles.h2}>Wallet</Text>
      <View style={styles.row}>
        <View style={styles.balance}>
          <Text style={styles.balLabel}>💎 Diamonds</Text>
          <Text style={styles.balDiamonds}>
            {balances ? balances.diamonds.toLocaleString() : '—'}
          </Text>
        </View>
        <View style={styles.balance}>
          <Text style={styles.balLabel}>🪙 Earnings</Text>
          <Text style={styles.balCoins}>{balances ? balances.coins.toLocaleString() : '—'}</Text>
        </View>
      </View>

      <Text style={styles.section}>Packages</Text>
      <View style={styles.packRow}>
        {DIAMOND_PACKAGES.map((p) => (
          <View key={p.id} style={styles.pack}>
            <Text style={styles.packDiamonds}>💎 {p.diamonds.toLocaleString()}</Text>
            {p.bonus > 0 && <Text style={styles.packBonus}>+{p.bonus}</Text>}
            <Text style={styles.packPrice}>${(p.usdCents / 100).toFixed(2)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Top-ups are web-only for now — in-app purchases (RevenueCat) are on the roadmap
        (docs/deferred.md). Recharge at the web app; balances sync instantly.
      </Text>

      {history.length > 0 && (
        <>
          <Text style={styles.section}>History</Text>
          {history.map((tx, i) => (
            <View key={`${tx.id}-${i}`} style={styles.histRow}>
              <Text style={styles.histKind}>{tx.kind}</Text>
              <Text style={tx.amount >= 0 ? styles.in : styles.out}>
                {tx.amount >= 0 ? '+' : ''}
                {tx.amount.toLocaleString()} {tx.currency === 'DIAMOND' ? '💎' : '🪙'}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  wrap: { padding: space.xl, paddingTop: 60 },
  h2: { color: color.t1, fontSize: 20, fontWeight: '700', marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  balance: {
    flex: 1,
    backgroundColor: color.bg1,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.rl,
    padding: 14,
    gap: 4,
  },
  balLabel: { color: color.t2, fontSize: 12 },
  balDiamonds: { color: color.amber2, fontSize: 20, fontWeight: '700' },
  balCoins: { color: color.teal, fontSize: 20, fontWeight: '700' },
  section: { color: color.t2, fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pack: {
    width: '31%',
    backgroundColor: color.bg2,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.r,
    padding: 10,
    gap: 2,
  },
  packDiamonds: { color: color.amber2, fontSize: 12, fontWeight: '700' },
  packBonus: { color: color.green, fontSize: 10 },
  packPrice: { color: color.t2, fontSize: 11 },
  note: { color: color.t3, fontSize: 11, lineHeight: 16, marginTop: 10 },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: alpha.border,
    paddingVertical: 9,
  },
  histKind: { color: color.t1, fontSize: 13 },
  in: { color: color.green, fontWeight: '600', fontSize: 13 },
  out: { color: color.red, fontWeight: '600', fontSize: 13 },
});
