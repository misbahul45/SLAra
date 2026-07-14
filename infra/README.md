# SLAra — Infra (Docker)

Compose layering:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base: services, networks, volumes, infra (mongo/neo4j/redis/qdrant/kafka), env, healthchecks. No build. |
| `docker-compose.dev.yml` | Dev override: `Dockerfile.dev`, host ports, `develop.watch` hot reload. |
| `docker-compose.prod.yml` | Prod override: `Dockerfile` (multi-stage), `restart: unless-stopped`. |

Base file alone does not build app services — always combine with dev or prod.

## Config

1. Copy env at repo root:
   ```bash
   cp .env.example .env
   ```
2. Every service reads `../.env` via `env_file`. Edit values there (DB URIs, ports, Neo4j auth, Kafka brokers).

Key ports (host):

| Service | Port | URL |
|---------|------|-----|
| gateway (nginx) | 80 | http://localhost |
| agent (Hono) | 3000 | via `/api/agent/` |
| data (Go) | 8081 | via `/api/data/` |
| ai (FastAPI) | 8000 | via `/api/ai/` |
| app (Vite) | 5173 | http://localhost:5173 (dev HMR) |
| mongodb | 27017 | |
| neo4j | 7474 / 7687 | http://localhost:7474 |
| redis | 6379 | |
| qdrant | 6333 | |
| kafka | 9092 | |

Gateway routes: `/api/agent/`, `/api/data/`, `/api/ai/`, `/` → app.

## Run

Run from `infra/`.

**Dev** (hot reload):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch
```

**Prod**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

**Stop** / **wipe volumes**:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v   # also deletes DB/model data
```

Logs / rebuild one service:
```bash
docker compose ... logs -f ai
docker compose ... up --build ai
```

## AI Models (cached, not baked into image)

Models live in `../services/ai/models/` on the host and are **bind-mounted** into the AI container at `/app/models` (read-only).

- `models/` is in `services/ai/.dockerignore` → not copied into the image. Small image, no rebuild when models change.
- Add a new model = drop file in `services/ai/models/`, then restart the ai container (no rebuild):
  ```bash
  docker compose ... restart ai
  ```
- Loader reads `MODEL_DIR` (set to `/app/models` in compose); falls back to `app/../models` locally.
- Register the file in `services/ai/app/config/init_model.py` (`Models` dict).

Data persistence: named volumes `mongo_data`, `neo4j_data`, `redis_data`, `qdrant_data`, `kafka_data` survive `down` (removed only with `down -v`).

## Health check

Each running stack: AI health at `GET /api/ai/health` (via gateway) or `GET http://localhost:8000/health` (direct):
```bash
curl http://localhost:8000/health
# {"status":"ok","service":"ai","models_loaded":["m1"],"models_total":5}
```
`models_loaded` lists model keys with a loaded booster — use it to confirm the model mount worked.

### Health Check Script

`infra/check-health.sh` memeriksa semua endpoint sekaligus (langsung + via gateway) plus status
container Docker, dengan color output, timing per-request, dan summary pass/fail. Exit code non-zero
kalau ada yang fail (aman untuk CI / pre-merge gate).

```bash
bash infra/check-health.sh                 # semua checks (direct + gateway + docker)
bash infra/check-health.sh --direct-only   # HTTP endpoint langsung (tanpa gateway)
bash infra/check-health.sh --gateway-only  # HTTP endpoint via gateway (:80/api/*)
bash infra/check-health.sh --docker-only   # status health container Docker saja
```

## VS Code Dev Containers

`.devcontainer/devcontainer.json` in root + each service. Open in VS Code → **Reopen in Container**.

| Open folder | Container | Deps installed on create |
|-------------|-----------|--------------------------|
| repo root | full stack (docker-in-docker) | `.env` from `.env.example` |
| `services/ai` | `ai` (FastAPI/uv) | `uv sync` |
| `services/agent` | `agent` (Hono/pnpm) | `pnpm install` |
| `services/data` | `data` (Go/air) | `go mod download` |
| `apps/app` | `app` (Vite/pnpm) | `pnpm install` |

- Per-service containers attach to the compose service (base + dev), bind-mount source at `/app`, and bring up the DB/broker dependencies automatically.
- Install a new library from the container terminal (`uv add ...`, `pnpm add ...`, `go get ...`) — it writes straight to the mounted source.
- Language extensions (Python/Ruff, ESLint/Prettier, Go, Tailwind, Docker) auto-install per container.
