import { createStreamSchema } from '@grid/shared';
import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '../lib/api';
import type { RootStackParamList } from '../navigation';

export function GoLiveScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState<'FREE' | 'PPV' | 'SUBS'>('FREE');
  const [price, setPrice] = useState('50');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    const parsed = createStreamSchema.safeParse({
      title,
      access,
      visibility: 'PUBLIC',
      ppvPriceDiamonds: access === 'PPV' ? Number(price) : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.POST('/streams', { body: parsed.data as never });
      if (!data) {
        setError('could not create stream');
        return;
      }
      const id = (data as { id: string }).id;
      const live = await api.POST('/streams/{id}/go-live', { params: { path: { id } } });
      if (live.response.ok) navigation.navigate('LiveRoom', { streamId: id });
      else setError('going live failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <Text style={styles.h2}>Go live</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        placeholder="What are you streaming?"
        placeholderTextColor={color.t3}
      />
      <Text style={styles.label}>Access</Text>
      <View style={styles.row}>
        {(
          [
            ['FREE', 'Free'],
            ['PPV', 'Pay-per-view'],
            ['SUBS', 'Subs only'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.option, access === value && styles.optionActive]}
            onPress={() => setAccess(value)}
          >
            <Text style={[styles.optionText, access === value && styles.optionTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {access === 'PPV' && (
        <>
          <Text style={styles.label}>Unlock price (💎)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
          />
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={() => void start()}>
        <Text style={styles.primaryText}>{busy ? '…' : 'Start streaming'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  wrap: { padding: space.xl, paddingTop: 60, gap: 6 },
  h2: { color: color.t1, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  label: { color: color.t2, fontSize: 12, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: color.bg2,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.r,
    color: color.t1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.pill,
    paddingVertical: 9,
    alignItems: 'center',
  },
  optionActive: { backgroundColor: alpha.purpleGlow, borderColor: alpha.borderAccent },
  optionText: { color: color.t2, fontSize: 12 },
  optionTextActive: { color: color.purple2, fontWeight: '600' },
  error: { color: color.red, fontSize: 12, marginTop: 8 },
  primary: {
    marginTop: 18,
    backgroundColor: color.purple,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: color.white, fontWeight: '700' },
});
