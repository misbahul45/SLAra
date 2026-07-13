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
- **Modifikasi API**: update `contracts/rest/` + request Bruno terkait di `docs/api/bruno/<service>/` + `contracts/CHANGELOG.md` + ADR kalau breaking.# SLAra AI — Model Interaction Map (M1–M6)

> **Dokumen ini:** visualisasi bagaimana 6 model saling berinteraksi di sistem SLAra.
> **Bukan:** spec teknis per-model (lihat file M1–M6 di folder `models/`).
> **Tujuan:** jadikan referensi tunggal untuk tim saat wiring/integrasi.

---

## 1. Architecture Overview — Semua Komponen Sekaligus

```mermaid
graph TB
    subgraph "External Data Sources"
        OSM[OpenStreetMap<br/>OSRM]
        BMKG[BMKG API<br/>Cuaca 3-harian]
        HERE[HERE Traffic Flow API<br/>/ Google Maps]
        HOLIDAY[Holiday Calendar<br/>Kemendagri]
    end

    subgraph "Data Pipeline Layer"
        FE[Feature Store<br/>Redis Cache]
        SIM[M/M/c Simulator<br/>Hub dwell synthetic]
        GEN[Shipment Generator<br/>Jabodetabek+intercity]
    end

    subgraph "Core Models"
        M1[M1 — ETA Prediction<br/>XGBoost Regressor<br/>P0]
        M2[M2 — Hub Congestion<br/>LightGBM Quantile P50/P90<br/>P1]
        M3[M3 — Carbon Estimator<br/>Rule-based Deterministic<br/>P0]
        M4[M4 — Route Optimization<br/>NSGA-II 3-objective<br/>P0]
        M5[M5 — SHAP Explainer<br/>TreeExplainer On-demand<br/>P2]
        M6[M6 — Multi-Agent Orchestration<br/>LangGraph + Confidence<br/>P1]
    end

    subgraph "Output Layer"
        DASH[Dashboard Operator<br/>Blibli Logistics]
        ESC[Human Escalation<br/>Review Queue]
        AUDIT[Audit Trail DB<br/>Time-series]
    end

    OSM --> FE
    BMKG --> FE
    HERE --> FE
    HOLIDAY --> FE
    SIM --> FE
    GEN --> FE

    FE --> M1
    FE --> M2
    FE --> M4

    M2 -->|dwell_p50 feature| M1
    M3 -->|carbon_cost objective| M4
    M1 -->|eta_pred + risk_tier| M4
    M1 -->|features WARNING/CRITICAL| M5
    M2 -.->|features optionally| M5

    M1 --> M6
    M2 --> M6
    M3 --> M6
    M4 --> M6
    M5 --> M6

    M6 -->|auto-execute conf>=0.70| DASH
    M6 -->|escalate conf<0.70| ESC
    M6 -->|audit_trail_id| AUDIT

    DASH -.->|operator review| ESC
    ESC -.->|feedback log| M6

    style M1 fill:#ff6b6b,color:#fff
    style M4 fill:#ff6b6b,color:#fff
    style M3 fill:#4ecdc4,color:#fff
    style M2 fill:#ffe66d,color:#333
    style M5 fill:#a8e6cf,color:#333
    style M6 fill:#c9b1ff,color:#333
```

**Legend warna:**
- 🔴 Merah (M1, M4) — P0, inti sistem, kritikal path
- 🟢 Hijau (M3) — P0 tapi rule-based, cepat selesai
- 🟡 Kuning (M2) — P1, upstream dari M1
- 🟢 Mint (M5) — P2, di atas M1
- 🟣 Ungu (M6) — P1, orkestrasi di atas semua

---

## 2. Data Flow Antar-Model — Apa yang Mengalir Kemana

