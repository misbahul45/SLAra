# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Conventions live in [AGENTS.md](AGENTS.md)** — the team-maintained rulebook (spec-first / contract-first workflow, per-service coding standards, Kafka event schema, env-var policy, task routing). Read it for *how the team wants things done*. This file covers *what actually exists today* and how to run it, so you don't trust the aspirational parts of AGENTS.md blindly.

## ⚠️ Reality vs. target architecture

AGENTS.md describes the **intended** end state. The repo is **no longer** a pure scaffold — the `ai` service is real as of 15 Jul 2026 — but much of AGENTS.md still doesn't exist. Verify before relying on it:

| AGENTS.md claims | Actual state |
|---|---|
| pnpm workspaces monorepo | No root `pnpm-workspace.yaml` / root `package.json`. Each JS service (`services/agent`, `apps/app`) has its own `pnpm-lock.yaml` and is installed independently. |
| `cd infra && docker compose watch` boots everything | **Superseded.** Compose is now split base + override. Dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml watch`. Prod: `... -f docker-compose.prod.yml up -d --build`. Each service has `Dockerfile` (prod) + `Dockerfile.dev`. Env lives in a single root `.env` (`env_file: ../.env`); `infra/environments/` no longer exists. |
| Agent = Hono + LangGraph + RAG + MCP tools | ✅ **M6 live (Phase 3, 16 Jul 2026).** `services/agent` sekarang M6 deterministic orchestration core (Hono + TS): `src/orchestration/decide.ts` (6 node M2→M1→M3→M4→[M5]→confidence→branch), `src/domain/confidence.ts` (conf_m1 v2, [ADR-005](docs/architecture/adr/ADR-005-conf-m1-v2.md)), 4 endpoint §A. **Bukan** LangGraph — sengaja ditunda ([ADR-002](docs/architecture/adr/ADR-002-m6-deterministic-core.md)); tidak ada LLM di jalur keputusan. `npm test` 6 pass. Verifikasi E2E (17 Jul, setelah `distance_km` sinkron ke jarak jalan OSRM): SHP-00400 AUTO_EXECUTE 0.810 · SHP-00403 ESCALATE 0.646 · escalation 2/12=16.7%. `/decide` `routes[].geometry` = jalur jalan per-shipment (`data/shipment_routes.json`, precomputed). Spec: `docs/specifications/agent/m6-orchestration.md`. |
| AI = FastAPI + ML models | ✅ **Real & serving** (no longer the `Hello from ml!` stub). FastAPI on `app/main.py`, port 8000, models loaded once at startup (~25–37s — SHAP init, not a hang). See per-model rows below. |
| — M1 (ETA) | ✅ **v2 artifacts** at `services/ai/models/m1/` + `configs/m1/`. `POST /internal/m1/eta`. Golden-tested (4 passed). **Fail-fast** if artifacts missing. |
| — M2 (hub dwell) | ✅ **FULL mode** — artifacts at `services/ai/models/m2/` + `configs/m2/`. `POST /internal/m2/dwell`. **Degraded-tolerant**: without artifacts it silently serves historical median (`m2_degraded: true`) instead of failing. |
| — M4 (route opt) | ✅ **Precomputed** Pareto at `services/ai/data/pareto_routes_jabodetabek_urban.json`, served via **`GET`** `/internal/m4/routes?scenario=…` ([ADR-004](docs/architecture/adr/ADR-004-m4-precomputed.md)). NSGA-II engine kept as evidence at `services/ai/experiments/m4_nsga2.py` — **not a runtime path**. One scenario only; unknown scenario → 404. |
| — M3 / M5 | ✅ M3 rule-based carbon; M5 SHAP TreeExplainer on **M1 P90** (additivity checked at startup, fail-fast). |
| FE wiring | ◑ **Phase 4 sebagian live (16 Jul 2026).** Flow decide sudah live ke `agent`: **AI Recommendation** & **Human Approval** penuh live (`/decide`, `/resolve`), **Route Optimization** live ke ai `/internal/m4/routes`, **Dashboard/Execution** KPI live dari `/kpi/summary`. Sisanya (Live Fleet) masih fixture by design. **Number-sync selesai:** sumber tunggal `apps/app/app/data/model_stats.json`; semua angka Figma tanpa sumber dihapus (KPI tak terukur → "—"). Switch per-view di `apps/app/app/lib/data.ts`. Spec: `docs/specifications/app/dashboard.md`. |
| `shared/`, `docs/architecture`, `docs/specifications`, `docs/contracts`, `docs/progress`, `docs/api/bruno` | Partially real now: `docs/{architecture/adr,specifications/ai,contracts,progress,api/bruno}` exist (see below). **`shared/` still does not exist** — no Kafka event schemas. |
| Data exposes gRPC | Go service is REST-only (Gin). No protobuf/gRPC in the tree. **Out of the demo path entirely** ([ADR-003](docs/architecture/adr/ADR-003-demo-scope-exclusions.md)). |
| Kafka / Neo4j / Qdrant / Mongo event-driven platform | Declared in compose, **not used by the demo path** — deliberate, see [ADR-003](docs/architecture/adr/ADR-003-demo-scope-exclusions.md). Shipments are served from static JSON by `agent`. Don't narrate Kafka as live. |

When AGENTS.md and the filesystem disagree, **the filesystem wins** — and flag the drift to the user.

> **Known contract drift:** `docs/contracts/rest/v1.md` §B (written before the service existed) says
> `POST /internal/m4/routes` and `dwell_p50_min`. The implementation uses **GET** + query and
> `dwell_p50_minutes`. §B-bis in that file records the actual shape and is **normative for M6**.

## What actually exists

```
SLAra/
├── apps/app/                 # React Router v8 (framework mode) starter — React 19, Tailwind v4, Vite 8
├── services/
│   ├── agent/                # Hono (Node 22 + tsx). M6 orchestration core: src/{orchestration,domain,clients,routes}. Port 3000
│   ├── data/                 # Go 1.25 + Gin. cmd/api/main.go + internal/database/entities. Port 8081
│   ├── ai/                   # FastAPI + uv — REAL, serving M1–M5. Port 8000
│   │   ├── app/{main,schemas}.py, app/api/internal.py, app/core/artifacts.py, app/ml/{m1,m2,m3,m5}.py
│   │   ├── models/{m1,m2}/   # LightGBM boosters (NOTE: .dockerignore excludes models/ — mounted as volume)
│   │   ├── configs/{m1,m2}/  # thresholds, target encoding, historical median, coverage
│   │   ├── data/             # pareto_routes_*.json (M4), hub_telemetry.json (mock, 3 hubs × 2 conditions)
│   │   ├── experiments/      # m4_nsga2.py — evidence only, NOT runtime
│   │   └── tests/            # golden test M1 + M5 additivity
│   └── gateway/              # nginx.conf only
├── infra/docker-compose.yml  # gateway + 3 services + mongo/neo4j/redis/qdrant/kafka (KRaft)
├── docs/
│   ├── models/               # ML model specs M1–M6 + INTERACTION_MAP + evidence/M4_RESULTS.md
│   ├── architecture/adr/     # ADR-001..004 (demo transport, M6 core, scope exclusions, M4 precomputed)
│   ├── contracts/            # rest/v1.md (FROZEN) + CHANGELOG.md
│   ├── specifications/ai/    # serving.md, m4-route-optimization.md
│   ├── progress/             # ml/model-registry.md, ai/{tracker,integration-log}.md, plan/
│   └── api/bruno/ai/         # 7 Bruno requests covering every §B endpoint
└── graphify-out/             # generated codebase graph (graph.json, GRAPH_REPORT.md, manifest.json)
```

The most substantive code today is the **`ai` service** (`services/ai/app/`) plus the **Go `data` service's domain entities** (`services/data/internal/database/entities/`: driver, geo, hub, route, shipment, traffic, vehicle, weather) and the **ML design docs** in `docs/models/`.

**Start here:** [`docs/progress/ai/integration-log.md`](docs/progress/ai/integration-log.md) (what moved where + why the deviations) → [`docs/specifications/ai/serving.md`](docs/specifications/ai/serving.md) (how serving works) → [`docs/progress/ml/model-registry.md`](docs/progress/ml/model-registry.md) (real metrics).

## Run commands (per service — verified against package.json / pyproject / go.mod)

```bash
# Agent (Hono) — services/agent
pnpm install && pnpm dev        # tsx watch src/index.ts → http://localhost:3000
pnpm build                      # tsc → dist/  (no lint/test scripts defined yet)

