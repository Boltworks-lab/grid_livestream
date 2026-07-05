# Deferred items — the "don't forget" ledger

Things intentionally skipped or stubbed, with what unblocks each. Review at the start
of every phase; delete entries when done. (CLAUDE.md points here.)

## Blocked on owner input (placeholders exist in .env.example)

| Item                                                                  | Needs                                            | Placeholder / seam                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Email OTP login (Phase 2)                                             | Provider choice — Resend or Postmark — + API key | `EMAIL_API_KEY`; brief §7 suggests Resend/Postmark                                           |
| Google OAuth (Phase 2)                                                | Client ID + secret from Google console           | `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`; spec: `POST /auth/oauth/{provider}` |
| Apple Sign-In (Phase 2; mandatory on iOS once any social login ships) | Service ID + key from Apple developer console    | `APPLE_OAUTH_CLIENT_ID` / `APPLE_OAUTH_KEY_*`                                                |
| Sentry, all apps (Phase 2)                                            | DSN(s) from sentry.io                            | `SENTRY_DSN`                                                                                 |
| Zendesk + Metabase sign-off                                           | Owner vendor/cost approval                       | ADR 0003 records the recommendation                                                          |

## Deferred by design (no input needed — just later)

- **Contract-drift CI gate**: emit OpenAPI from @nestjs/swagger and fail CI when it
  drifts from `docs/api/openapi.yaml` (brief §10 "Contract"). Client generation is
  manual until then (`pnpm --filter @grid/api-client generate`).
- **/health → Terminus** with DB/Redis probes once Phase 3 needs readiness checks.
- **chat_messages day-partitioning** — when volume demands (ADR 0002).
- **Playwright E2E + Testcontainers integration tests** — Phase 3 per brief §10.
- **Settings screen** (content preferences, privacy toggles, terms sections from the
  prototypes) — web has profile-only shell so far; mobile same.
- **Inter/JetBrains Mono fonts on mobile** (expo-font) — system fonts for now.
- **Timing-safe login** (verify against a constant hash when user not found) — noted
  in auth.service.ts; fine behind rate limiting for now.

## Dev-machine housekeeping (cosmetic)

- Wedged-Docker leftovers: poisoned alpine layer snapshots in Docker Desktop; a
  "Purge data" in Docker Desktop settings reclaims them. Compose uses `postgres:16`
  (Debian) partly for this reason.
- Dev DB contains e2e test users (`mia`, `leo`) and one guard-test ledger row —
  `prisma migrate reset` (needs interactive consent) whenever a clean slate is wanted.
- Prototype README moved to `prototypes/README.md`; root README covers the monorepo.