```mermaid
graph LR
    subgraph "Upstream Features"
        F1[traffic_index<br/>from HERE]
        F2[weather_severity<br/>from BMKG]
        F3[distance_km<br/>from OSRM]
        F4[queue_length<br/>from hub sensor/sim]
    end

    subgraph "Models"
        M2[M2 Hub Congestion]
        M1[M1 ETA]
        M3[M3 Carbon]
        M4[M4 Route Opt]
        M5[M5 SHAP]
    end

    F4 -->|queue state| M2
    F1 --> M2
    F2 --> M2

    M2 -->|dwell_p50_minutes<br/>dwell_p90_minutes| M1
    F1 --> M1
    F2 --> M1
    F3 --> M1

    M1 -->|eta_pred_minutes<br/>risk_tier| M4
    M3 -->|co2_kg per TCE<br/>environmental_cost| M4
    F3 --> M4
    M2 -->|dwell for hub stops| M4

    M1 -->|features + prediction<br/>ONLY if WARNING/CRITICAL| M5

    M4 -->|pareto_front<br/>selected_route| M6
    M1 -->|eta + risk_tier<br/>+ model_confidence| M6
    M2 -->|dwell + coverage_P90<br/>+ model_confidence| M6
    M3 -->|co2 + audit_validity| M6
    M5 -->|shap_explanation<br/>top-5 features| M6

    M6 -->|decision + confidence_aggregate| OUT[Dashboard / Escalation]

    style M2 fill:#ffe66d,color:#333
    style M1 fill:#ff6b6b,color:#fff
    style M3 fill:#4ecdc4,color:#fff
    style M4 fill:#ff6b6b,color:#fff
    style M5 fill:#a8e6cf,color:#333
    style M6 fill:#c9b1ff,color:#333
```

### Tabel Interaksi Detail

| Dari | Ke | Payload | Trigger | Sync/Async |
|---|---|---|---|---|
| M2 → M1 | `dwell_p50_minutes` (feature upstream) | Setiap queue_length event di hub | Async (via Redis cache) |
| M1 → M4 | `eta_pred_minutes`, `risk_tier` per shipment | Setiap evaluasi kromosom M4 | Sync (in-process call) |
| M3 → M4 | `co2_kg`, `environmental_cost` per TCE | Setiap evaluasi kromosom M4 | Sync (in-process call) |
| M2 → M4 | `dwell_p50/p90` per hub stop | Saat M4 decode chromosome | Sync (cache lookup) |
| M1 → M5 | `features_df`, `prediction` | HANYA jika risk_tier ∈ {WARNING, CRITICAL} | Sync (lazy on-demand) |
| M2 → M5 | `features_df`, `prediction_p50` | Opsional: jika dwell_p90 > threshold | Sync (lazy on-demand) |
| M1 → M6 | eta, risk_tier, model_confidence | Setiap pipeline run | Sync (LangGraph node) |
| M2 → M6 | dwell_p50/p90, coverage_P90, model_confidence | Setiap pipeline run | Sync (LangGraph node) |
| M3 → M6 | co2_kg, audit_validity | Setiap pipeline run | Sync (LangGraph node) |
| M4 → M6 | pareto_front, selected_route, constraint_satisfaction | Setiap pipeline run | Sync (LangGraph node) |
| M5 → M6 | shap_explanation top-5 | Setiap pipeline run (jika WARNING/CRITICAL) | Sync (LangGraph node) |
| M6 → Dashboard | decision, confidence_aggregate, audit_trail_id | Setiap pipeline run | Sync response |

---

## 3. Dependency Graph — Urutan Build Wajib

