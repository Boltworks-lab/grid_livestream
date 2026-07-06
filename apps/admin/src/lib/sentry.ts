import * as Sentry from '@sentry/react';

/** Error tracking (brief §2). No-op unless VITE_SENTRY_DSN is set. */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.headers) delete event.request.headers.Authorization;
      return event;
    },
  });
}
