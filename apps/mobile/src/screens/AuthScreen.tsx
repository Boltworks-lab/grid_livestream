import { loginSchema, registerSchema } from '@grid/shared';
import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';

type Mode = 'signin' | 'register';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    setError(null);
    const parsed =
      mode === 'signin'
        ? loginSchema.safeParse({ identifier, password })
        : registerSchema.safeParse({ email, handle, dob, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue.path.join('.')}: ${issue.message}`);
      return;
    }
    setBusy(true);
    const failure =
      mode === 'signin' ? await login(parsed.data as never) : await register(parsed.data as never);
    if (failure) setError(failure);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandGlyph}>▶</Text>
            </View>
            <Text style={styles.brandName}>Grid</Text>
          </View>
          <Text style={styles.tagline}>Go live. Get gifted. Get paid.</Text>

          <View style={styles.tabs}>
            {(['signin', 'register'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={[styles.tab, mode === m && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'signin' ? (
            <Field
              label="Email or handle"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
          ) : (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Field label="Handle" value={handle} onChangeText={setHandle} autoCapitalize="none" />
              <Field
                label="Date of birth (YYYY-MM-DD, 18+)"
                value={dob}
                onChangeText={setDob}
                placeholder="1999-12-31"
              />
            </>
          )}
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={submit}>
            {busy ? (
              <ActivityIndicator color={color.white} />
            ) : (
              <Text style={styles.primaryText}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.fineprint}>
            By continuing you confirm you are 18 or older and accept the Terms & Community
            Guidelines.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={color.t3} {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.xxl },
  card: {
    backgroundColor: color.bg1,
    borderColor: alpha.border,
    borderWidth: 1,
    borderRadius: radius.rl,
    padding: space.xxl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: { color: color.white, fontSize: 15 },
  brandName: { color: color.t1, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  tagline: { color: color.t2, marginTop: 8, marginBottom: 20 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.pill,
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: alpha.purpleGlow, borderColor: alpha.borderAccent },
  tabText: { color: color.t2, fontSize: 13 },
  tabTextActive: { color: color.purple2, fontWeight: '600' },
  field: { marginBottom: space.lg },
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
  },
  error: { color: color.red, fontSize: 12, marginBottom: space.md },
  primary: {
    backgroundColor: color.purple,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: color.white, fontWeight: '600', fontSize: 14 },
  fineprint: { color: color.t3, fontSize: 11, lineHeight: 16, marginTop: space.xl },
});