```mermaid
graph TB
    DP[Data Pipeline<br/>OSM + BMKG + HERE + Synthetic Gen]
    M3[M3 Carbon<br/>rule-based]
    M2[M2 Hub Congestion<br/>needs M/Mc simulator]
    M1[M1 ETA<br/>needs M2 output as feature]
    M4[M4 Route Opt<br/>needs M1 + M3]
    M5[M5 SHAP<br/>needs M1 final]
    M6[M6 Orchestration<br/>needs all M1-M5]

    DP --> M3
    DP --> M2
    DP --> M1
    DP --> M4
    M3 --> M4
    M2 --> M1
    M1 --> M4
    M1 --> M5
    M1 --> M6
    M2 --> M6
    M3 --> M6
    M4 --> M6
    M5 --> M6

    style DP fill:#c9b1ff,color:#333
    style M3 fill:#4ecdc4,color:#fff
    style M1 fill:#ff6b6b,color:#fff
    style M4 fill:#ff6b6b,color:#fff
    style M2 fill:#ffe66d,color:#333
    style M5 fill:#a8e6cf,color:#333
    style M6 fill:#c9b1ff,color:#333
```

### Aturan Dependency

| Edge | Wajib? | Fallback jika upstream belum ready |
|---|---|---|
| DP → semua | **YA** | Tidak ada fallback — data pipeline adalah blocker |
| M3 → M4 | **YA** | M4 butuh `environmental_cost` objective, tanpa M4 invalid |
| M2 → M1 | Tidak | Pakai `dwell_lag_24h` sebagai placeholder, retrain nanti |
| M1 → M4 | Tidak | Pakai dummy ETA: `distance / avg_speed`, swap nanti |
| M1 → M5 | **YA** | M5 butuh model final untuk SHAP, tidak ada stub |
| M1-M5 → M6 | Tidak | M6 bisa test orchestration dengan mock output M1-M5 |

---

## 4. End-to-End Pipeline untuk Satu Shipment

```mermaid
sequenceDiagram
    participant REQ as Shipment Request
    participant FS as Feature Store
    participant M2 as M2 Hub
    participant M1 as M1 ETA
    participant M3 as M3 Carbon
    participant M4 as M4 Route Opt
    participant M5 as M5 SHAP
    participant M6 as M6 Decision
    participant OPS as Operator Dashboard

    REQ->>FS: get_features(shipment_id)
    FS-->>REQ: traffic_index, weather, distance, queue_state

    par Parallel fetch
        FS->>M2: queue_state (cache HIT)
        M2-->>FS: dwell_p50=38, dwell_p90=52
    and
        FS->>M1: features + dwell_p50
    end

    M1->>M1: predict ETA
    M1-->>M1: eta_pred=145 min, risk_tier=WARNING

    alt risk_tier ∈ {WARNING, CRITICAL}
        M1->>M5: explain(features)
        M5-->>M1: shap top-5 (congestion +0.31, weather +0.18, ...)
    end

    M1->>M4: eta_pred, risk_tier per shipment
    M3->>M4: co2_kg per TCE
    M4->>M4: NSGA-II time-boxed 2.5s
    M4-->>M4: pareto_front (10 solusi, 8 feasible)

    M1->>M6: eta + risk_tier + model_confidence
    M2->>M6: dwell + coverage_P90 + model_confidence
    M3->>M6: co2 + audit_validity
    M4->>M6: pareto + constraint_satisfaction
    M5->>M6: shap_explanation (if exists)

    M6->>M6: confidence_aggregate = Σ wi × ci
    M6-->>M6: confidence = 0.87

    alt confidence ≥ 0.70
        M6->>OPS: auto-execute + confidence_breakdown
    else confidence < 0.70
        M6->>OPS: ESCALATE + primary_uncertainty_driver + shap
        OPS-->>M6: operator decision (approve/modify/reject)
    end
```

---

## 5. Latency Budget — Siapa Makan Berapa Milidetik

```mermaid
gantt
    title Latency Budget End-to-End (target P95 < 3000ms)
    dateFormat X
    axisFormat %s ms

    section Feature Layer
    Feature retrieval (cache)     :0, 50

    section Models (parallel where possible)
    M2 Hub (cache lookup)         :0, 30
    M1 ETA inference              :50, 100
    M3 Carbon calc                :50, 55
    M4 NSGA-II (time-boxed)       :100, 2500

    section Post-Model
    M5 SHAP (only WARN/CRIT)      :2500, 2550
    M6 Orchestration overhead     :2550, 2650
    Buffer margin                 :2650, 3000
```

