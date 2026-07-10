# Graph Report - SLAra  (2026-07-09)

## Corpus Check
- 39 files · ~28,553 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 428 nodes · 400 edges · 31 communities (26 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f699d0e2`
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
- [[_COMMUNITY_M5 — Explainability Layer (SHAP)|M5 — Explainability Layer (SHAP)]]
- [[_COMMUNITY_M3 — Carbon Emission Estimator|M3 — Carbon Emission Estimator]]
- [[_COMMUNITY_M6 — Multi-Agent Orchestration & Confidence Aggregation|M6 — Multi-Agent Orchestration & Confidence Aggregation]]
- [[_COMMUNITY_3.3 Definisi `model_confidence` per Komponen|3.3 Definisi `model_confidence` per Komponen]]
- [[_COMMUNITY_4. Operator Genetik|4. Operator Genetik]]
- [[_COMMUNITY_readme|readme.md]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `SLAra AI — Model Interaction Map (M1–M6)` - 13 edges
3. `AGENTS.md — SLAra Project Instructions` - 13 edges
4. `AGENTS.md — SLAra Project Instructions` - 13 edges
5. `📚 SLAra — Documentation Hub` - 13 edges
6. `M1 — ETA Prediction & SLA Risk Tier` - 12 edges
7. `M2 — Hub Congestion / Dwell-Time Forecast` - 12 edges
8. `M4 — Route Optimization Engine (NSGA-II)` - 12 edges
9. `M5 — Explainability Layer (SHAP)` - 12 edges
10. `M6 — Multi-Agent Orchestration & Confidence Aggregation` - 11 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- 1-file cycle: `apps/app/app/routes.ts -> apps/app/app/routes.ts`

## Hyperedges (group relationships)
- **SLAra Microservices Mesh** — services_agent, services_data, services_ai, infra_kafka [EXTRACTED 1.00]
- **Infrastructure Layer** — infra_mongodb, infra_neo4j, infra_redis, infra_qdrant, infra_kafka [EXTRACTED 1.00]

## Communities (31 total, 5 thin omitted)

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
Cohesion: 0.08
Nodes (24): dependencies, isbot, react, react-dom, react-router, @react-router/node, @react-router/serve, devDependencies (+16 more)

### Community 5 - "📚 SLAra — Documentation Hub"
Cohesion: 0.10
Nodes (20): 0. Prinsip Dasar, 10. Ownership Matrix, 11. Referensi Pendekatan, 1. Peta Struktur `docs/`, 2. `architecture/` — Architecture Decision Records (ADR), 3. `specifications/` — Spesifikasi Teknis per Fitur, 4. `contracts/` — Kontrak Antar Microservice, 5.1 Status Label (dipakai konsisten di semua sub-folder) (+12 more)

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (36): 10. Risiko & Mitigasi, 11. Acceptance Criteria (untuk demo kompetisi), 1. Ringkasan Eksekutif, 2.1 Quantile Regression, 2.2 Output Schema, 2. Formulasi Matematis, 3.1 Pilihan Algoritma — LightGBM Quantile, 3.2 Hyperparameter Default (+28 more)

### Community 13 - "AGENTS.md — SLAra Project Instructions"
Cohesion: 0.08
Nodes (23): Agent (TypeScript / Hono), AGENTS.md — SLAra Project Instructions, AI Agents Capability (untuk agent yg kerja di repo ini), AI (Python / FastAPI), Architecture Map, Build & Run Commands, Codebase Understanding — WAJIB baca `graphify-out/` dulu, Common Gotchas (+15 more)

### Community 17 - "AGENTS.md — SLAra Project Instructions"
Cohesion: 0.08
Nodes (23): Agent (TypeScript / Hono), AGENTS.md — SLAra Project Instructions, AI Agents Capability (untuk agent yg kerja di repo ini), AI (Python / FastAPI), Architecture Map, Build & Run Commands, Codebase Understanding — WAJIB baca `graphify-out/` dulu, Common Gotchas (+15 more)

### Community 18 - "SLAra"
Cohesion: 0.12
Nodes (15): Agent — Hono + LangGraph, AI — FastAPI, Alur Komunikasi, Data — Go, Dokumentasi, Gateway — Nginx, Getting Started, Jalankan 1 service aja (dev mode) (+7 more)

### Community 19 - "Konvensi Kode"
Cohesion: 0.06
Nodes (34): 10. Roadmap (post-MVP), 11. Acceptance Criteria (untuk demo kompetisi), 1. Ringkasan Eksekutif, 2.1 Prediksi ETA, 2.2 Derivasi Risk Tier (deterministic, non-ML), 2.3 Mengapa Bukan Dua Model Terpisah, 2. Formulasi Matematis, 3.1 Pilihan Algoritma (+26 more)

### Community 22 - "Konvensi Kode"
Cohesion: 0.05
Nodes (40): 10. Risiko & Mitigasi, 11. Acceptance Criteria (untuk demo kompetisi), 1. Ringkasan Eksekutif, 2.1 Problem Statement, 2.2 Tiga Objective (Final), 2.3 Constraint (Bukan Objective), 2.4 Mengapa 3 Objective (Bukan 4 atau 5), 2. Formulasi Matematis (+32 more)

### Community 25 - "M5 — Explainability Layer (SHAP)"
Cohesion: 0.06
Nodes (33): 10. Roadmap (post-MVP), 11. Acceptance Criteria (untuk demo kompetisi), 1. Ringkasan Eksekutif, 2.1 Mengapa TreeExplainer (Bukan KernelExplainer), 2.2 Implementasi Reference, 2.3 Output Schema, 2. Pilihan Algoritma — TreeExplainer, 3.1 Prinsip Lazy Evaluation (+25 more)

### Community 26 - "M3 — Carbon Emission Estimator"
Cohesion: 0.07
Nodes (28): 1. Ringkasan Eksekutif, 2.1 Formula Utama (dari proposal, dipertahankan), 2.2 — Per Transport Chain Element (GLEC Framework), 2.3 Load Factor Adjustment, 2.4 Scope Emissions (Klasifikasi GHG Protocol), 2. Formulasi Matematis, 3.1 IPCC 2019 Refinement to 2006 Guidelines, 3.2 GLEC Framework v3 (Smart Freight Centre) (+20 more)

### Community 27 - "M6 — Multi-Agent Orchestration & Confidence Aggregation"
Cohesion: 0.07
Nodes (28): 10. Acceptance Criteria (untuk demo kompetisi), 1. Ringkasan Eksekutif, 2.1 Node Design — 6 Agent, 2.2 Detail per Node, 2.3 Edge — Conditional Flow, 2.4 State Schema, 2. Arsitektur LangGraph, 4.1 Pendekatan — Manual dengan Business Judgment (+20 more)

### Community 28 - "3.3 Definisi `model_confidence` per Komponen"
Cohesion: 0.20
Nodes (10): 3.1 Formula Utama, 3.2 Default Bobot (Kalibrasi Awal), 3.3.1 `model_confidence(M1)` — dari prediction interval, 3.3.2 `model_confidence(M2)` — dari quantile coverage historis, 3.3.3 `constraint_satisfaction(M4)` — dari feasibility Pareto front, 3.3.4 `data_freshness(Traffic)`, 3.3.5 `audit_validity(Carbon)`, 3.3 Definisi `model_confidence` per Komponen (+2 more)

### Community 29 - "4. Operator Genetik"
Cohesion: 0.09
Nodes (22): 10. Failure Cascade — Apa Terjadi Kalau Satu Model Down, 11. Build Order dengan Dependency — Visual Timeline, 12. Quick Reference — Cheat Sheet Tim, 1. Architecture Overview — Semua Komponen Sekaligus, 2. Data Flow Antar-Model — Apa yang Mengalir Kemana, 3. Dependency Graph — Urutan Build Wajib, 4. End-to-End Pipeline untuk Satu Shipment, 5. Latency Budget — Siapa Makan Berapa Milidetik (+14 more)

### Community 30 - "readme.md"
Cohesion: 0.40
Nodes (4): Aturan Penting — Jangan Tunggu Mock!, Kritikal Path (yang TIDAK boleh delay), Urutan Berdasarkan Dependency (bukan timeline kalender), Yang Bisa Dikerjakan Paralel Hari 1

## Knowledge Gaps
- **307 isolated node(s):** `1. Architecture Overview — Semua Komponen Sekaligus`, `Tabel Interaksi Detail`, `Aturan Dependency`, `4. End-to-End Pipeline untuk Satu Shipment`, `Tabel Budget Detail` (+302 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `M6 — Multi-Agent Orchestration & Confidence Aggregation` connect `M6 — Multi-Agent Orchestration & Confidence Aggregation` to `3.3 Definisi `model_confidence` per Komponen`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `1. Architecture Overview — Semua Komponen Sekaligus`, `Tabel Interaksi Detail`, `Aturan Dependency` to the rest of the system?**
  _307 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `📚 SLAra — Documentation Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._