/**
 * Sentry for mobile (@sentry/react-native pulls in native modules — dev/prod
 * build only). Lazy + guarded: no-op in Expo Go or when EXPO_PUBLIC_SENTRY_DSN
 * is unset, so the JS bundles everywhere.
 */
export function initMobileSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  } catch {
    // native module absent (Expo Go) — skip
  }
}
