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
- **The mount is mandatory, not an optimization.** M1 and M4 are **fail-fast**: without
  `models/m1/*.txt` the container raises at startup and dies. Layout expected on the host:
  ```
  services/ai/models/m1/{m1_eta_v2_p50,m1_eta_v2_p90}.txt   # fail-fast
  services/ai/models/m2/{m2_dwell_p50,m2_dwell_p90}.txt     # optional -> DEGRADED if absent
  ```
- `configs/` and `data/` are **baked into the image** (not in `.dockerignore`) — only `models/` is mounted.
- **`MODEL_DIR` is vestigial.** The loader (`app/core/artifacts.py`) resolves paths relative to the
  service root (`/app` in-container), not from `MODEL_DIR`. The env var still happens to point at the
  same place, so nothing breaks — but changing it changes nothing either. There is no `Models` dict to
  register anything in (`app/config/init_model.py` was removed with the scaffold); artifacts are
  discovered by path.
- M2 is **degraded-tolerant**: missing `models/m2/` → serves historical median with `m2_degraded: true`
  instead of failing. Confirm which mode you got via `/health` → `models.m2.mode` (`FULL` | `DEGRADED`).

Data persistence: named volumes `mongo_data`, `neo4j_data`, `redis_data`, `qdrant_data`, `kafka_data` survive `down` (removed only with `down -v`).

## Health check

Each running stack: AI health at `GET /api/ai/health` (via gateway) or `GET http://localhost:8000/health` (direct):
```bash
curl http://localhost:8000/health
```
```json
{ "status": "ok",
  "models": {
    "m1": { "loaded": true, "version": "2.1.0-dual-quantile-conformal", "thresholds": {...} },
    "m2": { "loaded": true, "mode": "FULL" },
    "m3": { "loaded": true, "type": "rule-based" },
    "m4": { "loaded": true, "scenarios": ["jabodetabek_urban_sameday"] },
    "m5": { "loaded": true, "additivity_ok": true, "explains": "m1_eta_v2_p90" } } }
```

What to look for:

| Field | Expected | If not |
|---|---|---|
| `m2.mode` | `FULL` | `DEGRADED` = M2 artifacts unreadable (mount/name wrong). Service still answers — it won't error. |
| `m5.additivity_ok` | `true` | SHAP attribution is wrong; startup should have already failed. |
| `m1.loaded` / `m4.loaded` | `true` | Container should be dead already (fail-fast) — if you see `false`, something is very wrong. |

**The ai container takes ~25–37s to become healthy** (SHAP TreeExplainer init on a 2000-tree model).
That's why its `start_period` is 45s. Not a hang.

> **Healthcheck gotcha (same class as the qdrant `wget` bug):** the ai image is `python:3.12-slim`,
> which ships **neither `wget` nor `curl`**. Its healthcheck therefore uses `python3` + `urllib`
> (stdlib). Don't "simplify" it back to `wget` — the check would fail forever, `ai` would never turn
> healthy, and `gateway` (which `depends_on` ai `service_healthy`) would never start. Verify base-image
> tooling before writing any healthcheck: alpine images (agent/data/app/gateway/redis) have busybox
> `wget`; Debian `-slim` images generally do not.

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