### Tabel Budget Detail

| Komponen | Budget | Actual Estimasi | Catatan |
|---|---|---|---|
| Feature retrieval | 50ms | ~30ms | Redis cache hit |
| M2 inference | 30ms | ~15ms | Cache lookup, bukan recompute |
| M1 inference | 50ms | ~5ms | Tree-based sangat cepat |
| M3 calculation | 5ms | ~1ms | Formula matematis |
| M4 NSGA-II | 2500ms | ~2000-2300ms | Time-boxed hard limit |
| M5 SHAP (WARN/CRIT only) | 50ms | ~30ms | TreeExplainer single-instance |
| M6 orchestration | 100ms | ~70ms | LangGraph checkpointing |
| **Total** | **2785ms** | **~2350ms** | Margin 650ms untuk P95 |

**Insight:** M4 makan ~85% budget. Optimasi M4 = optimasi seluruh sistem. M1, M2, M3, M5, M6 combined hanya ~15%.

---

## 6. Sync vs Async — Kapan Tunggu, Kapan Jalan Paralel

```mermaid
graph TB
    START([Shipment Request Masuk])

    START --> PAR1{Parallel Block 1}
    PAR1 --> M2_CALL[M2 cache lookup<br/>dwell_p50/p90]
    PAR1 --> FEAT[Feature Store get<br/>traffic/weather/distance]

    M2_CALL --> M1_CALL
    FEAT --> M1_CALL

    M1_CALL[M1 ETA inference<br/>+ risk tier]
    M1_CALL --> CHECK{risk_tier?}

    CHECK -->|SAFE| M4_CALL
    CHECK -->|WARNING/CRITICAL| M5_CALL[M5 SHAP<br/>on-demand]
    M5_CALL --> M4_CALL

    M4_CALL[M4 NSGA-II<br/>time-boxed 2.5s<br/>calls M1 + M3 per chromosome]
    M4_CALL --> M3_CALL[M3 Carbon<br/>called by M4 per TCE]

    M4_CALL --> M6_AGG[M6 Confidence Aggregation<br/>+ Decision]

    M6_AGG --> DECIDE{confidence ≥ 0.70?}
    DECIDE -->|YES| AUTO[Auto-execute]
    DECIDE -->|NO| ESC[Escalate to Human]

    style PAR1 fill:#a8e6cf,color:#333
    style M4_CALL fill:#ff6b6b,color:#fff
    style M5_CALL fill:#a8e6cf,color:#333
    style M6_AGG fill:#c9b1ff,color:#333
```

### Aturan Sinkron vs Asinkron

| Panggilan | Mode | Alasan |
|---|---|---|
| M2 → M1 (feature) | Async (cache) | M2 update event-driven, M1 baca dari cache Redis |
| M1 → M4 (ETA per chromosome) | Sync | M4 butuh ETA untuk setiap kromosom yang dievaluasi |
| M3 → M4 (carbon per TCE) | Sync | M4 butuh carbon untuk setiap segmen rute |
| M1 → M5 (SHAP) | Sync (on-demand) | Hanya dipicu jika WARNING/CRITICAL, tidak untuk SAFE |
| M1-M5 → M6 | Sync (LangGraph) | Pipeline run adalah satu transaksi atomik |
| M2 internal update | Async (event-driven) | Queue length change → recompute → update cache |
| BMKG fetch | Async (cron 3-harian) | Tidak pernah sinkron per-request M1 |
| HERE Traffic fetch | Async (cron 15-menit) | Tidak pernah sinkron per-request M1 |

---

## 7. Confidence Aggregation Flow — Cara M6 Menghitung 87%

