# AGENTS.md — SLAra Project Instructions

> Project-specific rules for AI agents (OpenCode / Claude Code / Antigravity).
> File ini WAJIB di-commit ke Git dan di-update ketika ada perubahan arsitektur/konvensi.

## Project Overview

**SLAra** adalah microservices-based logistics & AI orchestration platform dengan 3 service + dashboard:
- **Gateway** (Nginx) — reverse proxy, WebSocket, routing
- **Agent** (Hono + LangGraph) — AI orchestration, RAG, tool calling, MCP
- **Data** (Go) — business logic, shipment/driver/vehicle/route, gRPC + REST
- **AI** (FastAPI + uv) — ML models (ETA, delay, carbon, hub risk, NSGA-II route opt)
- **Infra** (Kafka KRaft, MongoDB, Neo4j, Redis, Qdrant)

## Architecture Map

```
React Dashboard (apps/app) → Nginx Gateway → {Agent (3000), Data (8081), AI (8000)}
                                          ↘ Kafka event bus → {Mongo, Neo4j, Redis, Qdrant}
```

Detailed flow: `docs/architecture/diagrams/`

## Repo Structure

```
SLAra/
├── apps/app/              # React + TS + Mapbox dashboard
├── services/
│   ├── gateway/           # Nginx config
│   ├── agent/             # Hono + LangGraph
│   ├── data/              # Go (core business logic)
│   └── ai/                # FastAPI + ML
├── infra/                # docker-compose, kafka, monitoring, environments
├── shared/               # protobuf, events, contracts, utils (di-share via path)
├── docs/                 # architecture/, specifications/, contracts/, progress/, api/ (docs + Bruno collection)
├── graphify-out/         # generated codebase graph/context — baca ini dulu (lihat section di bawah)
└── .github/workflows/    # CI/CD
```

Monorepo pakai **pnpm workspaces** (`pnpm-workspace.yaml`).
Service Go & Python di-handle terpisah (mereka punya toolchain sendiri).

## Codebase Understanding — WAJIB baca `graphify-out/` dulu

Sebelum ngerjain task apapun yang butuh paham codebase secara nyata (bukan cuma nebak dari nama folder/file), agent **WAJIB** cek `graphify-out/` dulu. Folder ini isinya hasil generate graph/context dari codebase asli (dependency graph, module map, call graph antar service, dll) — jadi ini source of truth yang lebih akurat dan lebih murah (token-wise) dibanding harus `grep`/`read` satu-satu file di `services/*`.

Urutan yang benar sebelum mulai kerja:

1. `ls graphify-out/` — cek struktur & format output yang tersedia (bisa berupa `.md`, `.json`, `.dot`, atau per-service breakdown).
2. Baca file yang relevan dengan scope task (misal kalau task nyentuh `services/agent`, cari file graphify yang cover module/dependency si Agent).
3. Baru setelah itu buka source file asli di `services/` untuk detail implementasi yang nggak ke-cover di graph (business logic detail, edge case, dll).
4. Kalau `graphify-out/` kelihatan stale (nggak match sama struktur folder terbaru) atau nggak ke-cover topiknya, boleh fallback ke exploring manual — tapi flag ke user bahwa graphify-out perlu di-regenerate.

**Jangan** skip langkah ini terus langsung nebak arsitektur dari `AGENTS.md` doang — dokumen ini kasih konvensi & rule, bukan peta detail codebase real.

## Build & Run Commands

### Inisialisasi penuh (semua services + infra)
```bash
# Dari folder infra/
cd infra
docker compose watch
```

### Tambah dependency per service (JANGAN di host, lakuin di container)

```bash
# Agent (Hono / Node)
cd infra && docker compose exec agent pnpm add <pkg>

# Data (Go)
cd infra && docker compose exec data go get <pkg>

# AI (Python / uv)
cd infra && docker compose exec ai uv add <pkg>
```
> Reason: container pakai Linux musl/glibc, host lo kemungkinan beda. Install di container → `lock file` di-sync balik ke host → `docker compose watch` rebuild otomatis.

### Per-service dev (kalau lo lagi kerja di 1 service aja)
```bash
# Agent
cd services/agent && pnpm dev

# Data (perlu Air)
cd services/data && air

# AI
cd services/ai && uv run uvicorn main:app --reload
```

### Lint / Test / Type-check
```bash
# Agent
cd services/agent && pnpm lint && pnpm test && pnpm tsc --noEmit

# Data
cd services/data && go test ./... && go vet ./...

# AI
cd services/ai && uv run pytest && uv run ruff check .
```

## Konvensi Kode

### Umum
- **Spec-first**: Sebelum ngerjain fitur besar, tulis spec di `docs/specifications/<service>/` dulu.
- **Contract-first**: API/event/gRPC contract ada di `shared/` + `docs/contracts/`. Breaking change wajib ADR (`docs/architecture/adr/`).
- **Tracking**: Update progress di `docs/progress/<service>/tracker.md` setiap status berubah.
- **Context-first**: Sebelum eksplorasi manual, cek `graphify-out/` dulu (lihat section "Codebase Understanding" di atas).

### Per Service

#### Agent (TypeScript / Hono)
- Node 22, pnpm 9
- ESM module, `"type": "module"` di package.json
- Path alias: `@/` → `./src/`
- Jangan pakai `any`, biasakan `unknown` + type guard
- Tools MCP diisolasi di `src/adapters/mcp/tools/`
- Streaming pakai Hono `streamSSE` (udah di-support Nginx gateway)