# Data (Go) — services/data
go run ./cmd/api                # http://localhost:8081
go test ./...                   # (no _test.go files present yet)
go build ./...

# AI (Python) — services/ai   ← Python 3.12 ONLY (not 3.14: shap→numba/llvmlite)
uv sync                         # install deps from uv.lock
uv run pytest tests/ -q         # → 4 passed (3 golden M1 + health/M5 additivity)
uv run uvicorn app.main:app --port 8000   # wait ~25–37s for "Startup selesai" (SHAP init)
curl localhost:8000/health      # m2.mode MUST be FULL — DEGRADED = M2 artifacts unreadable

# Dashboard — apps/app
pnpm install && pnpm dev        # react-router dev
pnpm build                      # react-router build
pnpm typecheck                  # react-router typegen && tsc
```

> **Adding dependencies:** AGENTS.md mandates installing inside containers (`docker compose exec …`) because of Alpine/musl vs host libc. That only applies once compose is runnable. Until then, install per-service on the host (`pnpm add`, `go get`, `uv add`) in the relevant service directory.

## Intended runtime topology (target)

```
apps/app (React) → Nginx gateway → { agent :3000, data :8081, ai :8000 }
                                  ↘ Kafka (kafka:9092, KRaft) → { mongo, neo4j, redis, qdrant }