```mermaid
graph LR
    subgraph "M1 Confidence"
        M1_INT[Interval width<br/>P90-P50 = 25]
        M1_EXP[Expected ETA = 120]
        M1_CONF[conf_m1 = 1 - 25/240<br/>= 0.896]
        M1_INT --> M1_CONF
        M1_EXP --> M1_CONF
    end

    subgraph "M2 Confidence"
        M2_COV[Coverage P90<br/>7-day rolling = 0.88]
        M2_CONF[conf_m2 = 1 - |0.88-0.90|<br/>= 0.98]
        M2_COV --> M2_CONF
    end

    subgraph "M4 Confidence"
        M4_FEAS[Feasible solutions<br/>8 of 10 in Pareto]
        M4_CONF[conf_m4 = 8/10<br/>= 0.80]
        M4_FEAS --> M4_CONF
    end

    subgraph "Traffic Confidence"
        TF_AGE[Cache age = 8 min]
        TF_MAX[Max age = 30 min]
        TF_CONF[freshness = 1 - 8/30<br/>= 0.73]
        TF_AGE --> TF_CONF
        TF_MAX --> TF_CONF
    end

    subgraph "Carbon Confidence"
        CB_DEV[Audit deviation = 4%]
        CB_CONF[audit_validity = 1 - 0.04<br/>= 0.96]
        CB_DEV --> CB_CONF
    end

    M1_CONF --> AGG[confidence_aggregate]
    M2_CONF --> AGG
    M4_CONF --> AGG
    TF_CONF --> AGG
    CB_CONF --> AGG

    AGG --> CALC["= 0.40×0.896 + 0.15×0.98<br/>+ 0.25×0.80 + 0.10×0.73<br/>+ 0.10×0.96<br/>= 0.874"]
    CALC --> RESULT[confidence = 0.874<br/>= 87.4%]

    RESULT --> DECIDE{≥ 0.70?}
    DECIDE -->|YA| AUTO[Auto-execute ✅]
    DECIDE -->|TIDAK| ESC[Escalate to human ⚠️]

    style AGG fill:#c9b1ff,color:#333
    style RESULT fill:#ff6b6b,color:#fff
    style AUTO fill:#4ecdc4,color:#fff
    style ESC fill:#ffe66d,color:#333
```

### Bobot & Justifikasi

| Komponen | Bobot | Confidence Sumber | Alasan Bobot |
|---|---|---|---|
| M1 ETA | **0.40** | Interval width P90-P50 | Model inti, paling berpengaruh ke decision |
| M2 Hub | 0.15 | Coverage P90 historis | Penting tapi upstream M1 → dobel count jika tinggi |
| M4 Route | **0.25** | Feasibility Pareto | Constraint satisfaction krusial untuk eksekusi |
| Traffic | 0.10 | Cache freshness | Data quality, bukan model → bobot rendah |
| Carbon | 0.10 | Audit deviation | Rule-based, confidence tinggi by design |
| **Total** | **1.00** | — | — |

Bobot di-load dari `m6_confidence_config.yaml`, dikalibrasi manual BA (Orwin) + sensitivity analysis wajib dilampirkan di laporan.

---

## 8. Escalation Flow — Saat Confidence < 0.70

```mermaid
sequenceDiagram
    participant M6 as M6 Decision
    participant DASH as Dashboard
    participant OPS as Operator
    participant M4 as M4 Route Opt
    participant LOG as Audit Trail

    M6->>M6: confidence_aggregate = 0.64
    M6->>M6: primary_uncertainty_driver = "M1 interval terlalu lebar"
    M6->>DASH: escalation message<br/>(confidence_breakdown + SHAP + audit_trail_id)
    M6->>LOG: log pipeline state

    DASH->>OPS: notification (Slack/email/in-app)
    OPS->>DASH: review context

    alt Approve auto-execute
        OPS->>DASH: click "Approve"
        DASH->>M4: execute selected_route
        M4-->>DASH: route executed
    else Modify route manual
        OPS->>DASH: drag-drop route changes
        DASH->>M4: override with manual route
        M4-->>DASH: route executed
    else Delay shipment
        OPS->>DASH: update deadline
        DASH->>M6: re-run with new deadline
        M6-->>DASH: new confidence + decision
    else Reject
        OPS->>DASH: flag for follow-up
        DASH->>LOG: log rejection + reason
    end

    OPS->>LOG: feedback (decision + reason)
    LOG->>M6: feedback for weight calibration (roadmap)
```

