# ADR 0002 — Chat persistence strategy

- **Status:** Accepted
- **Date:** 2026-07-03
- **Context:** PROJECT_BRIEF §4 leaves chat storage open ("Redis hot path + async batch
  persist to Postgres, or a `chat_messages` table partitioned by day — decide in Phase 1").
  Load target is 500 msg/s platform-wide (brief §10). Moderation needs durable chat as
  evidence (brief §6.2), and reports reference individual messages.

## Options considered

| #   | Option                                               | Verdict                                                                                                                                                         |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Write every message straight to Postgres             | Simple, but couples chat latency to DB write latency and burns IOPS at burst time (gift storms). Rejected.                                                      |
| B   | **Redis hot path + async batch persist to Postgres** | Sub-ms fanout path; messages flushed to Postgres in batches (COPY/multi-row INSERT) every ~2 s by a worker. Durable enough for moderation evidence. **Chosen.** |
| C   | Redis only (ephemeral chat)                          | Cheapest, but loses moderation evidence and report deep-links. Violates §6. Rejected.                                                                           |
| D   | Dedicated store (Scylla/Cassandra)                   | Right at 100× our scale; operational overkill now. Rejected (revisit if chat outgrows Postgres).                                                                |

## Decision

**Option B.**

- The WS gateway publishes messages to a Redis Stream per live stream
  (`chat:{streamId}`); Socket.IO fanout uses the Redis adapter.
- Message ids are ULIDs minted by the gateway (time-sortable, no DB round-trip).
- A persistence worker consumes the streams and batch-inserts into `chat_messages`
  every ~2 s or 500 rows, whichever first. Crash recovery = resume from the Redis
  Stream consumer-group offset; Redis retention covers the persistence lag.
- `chat_messages` starts as a plain table (`@@index([streamId, sentAt])`). The
  day-partitioning DDL (pg_partman or native partitions) ships when volume demands —
  the ULID pk + append-only pattern makes the migration mechanical. Retention: 90 days,
  then partitions drop (except messages referenced by open reports, which are copied to
  an evidence table at report time).
- Moderation hides messages by setting `hiddenAt`/`hiddenReason` (soft-hide; the row
  remains as evidence).

## Consequences

- Chat history in Postgres lags realtime by up to a few seconds — acceptable; live
  viewers read from the WS stream, not the DB.
- Redis becomes stateful-ish (streams pending persistence); Redis persistence (AOF)
  is already enabled in infra/docker-compose.yml and must be enabled in managed Redis.
- The persistence worker is the first consumer of a job/queue pattern — reused later
  by webhooks retry and notification fanout.
