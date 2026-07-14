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

| Service | Depends On |
|---------|-----------|
| gateway | agent, data, ai, app (all healthy) |
| agent   | qdrant, redis, kafka |
| data    | mongodb, neo4j, redis, kafka |
| ai      | kafka, redis |
| app     | — (standalone frontend) |

## Internal Ports

| Container | Internal Port | External Port (dev) | Protocol |
|-----------|--------------|---------------------|----------|
| gateway   | 80           | 80                  | HTTP     |
| agent     | 3000         | 3000                | HTTP/WS  |
| data      | 8081         | 8081                | HTTP     |
| ai        | 8000         | 8000                | HTTP     |
| app       | 3000 (prod) / 5173 (dev) | 5173 (dev) | HTTP |
| mongodb   | 27017        | 27017               | TCP      |
| neo4j     | 7474/7687    | 7474/7687           | HTTP/Bolt|
| redis     | 6379         | 6379                | TCP      |
| qdrant    | 6333         | 6333                | HTTP     |
| kafka     | 9092/9093    | 9092                | TCP      |

## WebSocket

Nginx dikonfigurasi support WebSocket (`Upgrade` header + `HTTP/1.1`) pada semua location.
Agent service (Hono) mendukung SSE streaming via `streamSSE`.
