import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

export function HomeScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  async function saveProfile() {
    setBusy(true);
    setSaved(false);
    const name = displayName.trim();
    const about = bio.trim();
    const { data } = await api.PATCH('/users/me', {
      body: { ...(name ? { displayName: name } : {}), ...(about ? { bio: about } : {}) },
    });
    if (data) {
      await refreshUser();
      setSaved(true);
    }
    setBusy(false);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandGlyph}>▶</Text>
          </View>
          <Text style={styles.brandName}>Grid</Text>
        </View>
        <Pressable style={styles.ghost} onPress={() => void logout()}>
          <Text style={styles.ghostText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.h2}>Welcome, {user.displayName ?? `@${user.handle}`}</Text>
        <Text style={styles.muted}>
          Phase 2 shell — Discover, live rooms, wallet and gifting arrive in Phases 3–5.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.h3}>Profile</Text>
        <Text style={styles.fieldLabel}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
          placeholderTextColor={color.t3}
        />
        <Text style={styles.fieldLabel}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={setBio}
          maxLength={300}
          multiline
          placeholderTextColor={color.t3}
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.primary, busy && styles.primaryDisabled]}
            onPress={() => void saveProfile()}
          >
            <Text style={styles.primaryText}>{busy ? '…' : 'Save profile'}</Text>
          </Pressable>
          {saved && <Text style={styles.saved}>Saved ✓</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  wrap: { padding: space.xl, paddingTop: 60 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xxl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: { color: color.white, fontSize: 12 },
  brandName: { color: color.t1, fontSize: 16, fontWeight: '700' },
  ghost: {
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: color.bg2,
  },
  ghostText: { color: color.t2, fontSize: 12 },
  panel: {
    backgroundColor: color.bg1,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.rl,
    padding: space.xl,
    marginBottom: space.lg,
  },
  h2: { color: color.t1, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  h3: { color: color.t1, fontSize: 15, fontWeight: '700', marginBottom: space.md },
  muted: { color: color.t2, lineHeight: 19 },
  fieldLabel: { color: color.t2, fontSize: 12, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: color.bg2,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.r,
    color: color.t1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: space.md,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primary: {
    backgroundColor: color.purple,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: color.white, fontWeight: '600', fontSize: 13 },
  saved: { color: color.green, fontSize: 12 },
});
