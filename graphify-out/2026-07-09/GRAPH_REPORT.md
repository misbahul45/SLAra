# Graph Report - SLAra  (2026-07-08)

## Corpus Check
- 32 files · ~12,433 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 185 nodes · 165 edges · 25 communities (20 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d303d71e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_Kafka Event Schemas|Kafka Event Schemas]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_📚 SLAra — Documentation Hub|📚 SLAra — Documentation Hub]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_home.tsx|home.tsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_AGENTS.md — SLAra Project Instructions|AGENTS.md — SLAra Project Instructions]]
- [[_COMMUNITY_AGENTS.md — SLAra Project Instructions|AGENTS.md — SLAra Project Instructions]]
- [[_COMMUNITY_SLAra|SLAra]]
- [[_COMMUNITY_Konvensi Kode|Konvensi Kode]]
- [[_COMMUNITY_github.commisbahul45SLAraservicesdata|github.com/misbahul45/SLAra/services/data]]
- [[_COMMUNITY_ml|ml]]
- [[_COMMUNITY_Konvensi Kode|Konvensi Kode]]
- [[_COMMUNITY_React Dashboard|React Dashboard]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `AGENTS.md — SLAra Project Instructions` - 13 edges
3. `AGENTS.md — SLAra Project Instructions` - 13 edges
4. `📚 SLAra — Documentation Hub` - 13 edges
5. `compilerOptions` - 10 edges
6. `SLAra` - 7 edges
7. `5. `progress/` — Tracking Progress & Planning` - 6 edges
8. `Build & Run Commands` - 5 edges
9. `Layanan (Detail)` - 5 edges
10. `Build & Run Commands` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- 1-file cycle: `apps/app/app/routes.ts -> apps/app/app/routes.ts`

## Hyperedges (group relationships)
- **SLAra Microservices Mesh** — services_agent, services_data, services_ai, infra_kafka [EXTRACTED 1.00]
- **Infrastructure Layer** — infra_mongodb, infra_neo4j, infra_redis, infra_qdrant, infra_kafka [EXTRACTED 1.00]

## Communities (25 total, 5 thin omitted)

### Community 0 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, paths (+9 more)

### Community 1 - "package.json"
Cohesion: 0.14
Nodes (13): dependencies, hono, @hono/node-server, devDependencies, tsx, @types/node, typescript, name (+5 more)

### Community 2 - "Kafka Event Schemas"
Cohesion: 0.40
Nodes (5): Agent Service (Hono), AI Service (FastAPI), Data Service (Go), Kafka Event Schemas, gRPC Contracts

### Community 3 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, jsx, jsxImportSource, module, outDir, skipLibCheck, strict, target (+3 more)

### Community 4 - "devDependencies"
Cohesion: 0.11
Nodes (17): devDependencies, @react-router/dev, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+9 more)

### Community 5 - "📚 SLAra — Documentation Hub"
Cohesion: 0.10
Nodes (20): 0. Prinsip Dasar, 10. Ownership Matrix, 11. Referensi Pendekatan, 1. Peta Struktur `docs/`, 2. `architecture/` — Architecture Decision Records (ADR), 3. `specifications/` — Spesifikasi Teknis per Fitur, 4. `contracts/` — Kontrak Antar Microservice, 5.1 Status Label (dipakai konsisten di semua sub-folder) (+12 more)

### Community 6 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, isbot, react, react-dom, react-router, @react-router/node, @react-router/serve

### Community 13 - "AGENTS.md — SLAra Project Instructions"
Cohesion: 0.12
Nodes (16): AGENTS.md — SLAra Project Instructions, AI Agents Capability (untuk agent yg kerja di repo ini), Architecture Map, Build & Run Commands, Codebase Understanding — WAJIB baca `graphify-out/` dulu, Common Gotchas, Environment Variables, Inisialisasi penuh (semua services + infra) (+8 more)

### Community 17 - "AGENTS.md — SLAra Project Instructions"
Cohesion: 0.12
Nodes (16): AGENTS.md — SLAra Project Instructions, AI Agents Capability (untuk agent yg kerja di repo ini), Architecture Map, Build & Run Commands, Codebase Understanding — WAJIB baca `graphify-out/` dulu, Common Gotchas, Environment Variables, Inisialisasi penuh (semua services + infra) (+8 more)

### Community 18 - "SLAra"
Cohesion: 0.12
Nodes (15): Agent — Hono + LangGraph, AI — FastAPI, Alur Komunikasi, Data — Go, Dokumentasi, Gateway — Nginx, Getting Started, Jalankan 1 service aja (dev mode) (+7 more)

### Community 19 - "Konvensi Kode"
Cohesion: 0.29
Nodes (7): Agent (TypeScript / Hono), AI (Python / FastAPI), Data (Go), Kafka Events, Konvensi Kode, Per Service, Umum

### Community 22 - "Konvensi Kode"
Cohesion: 0.29
Nodes (7): Agent (TypeScript / Hono), AI (Python / FastAPI), Data (Go), Kafka Events, Konvensi Kode, Per Service, Umum

## Knowledge Gaps
- **129 isolated node(s):** `Project Overview`, `Architecture Map`, `Repo Structure`, `Codebase Understanding — WAJIB baca `graphify-out/` dulu`, `Inisialisasi penuh (semua services + infra)` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AGENTS.md — SLAra Project Instructions` connect `AGENTS.md — SLAra Project Instructions` to `Konvensi Kode`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `AGENTS.md — SLAra Project Instructions` connect `AGENTS.md — SLAra Project Instructions` to `Konvensi Kode`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `Project Overview`, `Architecture Map`, `Repo Structure` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `📚 SLAra — Documentation Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._