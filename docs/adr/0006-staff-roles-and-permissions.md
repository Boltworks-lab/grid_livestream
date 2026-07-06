# ADR 0006 — Staff roles & permissions

- **Status:** Accepted
- **Date:** 2026-07-05
- **Context:** The owner requires distinct support roles beyond the superadmin —
  technical support, billing support, marketing support (running the marketing CMS),
  and moderator support (who must be able to view paywalled/hidden content for legally
  required content monitoring in some jurisdictions). Privileges will be refined over
  time; the structure must exist now.

## Decision

**A permission matrix, not hardcoded role checks.** Endpoints declare the _permission_
they need (`@RequirePermission('payouts.review')`); a single matrix
(`apps/api/src/admin/permissions.ts`) maps each `StaffRole` → permissions, checked by
`AdminGuard` after it validates the staff token. Refining a role = editing one table.

### Roles → permissions (initial, coarse)

| Role            | Permissions                                            |
| --------------- | ------------------------------------------------------ |
| SUPERADMIN      | everything (incl. `staff.manage`)                      |
| ADMIN           | everything except `staff.manage`                       |
| MODERATOR       | `reports.act`, `moderation.view_gated`, `users.lookup` |
| TECH_SUPPORT    | `users.lookup`, `audit.view`                           |
| BILLING_SUPPORT | `payouts.review`, `users.lookup`                       |
| MARKETING       | `marketing.manage`                                     |
| SUPPORT         | `users.lookup`                                         |
| ANALYST         | `users.lookup`, `audit.view`                           |

### Sensitive permission: `moderation.view_gated`

Moderators can mint a **subscribe-only** LiveKit token for any live stream _without an
entitlement grant_ — the legally required content-monitoring capability. Guardrails:

- It is a **separate permission**, held only by MODERATOR (+ admins), never bundled
  into generic support.
- The token grants **view-only** (no publish), identity `staff:{id}`.
- **Every use writes audit_log** (`moderation.view_gated_stream`) recording which staff
  member viewed which stream and when — non-repudiable, append-only.

## Consequences

- New privileges attach to roles by editing the matrix + adding a permission constant;
  no endpoint rewrites.
- The matrix is the audit surface for "who can do what" — one file to review.
- Per-permission staff (finer than per-role) and a staff self-service password/TOTP
  reset are future work (docs/deferred.md).
