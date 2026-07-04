# ADR 0004 — LiveKit room lifecycle & token policy for gated streams

- **Status:** Accepted
- **Date:** 2026-07-03
- **Context:** Gated streams must be enforced at the media layer (PROJECT_BRIEF §3.4):
  a LiveKit token is minted only after the server verifies entitlement. This ADR fixes
  the room lifecycle, token shape, and revocation story that Phases 4 and 6 implement.

## Room lifecycle

1. **Create:** `POST /streams` creates the `streams` row (SCHEDULED). No LiveKit
   resource exists yet.
2. **Go live:** creator hits the publish flow → server creates the LiveKit room
   (name = stream UUID, `empty_timeout` ≈ 60 s, `max_participants` from config),
   stores `livekitRoom`, sets status LIVE, broadcasts `stream:status`.
3. **End:** creator ends (or LiveKit `room_finished` webhook fires after the room
   empties) → status ENDED, `endedAt` set, viewer counts frozen, egress (VOD) hooks
   run in Phase 9.
   LiveKit webhooks are signature-verified like every other webhook (§3.3).

## Token policy

- **Mint path:** only `POST /streams/{id}/token`, after the entitlement check:
  - FREE + PUBLIC → any authenticated, non-banned user.
  - FOLLOWERS → caller follows the creator.
  - PRIVATE → caller has an INVITE grant.
  - PPV / SUBS → caller has a `stream_access_grants` row (PPV unlock tx or active sub).
  - Creator always gets their own room's publisher token.
- **Token shape:** LiveKit JWT, `identity = user id`, `name = handle`, TTL **2 minutes**
  (enough to complete the WebRTC handshake; a token is a door key, not a session).
  Once connected, the session lives until disconnect — LiveKit does not drop
  participants on token expiry, which is why revocation is explicit (below).
- **Grants:** viewers `roomJoin + canSubscribe` only (no publish, no data-publish);
  creator `roomJoin + canPublish + canPublishData + roomAdmin` for their own room only.
  Admin/moderation service uses server-side RoomService APIs, never long-lived
  super-tokens in clients.
- **Reconnects** re-hit the token endpoint — entitlement is re-checked every join
  (a refund/ban between joins locks the door immediately).

## Revocation

- Ban/suspension, refund of a PPV unlock, or sub expiry mid-stream → server calls
  `RemoveParticipant` (and the entitlement check blocks re-entry). Moderation
  "remove stream" → `DeleteRoom`, hard stop for all participants (§8).

## Rejected alternatives

- **Long-lived tokens (hours):** entitlement drifts from reality (refunds, bans);
  violates the spirit of §3.4.
- **One shared room token per stream:** no per-user identity → no per-user revocation,
  moderation, or top-gifter attribution. Never.
- **Client-side gate (hide video in CSS):** explicitly forbidden by §3.4.

## Consequences

- The token endpoint is on the hot join path → it gets a rate limit and a fast
  entitlement query (indexed `stream_access_grants` unique lookup).
- Stream keys/secrets (LiveKit API key/secret) live server-side only; clients only
  ever see short-lived JWTs.
