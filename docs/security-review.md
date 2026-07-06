# Security review — OWASP ASVS L2 pass (Phase 10)

Reviewed against ASVS L2 basics (brief §10). Status as of Phase 10. This is the living
security posture doc; update it as the surface changes.

## Summary

Core money/auth paths are hardened and enforced server-side. Owner-blocked items
(OAuth, email verification, Sentry) are noted. No secrets in the repo (verified across
full git history). Remaining gaps are tracked, none critical for a test-mode staging
launch; a professional pen-test is recommended before public production (brief §10).

## Findings by ASVS chapter

### V2 Authentication

| Control                                                                  | Status                       |
| ------------------------------------------------------------------------ | ---------------------------- |
| Passwords hashed with argon2id                                           | ✅                           |
| Refresh tokens: single-use rotation + family reuse-detection revocation  | ✅ (regression-tested)       |
| Access tokens short-lived (15 min); refresh hashed at rest (sha256)      | ✅                           |
| Rate-limit auth endpoints (10/min)                                       | ✅                           |
| Staff: separate JWT secret + `typ` claim; user tokens rejected on /admin | ✅ (verified)                |
| Staff TOTP 2FA mandatory (enroll-on-first-login)                         | ✅ (verified)                |
| Email/phone verification, OAuth (Google/Apple)                           | ⏳ owner-blocked (providers) |
| Generic login errors (no user enumeration)                               | ✅ ("invalid credentials")   |

### V3 Session management

- Stateless JWT; refresh rotation is the session lifecycle. Ban/suspend revokes all
  refresh tokens immediately (verified). Staff tokens 8h. **Gap:** no user-facing
  "log out all devices" / active-session list (deferred).

### V4 Access control

- Global `JwtAuthGuard`; `@Public()` opt-out is explicit and audited by grep.
- **Media/chat gate enforced server-side** (§3.4): entitlement re-checked on every
  token mint and chat join — not a CSS curtain (verified 402/403 paths).
- Staff **permission matrix** (`@RequirePermission`) enforced per-role; moderator
  paywall-bypass is a separate permission and **every use is audit-logged** (verified).
- IDOR: money reads/writes scoped to `req.user.sub`; admin money data is read-only.

### V5 Validation / injection

- **zod at every edge** (shared schemas); `ZodValidationPipe` + `ParseUUIDPipe`.
- **SQL injection:** Prisma parameterizes everything; the only raw query
  (`… WHERE id = ${id}::uuid FOR UPDATE`) uses a Prisma tagged template (parameterized) —
  reviewed, safe.
- Output: JSON API, no server-rendered HTML → XSS surface is the SPAs (React escapes by
  default; no `dangerouslySetInnerHTML`).

### V7 Error handling / logging

- pino structured logs; **Authorization header redacted** (verified in logs).
- Append-only `audit_log` for every staff mutation (DB-trigger enforced).
- **Gap:** Sentry not wired (owner-blocked DSN).

### V8 Data protection

- Secrets in env only; `.env` gitignored; **full git history scanned — zero leaks**.
- CI secret scanning (gitleaks) + dependency audit now gate every push.
- **Money integrity:** double-entry ledger, immutable entries (UPDATE/DELETE forbidden
  by DB trigger), per-currency zero-sum, idempotent mutations, `FOR UPDATE` overdraw
  locks — proven by Testcontainers + fast-check.

### V9 Communications

- HTTPS terminates at the platform edge (Vercel/Fly) in deployed envs.
- **helmet** security headers (HSTS, nosniff, frame-deny, referrer-policy) — added
  Phase 10.
- CORS restricted to configured origins.

### V10 Malicious code / webhooks

- **Payments credited only from signature-verified webhooks, exactly once** (§3.3):
  Stripe signature checked against the raw body; webhook route skips throttling so
  retry bursts aren't dropped. Idempotency keyed on the Stripe object id.

### V11 Business logic

- Server-authoritative pricing/splits (clients never decide, §3.2); economics
  runtime-configurable with a loud default fallback.
- Rate limits on gifting (30/min), gates/unlock (10/min), payouts (10/min),
  subscriptions checkout (10/min), reports (10/min).
- Chat rate limit 5 msg / 5 s per user (Redis).
- New-creator payout hold; min-payout floor.

## Recommended before public production

- [ ] Professional pen-test + ZAP baseline against staging (brief §10).
- [ ] Sentry (owner) — error visibility.
- [ ] Email verification + OAuth (owner) — account-recovery & trust.
- [ ] Admin behind SSO/IP-allowlist (brief §12).
- [ ] Stripe Radar velocity rules; top-up/gift velocity caps (brief §7).
- [ ] Rotate the seeded dev admin credential; enforce a staff password policy.
- [ ] Automated content moderation (§8) before scaling UGC.