#### Data (Go)
- Go 1.24, framework: Gin + go-kit style (tergantung module)
- Folder standard `cmd/`, `internal/`, `pkg/`
- MongoDB driver: official `go.mongodb.org/mongo-driver`
- Neo4j: `github.com/neo4j/neo4j-go-driver/v5`
- Redis: `github.com/redis/go-redis/v9`
- Kafka: `github.com/segmentio/kafka-go`
- gRPC: `google.golang.org/grpc`
- Logging: `slog` (stdlib) + structured JSON
- Hot-reload: [Air](https://github.com/air-verse/air) + `.air.toml`

#### AI (Python / FastAPI)
- Python 3.12, package manager: `uv` (WAJIB, bukan pip/poetry)
- Folder: `app/` (FastAPI), `core/`, `api/`, `modules/`, `ml/`, `integrations/`, `utils/`
- Type hints WAJIB (pydantic v2 + mypy strict)
- ML: scikit-learn / XGBoost / LightGBM
- Optim: `pymoo` (NSGA-II) atau `deap`
- Hot-reload: `uvicorn --reload`

### Kafka Events

Topic naming: dot.case lowercase (`shipment.created`, `delay.predicted`).
Schema di-define di `shared/events/*.json` (JSON Schema) untuk Python/TS,
dan di-generate ke Go struct via `gen.go`.

WAJIB ada field `event_id`, `event_type`, `event_version`, `occurred_at`, `payload`.

## Testing Strategy

| Layer | Tool | Lokasi |
|---|---|---|
| Unit | Per service stdlib | `**/*_test.go`, `**/*.test.ts`, `**/test_*.py` |
| Integration | testcontainers-go / testcontainers-python | `**/integration/` |
| E2E | Playwright (di apps/app) | `apps/app/e2e/` |
| Contract | Pact (REST) / Schema Registry check (Kafka) | `contracts/` |
| Manual/Exploratory API | Bruno collection | `docs/api/bruno/` |

Coverage minimum: 70% untuk core domain logic.

Bruno itu buat testing manual/exploratory & sanity check sebelum merge — **bukan pengganti** unit/integration/contract test di atas. Endpoint baru/berubah di `contracts/rest/` wajib disertai request Bruno yang sesuai di PR yang sama (lihat `docs/api/Readme.md` section 6 untuk struktur & konvensi lengkap).

## Environment Variables

Semua env var disimpan di `infra/environments/*.env`, **JANGAN PERNAH** commit file `.env` sungguhan.
Template `.env.example` WAJIB di-commit dan di-update setiap kali ada env baru.

Daftar service-level secret:
- `AGENT.env`: OPENAI_API_KEY / GEMINI_API_KEY, QDRANT_URL, REDIS_URL, KAFKA_BROKER
- `DATA.env`: MONGO_URI, NEO4J_*, REDIS_URL, KAFKA_BROKER, JWT_SECRET
- `AI.env`: KAFKA_BROKER, MODEL_REGISTRY_URL, REDIS_URL

## Common Gotchas

1. **Alpine vs host**: Pakai `docker compose exec` buat install dep — host lo beda libc.
2. **Kafka advertised listener**: Selalu `kafka:9092` (bukan `localhost`). Ini udah di-set di compose.
3. **Nginx WebSocket**: Default `nginx.conf` udah support WS (HTTP/1.1 + Upgrade). Jangan lupa flush cache Nginx kalau ubah config.
4. **Air tmp/ folder**: Wajib di-ignore di `.gitignore` (sudah).
5. **Qdrant snapshot**: Backup pakai `qdrant-cli` atau `curl :6333/snapshots`, jangan commit vector db ke git.
6. **Neo4j constraints**: Schema/constraint ada di `services/data/migrations/neo4j/` — run saat bootstrap.
7. **Mapbox token**: Disimpan di `apps/app/.env.local` (di-ignore). Buat free-tier token dulu sebelum run dashboard.
8. **graphify-out stale**: Kalau folder ini nggak pernah di-regenerate setelah refactor besar, isinya bisa nyesatin. Selalu cross-check timestamp/commit terakhir generate-nya sebelum full percaya.
9. **Bruno environment secrets**: File di `docs/api/bruno/environments/*.bru` cuma boleh isi base URL & nama variable, **JANGAN PERNAH** commit token/API key/secret asli di sana — pakai runtime variable yang di-load dari `.env` lokal.

## Reference (kalau butuh bacaan tambahan)

- `graphify-out/` — generated codebase graph/context, baca ini PERTAMA sebelum eksplorasi manual
- `docs/architecture/` — ADR, diagrams
- `docs/specifications/` — per-fitur spec
- `docs/contracts/` — REST/events API contract
- `docs/api/bruno/` — Bruno collection untuk testing API manual/exploratory
- `docs/progress/` — sprint & feature tracker
- `docs/runbooks/` — incident SOP
- `shared/protobuf/` — gRPC contract source of truth

## Task Routing (untuk agent)

- **Sebelum apapun**: cek `graphify-out/` dulu untuk konteks codebase real.
- **Membangun service baru**: cek `specifications/` dulu; tulis spec kalau belum ada.
- **Modifikasi API**: update `contracts/rest/` + request Bruno terkait di `docs/api/bruno/<service>/` + `contracts/CHANGELOG.md` + ADR kalau breaking.
- **Nambah Kafka topic**: definisikan di `shared/events/` + tulis entri di `docs/contracts/events/`.
- **Update ML model**: catat di `docs/progress/ml/model-registry.md` + simpan metrics.

## AI Agents Capability (untuk agent yg kerja di repo ini)

- Boleh generate code boilerplate per spec
- Boleh update progress tracker (status label)
- Boleh generate ADR dari keputusan teknis
- Boleh propose contract changes (tapi PR harus di-review)
- **Tidak boleh** merge langsung ke `main` — semua via PR review

---

**Last updated**: 2026-07-08
**Maintainer**: SLAra tech lead