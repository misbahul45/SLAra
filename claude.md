# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Conventions live in [AGENTS.md](AGENTS.md)** — the team-maintained rulebook (spec-first / contract-first workflow, per-service coding standards, Kafka event schema, env-var policy, task routing). Read it for *how the team wants things done*. This file covers *what actually exists today* and how to run it, so you don't trust the aspirational parts of AGENTS.md blindly.

## ⚠️ Reality vs. target architecture

AGENTS.md describes the **intended** end state. The repo is currently an early scaffold — a large share of what AGENTS.md documents does **not exist yet**. Verify before relying on it:

| AGENTS.md claims | Actual state |
|---|---|
| pnpm workspaces monorepo | No root `pnpm-workspace.yaml` / root `package.json`. Each JS service (`services/agent`, `apps/app`) has its own `pnpm-lock.yaml` and is installed independently. |
| `cd infra && docker compose watch` boots everything | **Superseded.** Compose is now split base + override. Dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml watch`. Prod: `... -f docker-compose.prod.yml up -d --build`. Each service has `Dockerfile` (prod) + `Dockerfile.dev`. Env lives in a single root `.env` (`env_file: ../.env`); `infra/environments/` no longer exists. |
| Agent = Hono + LangGraph + RAG + MCP tools | `services/agent/src/index.ts` is a single-file Hono "Hello Hono!" on port 3000. No LangGraph/MCP/`src/adapters` yet. |
| AI = FastAPI + ML models | `services/ai/main.py` is a `print("Hello from ml!")` stub. No FastAPI app, no `app/`/`ml/` folders. |
| `shared/`, `docs/architecture`, `docs/specifications`, `docs/contracts`, `docs/progress`, `docs/api/bruno` | None exist. The only real docs are in `docs/models/` (see below). |
| Data exposes gRPC | Go service is REST-only (Gin). No protobuf/gRPC in the tree. |

When AGENTS.md and the filesystem disagree, **the filesystem wins** — and flag the drift to the user.

## What actually exists

```
SLAra/
├── apps/app/                 # React Router v8 (framework mode) starter — React 19, Tailwind v4, Vite 8
├── services/
│   ├── agent/                # Hono (Node 22 + tsx). Single src/index.ts. Port 3000
│   ├── data/                 # Go 1.25 + Gin. cmd/api/main.go + internal/database/entities. Port 8081
│   ├── ai/                   # Python + uv. main.py stub. Port 8000
│   └── gateway/              # nginx.conf only
├── infra/docker-compose.yml  # gateway + 3 services + mongo/neo4j/redis/qdrant/kafka (KRaft). Not runnable yet — see table above
├── docs/models/              # THE real content: ML model specs M1–M6 + INTERACTION_MAP + plan
└── graphify-out/             # generated codebase graph (graph.json, GRAPH_REPORT.md, manifest.json)
```

The most substantive code today is the **Go `data` service's domain entities** (`services/data/internal/database/entities/`: driver, geo, hub, route, shipment, traffic, vehicle, weather) and the **ML design docs** in `docs/models/`.

## Run commands (per service — verified against package.json / pyproject / go.mod)

```bash
# Agent (Hono) — services/agent
pnpm install && pnpm dev        # tsx watch src/index.ts → http://localhost:3000
pnpm build                      # tsc → dist/  (no lint/test scripts defined yet)

# Data (Go) — services/data
go run ./cmd/api                # http://localhost:8081
go test ./...                   # (no _test.go files present yet)
go build ./...

# AI (Python) — services/ai
uv run python main.py           # currently just prints a stub message
uv sync                         # install deps from uv.lock

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