```

Ports and the Kafka advertised listener (`kafka:9092`, never `localhost`) are already set in `infra/docker-compose.yml` and are the contract to build toward.

## Before exploring the codebase — read `graphify-out/` first

Per AGENTS.md, `graphify-out/` holds a generated dependency/module graph and is the cheapest accurate map of the real code. Check `graphify-out/GRAPH_REPORT.md` / `graph.json` before grepping `services/*` by hand. `manifest.json` carries per-file mtimes — if they're far behind the current tree, treat the graph as stale and regenerate rather than trust it.

## Notes for working here

- **Bilingual docs.** AGENTS.md and most docs are written in Indonesian. Match the surrounding language when editing docs; code and identifiers stay English.
- **Two overlapping instruction files.** `AGENTS.md` and this `claude.md`/`CLAUDE.md` exist side by side (on Windows the latter two are the same file). Keep this file focused on *current reality + run commands*; push convention/policy changes into AGENTS.md so they don't drift apart again.
- **Don't merge to `main` directly** — everything goes through PR review (AGENTS.md rule).
- **`services/ai` is Python 3.12, and `numpy` is pinned `<2.5` on purpose.** Modern `numba` (needed by `shap`) requires `numpy<2.5`; without the bound, uv picks numpy 2.5.1, backtracks numba to 0.53.1 (2021, no 3.12 wheel) and the build fails with a misleading "only versions >=3.6,<3.10 are supported". Don't "fix" it by loosening numpy or downgrading shap — see [integration log §D3](docs/progress/ai/integration-log.md). macOS Intel contributors will still hit this (numba 0.66 dropped those wheels).
- **Honesty rules for the demo narrative** (all recorded as ADRs, don't overclaim):
  - Kafka/Neo4j/Qdrant/`data` service are **scaffolded, not live** in the demo path ([ADR-003](docs/architecture/adr/ADR-003-demo-scope-exclusions.md)).
  - M6 is a **deterministic core**, not LangGraph ([ADR-002](docs/architecture/adr/ADR-002-m6-deterministic-core.md)).
  - M4 routes are **precomputed** — they do **not** adapt to live traffic/weather/dwell ([ADR-004](docs/architecture/adr/ADR-004-m4-precomputed.md)). Since 16 Jul 2026 distances are **real OSRM road distances** (`experiments/m4_nsga2_osrm.py`), not haversine×1.3, and each candidate carries `road_geometry` (OSRM-snapped) for road-following map lines. M4's −48.2% SLA-risk comes from **one** scenario; the M4 design (§7.3) asks for three before generalizing.
  - M1's `hub_dwell_time_predicted` was **trained on a fallback generator, not M2 output** — the M2→M1 link is a *serving-time* contract.
