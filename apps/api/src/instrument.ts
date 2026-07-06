// Sentry MUST init before any other module is imported so its auto-instrumentation
// can patch http/pg/etc. main.ts imports this file first. dotenv loads here too
// because env.ts (which normally loads it) is imported after this runs.
import 'dotenv/config';

import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    profilesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // never ship PII: scrub the auth header + cookies before events leave
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
