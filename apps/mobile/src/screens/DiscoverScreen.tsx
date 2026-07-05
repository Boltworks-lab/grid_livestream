import type { StreamSummary } from '@grid/shared';
import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';
import type { RootStackParamList } from '../navigation';

const CATEGORIES = ['All', 'Gaming', 'Music', 'IRL', 'Fitness', 'Art'];

export function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState<StreamSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/streams', {
      params: { query: category === 'All' ? {} : { category } },
    });
    if (data) setItems(data.items as StreamSummary[]);
  }, [category]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <View style={styles.flex}>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nobody is live{category !== 'All' ? ` in ${category}` : ''} right now.
          </Text>
        }
        renderItem={({ item: s }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate('LiveRoom', { streamId: s.id, ids: items.map((i) => i.id) })
            }
          >
            <View style={[styles.thumb, !s.entitled && styles.thumbLocked]}>
              <Text style={styles.liveTag}>LIVE · {s.viewerCount}</Text>
              {!s.entitled && (
                <Text style={styles.lock}>
                  🔒{s.access === 'PPV' && s.ppvPriceDiamonds ? ` 💎${s.ppvPriceDiamonds}` : ''}
                </Text>
              )}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {s.title}
            </Text>
            <Text style={styles.creator}>@{s.creatorHandle}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: space.lg, paddingBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: alpha.border,
    backgroundColor: color.bg2,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: color.t1, borderColor: color.t1 },
  chipText: { color: color.t2, fontSize: 12 },
  chipTextActive: { color: color.bg0, fontWeight: '600' },
  empty: { color: color.t2, textAlign: 'center', marginTop: 60 },
  card: { flex: 1, maxWidth: '48.5%' },
  thumb: {
    aspectRatio: 4 / 5,
    borderRadius: radius.rl,
    backgroundColor: color.bg3,
    borderWidth: 1,
    borderColor: alpha.border,
    padding: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  thumbLocked: { opacity: 0.55 },
  liveTag: {
    backgroundColor: 'rgba(0,0,0,.55)',
    color: color.white,
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  lock: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: color.white,
    fontSize: 15,
    fontWeight: '700',
  },
  title: { color: color.t1, fontSize: 13, fontWeight: '500', marginTop: 7 },
  creator: { color: color.t2, fontSize: 11, marginTop: 2 },
});
