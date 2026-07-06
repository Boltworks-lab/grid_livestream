# Runbook — DMCA / illegal-content takedown

Grid must have a registered DMCA agent and a takedown flow (brief §7). This covers a
valid DMCA notice or an illegal-content report. **CSAM is different — see the bottom.**

## Valid DMCA notice

1. **Log it** — file a report on the target (`POST /reports` or admin) so the action is
   tracked and audited.
2. **Take it down promptly** — admin → Reports → `REMOVE_CONTENT` (chat/VOD) or end the
   stream; for a repeat infringer, `SUSPEND`/`BAN` (revokes sessions).
3. **Notify** the uploader with the claim details (counter-notice rights).
4. **Record** the notice, action, and timestamps (audit_log covers the staff action;
   keep the legal notice with counsel).
5. **Repeat-infringer policy**: escalate per strike count → termination.

## Counter-notice

- If the uploader files a valid counter-notice, forward to the claimant; restore after
  the statutory window unless the claimant files suit.

## CSAM (mandatory reporting — not a normal takedown)

- **Do not** treat as routine moderation. Preserve evidence, do **not** download/share.
- Report to NCMEC per legal obligation; follow counsel's instructions.
- These actions are the one moderation category that is **not** reversible by staff
  (brief §8). Page the founder + legal immediately.
