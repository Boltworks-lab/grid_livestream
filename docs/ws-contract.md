# WebSocket event contract

The executable contract lives in **`packages/shared/src/ws-events.ts`** — zod schemas
validated on both sides of the socket (PROJECT_BRIEF §3.6). This page is the human
summary; if they disagree, the code wins.

Transport: Socket.IO on the api (namespace `/rt`), Redis adapter for horizontal scale
(ADR 0001). Sockets authenticate with the JWT access token at connect; join/leave
`stream:{streamId}` rooms explicitly.

## Client → server

| Event          | Payload                    | Notes                                                                                              |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `stream:join`  | `{ streamId }`             | Presence + viewer count; rejected for gated streams without entitlement (§3.4 applies to chat too) |
| `stream:leave` | `{ streamId }`             |                                                                                                    |
| `chat:send`    | `{ streamId, body ≤ 500 }` | Rate-limited per user (§3.7); moderation filter runs before broadcast (§8)                         |

Gift sending is **HTTP POST** (`/streams/{id}/gifts`) because money moves in the ledger
(§3.1) — the socket only ever carries the resulting broadcast.

## Server → client (broadcast to `stream:{streamId}`)

| Event                  | Payload                                 | Notes                                                    |
| ---------------------- | --------------------------------------- | -------------------------------------------------------- |
| `chat:message`         | message + sender handle/level           |                                                          |
| `chat:message:removed` | `{ streamId, messageId }`               | Moderation (auto or staff)                               |
| `gift:sent`            | gift, qty, sender, combo                | Drives the gift animations from the prototypes           |
| `viewer:count`         | `{ streamId, count }`                   | Throttled (~2 s)                                         |
| `stream:status`        | `scheduled → live → ended`              | Also broadcast to followers' inbox surface later         |
| `presence:event`       | `{ userId, handle, kind: join/follow }` | The "x joined / x followed" chat lines in the prototypes |

Every mutation event originates server-side after validation — clients render, never
decide (§3.2).