### Komponen Wajib di Escalation Message

```json
{
  "escalation_id": "ESC-2026-000456",
  "shipment_id": "SHP-2026-000123",
  "confidence_aggregate": 0.64,
  "primary_uncertainty_driver": "M1 model_confidence=0.45 (interval P50-P90 terlalu lebar)",
  "confidence_breakdown": {
    "w1_eta": 0.40, "model_confidence_m1": 0.45,
    "w2_hub": 0.15, "model_confidence_m2": 0.60,
    "w3_route": 0.25, "constraint_satisfaction_m4": 0.50,
    "w_traffic": 0.10, "data_freshness": 0.80,
    "w_carbon": 0.10, "audit_validity": 0.95
  },
  "shap_explanation": "top-5 dari M5 (jika WARNING/CRITICAL)",
  "audit_trail_id": "AT-2026-001",
  "actions_available": ["approve_auto_execute", "modify_route_manual", "delay_shipment", "reject_decision"]
}
```

Field `primary_uncertainty_driver` adalah **UX kunci** — operator langsung tahu komponen mana yang menyebabkan confidence rendah, jadi tahu area apa yang harus di-verify manual.

---

## 9. Cross-Model Feature Sharing — Siapa Pakai Apa dari Siapa

```mermaid
graph TB
    subgraph "Features Produced"
        M2_OUT[dwell_p50<br/>dwell_p90<br/>coverage_P90]
        M1_OUT[eta_pred<br/>risk_tier<br/>model_confidence_m1]
        M3_OUT[co2_kg<br/>tce_breakdown<br/>audit_validity]
        M4_OUT[pareto_front<br/>selected_route<br/>constraint_satisfaction]
        M5_OUT[shap_top5<br/>base_value<br/>explainer_version]
    end

    subgraph "Consumers"
        M1_C[M1 needs dwell]
        M4_C[M4 needs ETA + CO2]
        M5_C[M5 needs M1 features]
        M6_C[M6 needs ALL]
        DASH_C[Dashboard needs ALL for display]
    end

    M2_OUT -->|feature upstream| M1_C
    M2_OUT -->|hub stop dwell| M4_C
    M1_OUT -->|per chromosome| M4_C
    M3_OUT -->|per TCE| M4_C
    M1_OUT -->|WARNING/CRITICAL only| M5_C
    M1_OUT --> M6_C
    M2_OUT --> M6_C
    M3_OUT --> M6_C
    M4_OUT --> M6_C
    M5_OUT --> M6_C
    M1_OUT --> DASH_C
    M4_OUT --> DASH_C
    M5_OUT --> DASH_C
```

### Matriks Konsumsi Feature

| Feature | Diproduksi oleh | Dikonsumsi oleh | Frequency |
|---|---|---|---|
| `dwell_p50_minutes` | M2 | M1 (sebagai feature), M4 (untuk hub stop) | Per request M1, per chromosome M4 |
| `dwell_p90_minutes` | M2 | M1 (konservatif), Dashboard | Per request M1 |
| `eta_pred_minutes` | M1 | M4 (objective f2), M6 (confidence) | Per chromosome M4, per pipeline run M6 |
| `risk_tier` | M1 (deterministic rule) | M4 (penalty), M5 (trigger), M6, Dashboard | Per prediction M1 |
| `co2_kg` | M3 | M4 (objective f3), M6 (audit_validity), Dashboard | Per TCE per chromosome M4 |
| `pareto_front` | M4 | M6 (constraint_satisfaction), Dashboard | Per pipeline run |
| `selected_route` | M4 (via Decision Agent M6) | Dashboard, Driver app | Per pipeline run |
| `shap_top5` | M5 | M6 (escalation message), Dashboard | On-demand (WARN/CRIT only) |
| `model_confidence_m1` | M1 (derived) | M6 (confidence aggregation) | Per pipeline run |
| `coverage_P90` | M2 (rolling 7-day) | M6 (confidence aggregation) | Per pipeline run |
| `audit_validity` | M3 (backtesting) | M6 (confidence aggregation) | Per pipeline run |
| `constraint_satisfaction` | M4 (Pareto feasibility) | M6 (confidence aggregation) | Per pipeline run |

