# SLAra

Microservices-based logistics & AI orchestration platform — prediksi delay/ETA, carbon calculation, hub risk detection, dan route optimization (NSGA-II), dibungkus di belakang satu API gateway dan didukung AI agent (RAG + tool calling) buat operasional sehari-hari.

---

## Overview

SLAra terdiri dari 3 backend service + 1 dashboard, saling terhubung lewat REST dan Kafka event bus:

| Service | Tanggung Jawab |
|---|---|
| **Gateway** | Routing, reverse proxy, SSL, load balancing |
| **Agent** | AI orchestration, LangGraph, MCP, RAG, tool calling |
| **Data** | Business logic, CRUD, database access, event processing |
| **AI** | Machine learning, prediction, optimization, model training |
| **Infra** | Kafka, databases, Docker infrastructure |
| **Shared** | Shared contracts, Kafka events, common utilities |

### Alur Komunikasi

```text
                React Dashboard
                       │
                       ▼
                 Nginx Gateway
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Agent Service   Data Service   AI Service
      (Hono)        (Go/Gin)      (FastAPI)
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  Kafka Event Bus
                       │
      ┌────────┬────────┼────────┐
      ▼        ▼        ▼        ▼
   MongoDB   Neo4j    Redis   Qdrant
```

---

## Repo Structure

```text
SLAra/
│
├── apps/
│   └── app/                          # React + TypeScript + Mapbox Dashboard
│
├── services/
│   │
│   ├── gateway/                      # Nginx Reverse Proxy
│   │   ├── Routing
│   │   ├── SSL/TLS
│   │   ├── Load Balancer
│   │   ├── CORS
│   │   └── WebSocket
│   │
│   ├── agent/                        # AI Orchestration Service (Hono)
│   │   ├── LangGraph
│   │   ├── LangChain
│   │   ├── MCP
│   │   ├── RAG (Qdrant)
│   │   ├── AI Agents
│   │   ├── Prompt Management
│   │   ├── Memory
│   │   ├── Tool Calling
│   │   ├── REST API
│   │   ├── Kafka Producer
│   │   └── Kafka Consumer
│   │
│   ├── data/                         # Core Business Service (Go)
│   │   ├── Business Logic
│   │   ├── Shipment
│   │   ├── Driver
│   │   ├── Vehicle
│   │   ├── Route
│   │   ├── Hub
│   │   ├── Weather
│   │   ├── Traffic
│   │   ├── Analytics
│   │   ├── REST API
│   │   ├── Kafka Producer
│   │   ├── Kafka Consumer
│   │   ├── MongoDB
│   │   ├── Neo4j
│   │   └── Redis
│   │
│   └── ai/                           # AI / Machine Learning Service (FastAPI)
│       ├── Delay Prediction
│       ├── ETA Prediction
│       ├── Carbon Calculation
│       ├── Hub Risk Detection
│       ├── Route Optimization (NSGA-II)
│       ├── Model Training
│       ├── Model Inference
│       ├── Feature Engineering
│       ├── Kafka Producer
│       └── Kafka Consumer
│
├── infra/
│   │
│   ├── compose/                      # Docker Compose
│   ├── kafka/                        # Event Streaming
│   ├── mongodb/                      # Operational Database
│   ├── redis/                        # Cache & Feature Cache
│   ├── neo4j/                        # Graph Database
│   ├── qdrant/                       # Vector Database (RAG)
│   ├── scripts/                      # Bootstrap & Utility Scripts
│   └── environments/                 # Environment Configuration
│
├── shared/
│   ├── events/                       # Kafka Event Schemas
│   ├── contracts/                    # Shared DTOs
│   └── utils/                        # Shared Utilities
│
├── docs/                             # Dokumentasi teknis lengkap — index: docs/Readme.md
│   ├── Readme.md                     # hub navigasi dokumentasi
│   ├── architecture/                 # ADR + diagram desain sistem
│   │   ├── adr/
│   │   └── diagrams/
│   ├── specifications/                # spek fitur per-service, ditulis sebelum coding
│   │   ├── data/
│   │   ├── ml/
│   │   ├── agent/
│   │   └── platform/
│   ├── contracts/                     # kontrak resmi antar microservice (REST/events)
│   │   ├── rest/
│   │   ├── events/
│   │   └── CHANGELOG.md
│   ├── progress/                      # tracking progress & planning (plan/data/ml/agent)
│   ├── api/                            # dokumentasi API + testing
│   │   ├── generated/                 # OpenAPI docs (auto-generate, jangan edit manual)
│   │   └── bruno/                     # Bruno collection buat testing manual/exploratory
│   ├── deployment/                     # panduan deploy, env, secrets
│   └── runbooks/                       # SOP incident response, rollback, on-call
│
├── graphify-out/                      # generated codebase graph/context — dibaca AI agent dulu
│                                       # sebelum eksplorasi manual (lihat AGENTS.md)
│
├── .github/
│   └── workflows/                    # CI/CD
│
├── AGENTS.md                          # konvensi & instruksi untuk AI coding agent
├── claude.md                          # catatan project khusus Claude
├── pnpm-workspace.yaml
├── Readme.md                          # ← kamu di sini
└── LICENSE
```

---

## Layanan (Detail)

### Gateway — Nginx
Routing, reverse proxy, SSL/TLS, load balancing, CORS, WebSocket upgrade (untuk streaming SSE dari Agent).

### Agent — Hono + LangGraph
AI orchestration: LangGraph, LangChain, MCP tool calling, RAG lewat Qdrant, prompt & memory management, expose REST API + streaming, terhubung ke Kafka sebagai producer & consumer.

### Data — Go
Core business logic: shipment, driver, vehicle, route, hub, weather, traffic, analytics. Expose REST API, terhubung ke MongoDB, Neo4j, Redis, dan Kafka.

### AI — FastAPI
Machine learning: delay prediction, ETA prediction, carbon calculation, hub risk detection, route optimization (NSGA-II), model training & inference, feature engineering, terhubung ke Kafka.

---

## Getting Started

### Jalankan semua service + infra sekaligus

```bash
cd infra
docker compose watch
```

### Jalankan 1 service aja (dev mode)

```bash
# Agent
cd services/agent && pnpm dev

# Data (perlu Air buat hot-reload)
cd services/data && air

# AI
cd services/ai && uv run uvicorn main:app --reload
```

### Tambah dependency

Selalu lewat container, jangan di host (beda libc):

```bash
cd infra && docker compose exec agent pnpm add <pkg>
cd infra && docker compose exec data go get <pkg>
cd infra && docker compose exec ai uv add <pkg>
```

Detail lengkap build/lint/test per service ada di `AGENTS.md`.

---

## Dokumentasi

| Kebutuhan | Ke mana |
|---|---|
| Konvensi kode & instruksi untuk AI coding agent | `AGENTS.md` |
| Konteks/peta codebase (dependency graph, module map) buat AI agent | `graphify-out/` |
| Spesifikasi fitur, ADR, kontrak API/event, progress tracker | `docs/Readme.md` (hub navigasi lengkap) |
| Testing API manual/exploratory | `docs/api/bruno/` |

---

## License

Lihat [`LICENSE`](./LICENSE).