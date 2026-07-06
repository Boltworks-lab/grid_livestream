# Load tests (k6)

Phase 10 exit criteria (PROJECT_BRIEF §10): **5k concurrent viewers/stream, 500 msg/s
chat**. These [k6](https://k6.io) scripts drive the running API + Postgres + Redis.

## Run

```sh
# 1. infra + API up, gift catalog seeded
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @grid/api build && pnpm --filter @grid/api start &
pnpm --filter @grid/api db:seed

# 2. install k6 (https://k6.io/docs/get-started/installation), then:
k6 run load/gifting-burst.js        # HTTP: top-up → gift storm, checks 200s + latency
k6 run load/chat-fanout.js          # WebSocket: N viewers, sustained chat throughput
API_URL=https://staging.grid... k6 run load/chat-fanout.js   # against staging
```

## Scripts

| Script             | Exercises                                           | Key thresholds                      |
| ------------------ | --------------------------------------------------- | ----------------------------------- |
| `gifting-burst.js` | HTTP gift sends under concurrency (ledger hot path) | p95 < 800ms, <1% errors             |
| `chat-fanout.js`   | Socket.IO join + `chat:send` fanout                 | msg rate ≥ 500/s, p95 delivery < 1s |

Ramp `VUS`/`RATE` env vars up toward the targets on real infra (a laptop won't hit 5k
sockets — run the full target against staging, brief §12). The ledger's per-account
`FOR UPDATE` locking is the main thing to watch under gifting bursts; correctness there
is already proven by the Testcontainers + fast-check suite — these tests watch latency
and error rate under sustained load.
