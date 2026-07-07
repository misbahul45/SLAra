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
│   │   ├── gRPC
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
│   ├── monitoring/                   # Prometheus, Grafana, Loki
│   ├── scripts/                      # Bootstrap & Utility Scripts
│   └── environments/                 # Environment Configuration
│
├── shared/
│   ├── protobuf/                     # gRPC Contracts
│   ├── events/                       # Kafka Event Schemas
│   ├── contracts/                    # Shared DTOs
│   └── utils/                        # Shared Utilities
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   ├── diagrams/
│   └── adr/
│
├── .github/
│   └── workflows/                    # CI/CD
│
├── pnpm-workspace.yaml
├── README.md
└── LICENSE
```

## Ownership Service

| Service     | Responsibility                                             |
| ----------- | ---------------------------------------------------------- |
| **Gateway** | Routing, Reverse Proxy, SSL, Load Balancing                |
| **Agent**   | AI Orchestration, LangGraph, MCP, RAG, Tool Calling        |
| **Data**    | Business Logic, CRUD, Database Access, Event Processing    |
| **AI**      | Machine Learning, Prediction, Optimization, Model Training |
| **Infra**   | Kafka, Databases, Monitoring, Docker Infrastructure        |
| **Shared**  | Shared contracts, gRPC, Kafka events, common utilities     |

### Alur komunikasi

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
      ┌────────┬────────┼────────┬────────┐
      ▼        ▼        ▼        ▼        ▼
   MongoDB   Neo4j    Redis   Qdrant  Monitoring
```