---

## 10. Failure Cascade — Apa Terjadi Kalau Satu Model Down

```mermaid
graph TB
    FAIL_M1[M1 DOWN<br/>ETA inference fails]
    FAIL_M1 --> M6_DEGRADE_M1[M6: confidence drops<br/>w1=0.40 × 0 = 0<br/>→ confidence_aggregate drops ~40%]
    M6_DEGRADE_M1 --> ESC_M1[Almost always escalate<br/>operator must verify ETA manual]

    FAIL_M2[M2 DOWN<br/>dwell cache miss]
    FAIL_M2 --> M1_FALLBACK[M1: pakai fallback<br/>dwell_p50 = median historis<br/>flag m2_degraded=true]
    M1_FALLBACK --> M6_DEGRADE_M2[M6: w2 × reduced_conf<br/>confidence drops ~10-15%]
    M6_DEGRADE_M2 --> MAYBE_AUTO[May still auto-execute<br/>if other components high]

    FAIL_M3[M3 DOWN<br/>carbon calc error]
    FAIL_M3 --> M4_DEGRADE[M4: environmental_cost<br/>skip from objective<br/>run with 2 objectives only]
    M4_DEGRADE --> M6_DEGRADE_M3[M6: w_carbon × 0<br/>confidence drops ~10%]
    M6_DEGRADE_M3 --> AUTO_M3[Auto-execute possible<br/>CO2 reported as N/A]

    FAIL_M4[M4 DOWN<br/>NSGA-II timeout/error]
    FAIL_M4 --> M6_DEGRADE_M4[M6: w3 × 0<br/>confidence drops ~25%]
    M6_DEGRADE_M4 --> ESC_M4[Escalate<br/>no route recommendation]

    FAIL_M5[M5 DOWN<br/>SHAP error]
    FAIL_M5 --> M6_NO_SHAP[M6: shap_explanation=null<br/>confidence UNAFFECTED<br/>M5 not in confidence formula]
    M6_NO_SHAP --> AUTO_NO_SHAP[Auto-execute possible<br/>operator gets less context]

    style FAIL_M1 fill:#ff6b6b,color:#fff
    style FAIL_M4 fill:#ff6b6b,color:#fff
    style FAIL_M2 fill:#ffe66d,color:#333
    style FAIL_M3 fill:#ffe66d,color:#333
    style FAIL_M5 fill:#a8e6cf,color:#333
```

### Severity Tier

| Model Down | Severity | Dampak ke Decision | Mitigasi |
|---|---|---|---|
| **M1** | 🔴 KRITIS | Sistem praktis tidak bisa auto-execute | Escalate all, fallback ke distance-only heuristic |
| **M4** | 🔴 KRITIS | Tidak ada rekomendasi rute | Escalate all, pakai rute sebelumnya |
| M2 | 🟡 SEDANG | M1 pakai fallback dwell, confidence turun ~15% | M1 tetap jalan, dokumentasikan m2_degraded |
| M3 | 🟡 SEDANG | M4 run 2-objective (skip environmental), confidence turun ~10% | CO2 di-dashboard N/A, rute tetap dihitung |
| M5 | 🟢 RENDAH | Escalation message tanpa SHAP context | Tetap auto-execute possible, operator kurang konteks |

---

## 11. Build Order dengan Dependency — Visual Timeline

