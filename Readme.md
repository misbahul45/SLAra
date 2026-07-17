# SLAra

SLAra is a logistics AI-orchestration platform. A React dashboard fronts an **Agent** service (Hono) that runs a deterministic decision core (codename **M6**) fanning out to an **AI** service (FastAPI) serving five machine-learning models (ETA, hub dwell, carbon, precomputed route optimization, and SHAP explainability). A Go **Data** service and an Nginx **Gateway** round out the runtime; the supporting data stores (MongoDB, Neo4j, Redis, Qdrant, Kafka) are provisioned in `infra/` but are **not** part of the demo decision path (see ADR-003).

> This README describes the **code that actually exists today**. The repository is mid-build: the `ai` service and the `agent` M6 core are real and serving; the `data` service is currently a Gin scaffold exposing only `/health`; and the downstream data stores are declared in Compose but not yet wired into the live flow. For the full convention/policy guide, see [`AGENTS.md`](./AGENTS.md) and the current-state notes in [`claude.md`](./claude.md).

## Demo

[![Demo Video](https://img.youtube.com/vi/ctc_AI-mbu0/0.jpg)](https://www.youtube.com/watch?v=ctc_AI-mbu0)

## Tech Stack

| Service | Language | Framework / Runtime | Entry point | Real responsibility (verified) |
|---|---|---|---|---|
| **apps/app** | TypeScript | React Router v8 (framework mode), React 19, Tailwind v4, Vite 8, MapLibre GL | `react-router dev` / `build` (`apps/app/package.json`) | Dashboard UI; consumes `/api/v1` (agent) and `/internal/m4/routes` (ai) |
| **services/agent** | TypeScript (Node 22) | Hono + `tsx`, `@hono/node-server` | `src/index.ts` (port 3000) | M6 deterministic orchestration core; owns 4 FE-facing endpoints; calls ai service |
| **services/ai** | Python 3.12 | FastAPI + Uvicorn, LightGBM, SHAP | `app/main.py` (port 8000) | Serves models M1–M5 via `/internal/*` |
| **services/data** | Go 1.25 | Gin (`gin-gonic/gin`) | `cmd/api/main.go` (port 8081) | Scaffold: `/health` only; domain entities defined in `internal/database/entities` |
| **services/gateway** | — | Nginx (`nginx:alpine`) | `services/gateway/nginx.conf` | Reverse proxy: `/api/v1` → agent, `/internal` → ai, `/` → app |
| **infra** | — | Docker Compose (base + dev + prod overrides) | `infra/docker-compose*.yml` | Orchestrates the 4 services + mongo/neo4j/redis/qdrant/kafka |

Supporting infrastructure declared in `infra/docker-compose.yml` (not in the live demo path): MongoDB `mongo:latest`, Neo4j `neo4j:latest`, Redis `redis:alpine`, Qdrant `qdrant/qdrant:latest`, and Kafka (KRaft, `apache/kafka:latest`, advertised listener `kafka:9092`).

## Arsitektur & Flow

```mermaid
flowchart TD
    FE["React Dashboard (apps/app :5173)"]
    GW["Nginx Gateway (:80)"]
    AG["Agent M6 (Hono :3000)"]
    AI["AI Service (FastAPI :8000)"]

    FE -->|"/api/v1/*"| GW
    GW -->|proxy_pass| AG
    FE -.->|dev: Vite proxy /api/v1| AG
    FE -->|"/internal/m4/routes"| GW
    GW -->|proxy_pass| AI
    FE -.->|dev: Vite proxy /internal| AI

    AG -->|POST /internal/m2/dwell| AI
    AG -->|POST /internal/m1/eta| AI
    AG -->|POST /internal/m3/carbon| AI
    AG -->|GET  /internal/m4/routes| AI
    AG -->|POST /internal/m5/explain (non-SAFE only)| AI

    subgraph M6 pipeline ["agent decide.ts — one shipment"]
      N2["M2 dwell"] --> N1["M1 ETA (inject dwell)"]
      N1 --> N3["M3 carbon"]
      N3 --> N4["M4 routes"]
      N4 --> N5{"risk_tier != SAFE?"}
      N5 -->|yes| N6["M5 SHAP explain"]
      N5 -->|no| N7["confidence aggregate"]
      N6 --> N7
      N7 --> N8{"confidence >= 0.70?"}
      N8 -->|yes| A1["AUTO_EXECUTE"]
      N8 -->|no| A2["ESCALATE"]
    end

    AG --- M6 pipeline
```

The Agent (`services/agent/src/orchestration/decide.ts`) is the decision core. For each shipment it runs a fixed node pipeline: **M2** (hub dwell) → **M1** (ETA, with the M2 dwell injected as a feature) → **M3** (carbon) → **M4** (route candidates) → conditional **M5** (SHAP explanation, only when the tier is non-SAFE) → confidence aggregation → branch into `AUTO_EXECUTE` (`confidence >= 0.70`) or `ESCALATE`. Failure cascade (verified in `decide.ts`): M1/M4 down forces `ESCALATE`; M2 down falls back to baked dwell with reduced confidence; M3/M5 down are non-fatal.

Each model call hits the AI service over HTTP (`services/agent/src/clients/ai.ts`):
- `POST /internal/m1/eta` — ETA dual-quantile (LightGBM), risk tier + `conf_m1`
- `POST /internal/m2/dwell` — hub dwell dual-quantile; **degraded-tolerant** (serves historical median if artifacts missing)
- `POST /internal/m3/carbon` — rule-based GLEC/ISO 14083 emission factor
- `GET  /internal/m4/routes?scenario=…` — **precomputed** Pareto route set (`data/pareto_routes_jabodetabek_urban.json`); unknown scenario → 404
- `POST /internal/m5/explain` — SHAP `TreeExplainer` on the M1 P90 booster (`app/ml/m5.py`)

Models M1 and M4 are **fail-fast** at AI startup (`app/core/artifacts.py`); M2 is degraded-tolerant; M5 additivity is checked at startup and reported in `/health`. The AI `models/` directory is mounted read-only into the container (excluded from the image by `.dockerignore`).

## Struktur Folder

```text
SLAra/
├── apps/app/                  # React Router v8 dashboard (React 19, Tailwind v4, Vite 8, MapLibre)
│   └── app/{routes,lib,components,mocks}/
├── services/
│   ├── agent/                 # Hono M6 orchestration core (TS, Node 22)
│   │   ├── src/{index,config,state}.ts
│   │   ├── src/orchestration/decide.ts
│   │   ├── src/domain/confidence.ts
│   │   ├── src/clients/ai.ts
│   │   ├── src/routes/shipments.ts
│   │   └── data/{shipments,shipment_routes}.json
│   ├── data/                  # Go + Gin scaffold (port 8081)
│   │   ├── cmd/api/main.go
│   │   └── internal/database/entities/{shipment,driver,hub,route,vehicle,geo,traffic,weather}.go
│   ├── ai/                    # FastAPI ML service (Python 3.12, uv)
│   │   ├── app/{main,schemas}.py, app/api/internal.py, app/core/artifacts.py
│   │   ├── app/ml/{m1,m2,m3,m5}.py
│   │   ├── models/{m1,m2}/    # LightGBM boosters (mounted volume, gitignored)
│   │   ├── configs/{m1,m2}/   # thresholds, target encoding, coverage
│   │   ├── data/              # pareto_routes_*.json (M4), hub_telemetry.json
│   │   ├── experiments/        # m4_nsga2*.py — evidence only, NOT runtime
│   │   └── tests/             # golden M1 + M5 additivity
│   └── gateway/               # nginx.conf (+ nginx.dev.conf)
├── infra/
│   ├── docker-compose.yml      # base: 4 services + mongo/neo4j/redis/qdrant/kafka
│   ├── docker-compose.dev.yml  # dev overrides (Dockerfile.dev, hot-reload watch)
│   └── docker-compose.prod.yml # prod overrides (restart policy)
├── docs/                       # architecture/adr, specifications, contracts, progress, api/bruno, models
├── graphify-out/               # generated codebase graph (read before manual exploration)
├── AGENTS.md                   # team convention/policy guide
├── claude.md                   # current-state notes + verified run commands
├── .env.example                # root env template (safe to commit)
└── Readme.md                   # this file
```

## Instalasi & Setup

All services read a single root `.env` via `env_file: ../.env` in Compose. Copy the template first:

```bash
cp .env.example .env
```

### Run everything via Docker (recommended)

```bash
# Development (auto-reload watch):
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml watch

# Production:
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

In dev, the dashboard is at `http://localhost:5173`, the agent API at `http://localhost:3000/api/v1`, and the ai service at `http://localhost:8000`. In prod all traffic goes through the gateway at `http://localhost`.

### Run a single service on the host

Per-service installs are independent (no root `pnpm-workspace.yaml` exists):

```bash
# Agent (Hono) — services/agent
pnpm install && pnpm dev          # tsx watch src/index.ts → :3000
pnpm test                         # 6 unit tests (confidence + cascade)

# Data (Go) — services/data
go run ./cmd/api                  # :8081

# AI (Python 3.12 only) — services/ai
uv sync                           # install from uv.lock
uv run uvicorn app.main:app --port 8000   # ~25–37s startup (SHAP init)
uv run pytest tests/ -q           # 4 passed (golden M1 + M5 additivity + health)

# Dashboard — apps/app
pnpm install && pnpm dev          # react-router dev → :5173
pnpm typecheck                   # react-router typegen && tsc
```

> The `data` and `ai` services must be reachable from the agent: the agent reads `AI_BASE_URL` (default `http://localhost:8000`). The AI `models/` directory is mounted as a volume, so drop LightGBM booster files into `services/ai/models/{m1,m2}/` — no image rebuild needed. `numpy` is pinned `<2.5` on purpose (SHAP/numba constraint).

## Environment Variables

All variables live in the root `.env` (template: `.env.example`), consumed by every service via `env_file`. No secrets are committed.

| Variable | Used by | Description |
|---|---|---|
| `NODE_ENV` | agent, app | Runtime mode (`development` / `production`) |
| `GATEWAY_PORT` | gateway | Host port for Nginx (default `80`) |
| `AGENT_PORT` | agent | Host port for the agent API (default `3000`) |
| `DATA_PORT` | data | Host port for the Go API (default `8081`) |
| `AI_PORT` | ai | Host port for the AI service (default `8000`) |
| `APP_PORT` | app | Host port for the dashboard dev server (default `5173`) |
| `MONGO_URI` | data | MongoDB connection string (e.g. `mongodb://mongodb:27017`) |
| `MONGO_DB` | data | MongoDB database name |
| `NEO4J_AUTH` | data, neo4j | `user/password` for Neo4j |
| `NEO4J_URI` | data | Neo4j bolt URI (e.g. `bolt://neo4j:7687`) |
| `NEO4J_USER` | data | Neo4j username |
| `NEO4J_PASSWORD` | data | Neo4j password |
| `REDIS_URL` | agent, data, ai | Redis connection URL (e.g. `redis://redis:6379`) |
| `QDRANT_URL` | agent | Qdrant URL (e.g. `http://qdrant:6333`) |
| `KAFKA_BROKERS` | agent, data, ai | Kafka bootstrap brokers (e.g. `kafka:9092`) |
| `VITE_API_BASE_URL` | app | Gateway base URL the dashboard calls (e.g. `http://localhost/api`) |

Runtime-specific vars (not in `.env.example`): the agent honors `AI_BASE_URL` and `PORT`; the ai container sets `MODEL_DIR=/app/models`.

## Dokumentasi

| Need | Where |
|---|---|
| Team conventions & AI-agent policy | [`AGENTS.md`](./AGENTS.md) |
| Current-state reality + verified run commands | [`claude.md`](./claude.md) |
| ADRs, specs, API contracts, progress trackers | [`docs/`](./docs) (see `docs/Readme.md` for navigation) |
| Manual/exploratory API tests (Bruno) | [`docs/api/bruno/`](./docs/api/bruno) |
| Generated codebase graph | [`graphify-out/`](./graphify-out) |

## Lisensi

No `LICENSE` file is present in this repository.
