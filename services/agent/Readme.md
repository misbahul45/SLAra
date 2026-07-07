agent/
├── src/
│
├── config/
│   ├── env.ts
│   ├── logger.ts
│   └── index.ts
│
├── core/
│   ├── entities/
│   │   ├── conversation.ts
│   │   ├── message.ts
│   │   └── tool.ts
│   │
│   ├── errors/
│   │   ├── domain-error.ts
│   │   └── llm-error.ts
│   │
│   ├── ports/
│   │   ├── llm.ts
│   │   ├── memory.ts
│   │   ├── vector.ts
│   │   ├── kafka.ts
│   │   └── mcp.ts
│   │
│   └── types/
│
├── modules/
│   ├── chat/
│   │   ├── controller.ts
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── schemas.ts
│   │   └── dto.ts
│   │
│   ├── memory/
│   │
│   ├── tools/
│   │
│   └── health/
│
├── graph/
│   ├── graph.ts
│   ├── state.ts
│   ├── router.ts
│   │
│   ├── nodes/
│   │   ├── planner.ts
│   │   ├── retrieve.ts
│   │   ├── tool.ts
│   │   ├── reason.ts
│   │   ├── summarize.ts
│   │   └── respond.ts
│   │
│   └── edges/
│
├── adapters/
│   ├── llm/
│   │   ├── gemini.ts
│   │   └── openai.ts
│   │
│   ├── memory/
│   │   └── redis.ts
│   │
│   ├── vector/
│   │   └── qdrant.ts
│   │
│   ├── kafka/
│   │   ├── producer.ts
│   │   └── consumer.ts
│   │
│   ├── mcp/
│   │   ├── client.ts
│   │   └── tools.ts
│   │
│   └── data/
│       └── client.ts
│
├── http/
│   ├── app.ts
│   ├── routes.ts
│   └── middleware/
│       ├── auth.ts
│       ├── logger.ts
│       └── error.ts
│
├── shared/
│   ├── constants/
│   ├── utils/
│   └── types/
│
├── index.ts
│
│
├── package.json
└── tsconfig.json