```mermaid
gantt
    title SLAra Build Timeline (6 minggu)
    dateFormat YYYY-MM-DD
    axisFormat %W

    section Minggu 1-2
    Data Pipeline (OSM+BMKG+HERE)      :dp1, 2026-07-15, 14d
    M3 Carbon (rule-based)             :m3, 2026-07-15, 7d
    M/Mc Simulator (for M2)            :sim, 2026-07-15, 10d

    section Minggu 2-3
    M1 ETA (Food Delivery proxy first) :m1a, 2026-07-22, 10d
    M4 NSGA-II (Solomon benchmark)     :m4a, 2026-07-22, 10d

    section Minggu 3-4
    M2 Hub Congestion (LightGBM)       :m2, 2026-07-29, 10d
    M1 ETA (Indonesia synthetic)       :m1b, 2026-08-01, 7d
    M4 NSGA-II (Indonesia scenarios)   :m4b, 2026-08-01, 7d

    section Minggu 4-5
    M6 Orchestration (LangGraph)       :m6, 2026-08-05, 7d
    Confidence calibration (BA Orwin)  :cal, 2026-08-05, 5d

    section Minggu 5-6
    M5 SHAP (TreeExplainer)            :m5, 2026-08-12, 5d
    End-to-end latency test            :e2e, 2026-08-15, 5d
    Dashboard wiring                   :dash, 2026-08-15, 5d
```

### Kritikal Path (yang TIDAK boleh delay)

```mermaid
graph LR
    DP[Data Pipeline<br/>Minggu 1-2]
    M1[M1 ETA Final<br/>Minggu 3-4]
    M6[M6 Orchestration<br/>Minggu 4-5]
    DEMO[Demo Ready<br/>Minggu 6]

    DP --> M1 --> M6 --> DEMO

    style DP fill:#ff6b6b,color:#fff
    style M1 fill:#ff6b6b,color:#fff
    style M6 fill:#ff6b6b,color:#fff
    style DEMO fill:#4ecdc4,color:#fff
```

Hanya **3 node** yang jika delay akan block demo:
1. **Data Pipeline** — tanpa ini, semua model tidak bisa training
2. **M1 final** — tanpa ini, M6 tidak bisa integrasi end-to-end
3. **M6** — tanpa ini, tidak ada orchestrasi untuk demo

Yang lain punya fallback (lihat §3).

---

## 12. Quick Reference — Cheat Sheet Tim

| Saya kerja di... | Saya butuh koordinasi dengan... | Untuk apa |
|---|---|---|
| M1 | M2 | Dapat `dwell_p50` sebagai feature (atau pakai placeholder lag-24h) |
| M1 | M5 | Pastikan TreeExplainer kompatibel dengan model final M1 |
| M1 | M6 | Ekspos `model_confidence` (interval width) untuk confidence aggregation |
| M2 | M1 | Update Redis cache dwell_p50/p90 event-driven, jangan tunggu polling M1 |
| M2 | M6 | Ekspos `coverage_P90` rolling 7-day untuk confidence |
| M3 | M4 | Performance M3 < 5ms per call (M4 panggil per TCE per kromosom) |
| M3 | M6 | Ekspos `audit_validity` (deviation dari EPA/DEFRA) untuk confidence |
| M4 | M1, M3 | Interface: M1 butuh (shipment_features) → eta_pred; M3 butuh (distance, vehicle, load) → co2_kg |
| M4 | M6 | Ekspos `pareto_front` + `constraint_satisfaction` (feasible/total ratio) |
| M5 | M1 | Trigger hanya jika risk_tier ∈ {WARNING, CRITICAL} |
| M5 | M6 | Lampirkan shap_explanation ke escalation message |
| M6 | SEMUA | Definisikan state schema di LangGraph, semua model harus sesuai schema |

---

**Dokumen referensi:**
- Spec detail per model: `models/M1_ETA_Prediction.md` sampai `models/M6_MultiAgent_Orchestration.md`
- Urutan pengembangan & paralelisasi: lihat chat session sebelumnya (§5 dokumen asli)
- File ini: `models/INTERACTION_MAP.md` — referensi tunggal saat wiring/integrasi
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