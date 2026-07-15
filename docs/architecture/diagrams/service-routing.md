# SLAra — Service Routing Diagram

## Traffic Flow

```
Browser / Client
      │
      ▼
┌─────────────────────────────────────────────┐
│  Gateway (Nginx:alpine) — :80               │
│                                             │
│  /api/agent/*  → agent:3000                │
│  /api/data/*   → data:8081                 │
│  /api/ai/*     → ai:8000                   │
│  /*            → app:3000 (prod)           │
└──────────┬──────────┬──────────┬───────────┘
           │          │          │
     ┌─────▼──┐ ┌─────▼──┐ ┌────▼────┐
     │ agent  │ │  data  │ │   ai    │
     │  :3000 │ │  :8081 │ │  :8000  │
     │  Hono  │ │ Go/Gin │ │FastAPI  │
     └────┬───┘ └────┬───┘ └────┬────┘
          │          │          │
          └──────────┼──────────┘
                     │
        ┌────────────▼─────────────────┐
        │         Infra Layer          │
        │  Kafka :9092  (event bus)    │
        │  Redis :6379  (cache/pubsub) │
        │  MongoDB :27017              │
        │  Neo4j :7474/:7687           │
        │  Qdrant :6333 (vector DB)    │
        └──────────────────────────────┘
```

## Service Dependencies

> Per 2026-07-16, `mongodb`, `neo4j`, `redis`, dan `qdrant` **di-disable** (dikomentari) di
> `infra/docker-compose.yml` dan `infra/docker-compose.prod.yml` — sejalan dengan ADR-003 (demo path
> hanya butuh `gateway`, `agent`, `ai`, `app`, `kafka`). `depends_on` ke keempat service itu juga
> di-disable, sehingga baris di bawah mencerminkan **topologi demo**, bukan full stack.

| Service | Depends On (full stack) | Depends On (demo path, aktif) |
|---------|-------------------------|-------------------------------|
| gateway | agent, data, ai, app (all healthy) | agent, data, ai, app (all healthy) |
| agent   | qdrant, redis, kafka    | kafka |
| data    | mongodb, neo4j, redis, kafka | kafka |
| ai      | kafka, redis            | kafka |
| app     | — (standalone frontend) | — (standalone frontend) |

## Internal Ports

| Container | Internal Port | External Port (dev) | Protocol | Status demo |
|-----------|--------------|---------------------|----------|-------------|
| gateway   | 80           | 80                  | HTTP     | aktif |
| agent     | 3000         | 3000                | HTTP/WS  | aktif |
| data      | 8081         | 8081                | HTTP     | aktif |
| ai        | 8000         | 8000                | HTTP     | aktif |
| app       | 3000 (prod) / 5173 (dev) | 5173 (dev) | HTTP | aktif |
| kafka     | 9092/9093    | 9092                | TCP      | aktif |
| mongodb   | 27017        | 27017               | TCP      | 🔴 disabled (komentar) |
| neo4j     | 7474/7687    | 7474/7687           | HTTP/Bolt| 🔴 disabled (komentar) |
| redis     | 6379         | 6379                | TCP      | 🔴 disabled (komentar) |
| qdrant    | 6333         | 6333                | HTTP     | 🔴 disabled (komentar) |

## WebSocket

Nginx dikonfigurasi support WebSocket (`Upgrade` header + `HTTP/1.1`) pada semua location.
Agent service (Hono) mendukung SSE streaming via `streamSSE`.
