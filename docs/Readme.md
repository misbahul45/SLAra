# 📚 SLAra — Documentation Hub

> File ini adalah **pintu masuk tunggal** untuk seluruh dokumentasi teknis SLAra: spesifikasi, kontrak antar-microservice, dokumentasi + testing API, serta tracking progress & planning (termasuk untuk pengembangan AI Agent). Semua anggota tim — baru maupun lama — mulai dari sini.

---

## 0. Prinsip Dasar

Dokumentasi ini dibangun di atas 3 prinsip yang umum dipakai tim engineering yang sudah matang (Google design docs, ADR ala Michael Nygard, contract-first API design):

1. **Spec-first** — Fitur/keputusan teknis besar ditulis speknya *sebelum* dikerjakan, bukan didokumentasikan setelah selesai. Ini mencegah rework dan miskomunikasi antara service `agent`, `data`, dan `ai`.
2. **Contract-first** — Karena SLAra adalah sistem microservice yang saling bicara lewat REST dan Kafka, kontrak (schema, payload, event) didefinisikan eksplisit dan versioned. Service boleh berubah internal-nya, tapi kontrak adalah janji yang tidak boleh dilanggar diam-diam.
3. **Progress dipisah per domain, bukan digabung rata** — Progress `data` (fitur/endpoint selesai), `ml` (akurasi model, status training), dan `agent` (kapabilitas, evaluasi prompt/tool-calling) punya satuan ukur berbeda. Menyamakan semua dalam satu Kanban generik justru menyembunyikan detail yang penting untuk decision-making.

---

## 1. Peta Struktur `docs/`

```
docs/
├── Readme.md                      # ⬅️ kamu di sini — hub navigasi
│
├── architecture/                  # Keputusan desain sistem (jangka panjang, jarang berubah)
│   ├── adr/                       # Architecture Decision Records
│   │   ├── 0001-pilih-hono-untuk-agent-service.md
│   │   └── 0002-nsga-ii-untuk-route-optimization.md
│   └── diagrams/                  # source diagram (mermaid/excalidraw) + hasil export
│
├── specifications/                 # Spesifikasi teknis per fitur, ditulis SEBELUM coding
│   ├── data/                      # spek untuk service Go (business logic, shipment, driver, dll)
│   ├── ml/                        # spek model (delay prediction, ETA, carbon calc, hub risk, route opt)
│   ├── agent/                     # spek AI agent (tools, RAG flow, memory, prompt strategy)
│   └── platform/                  # spek lintas-service (gateway, auth, observability)
│
├── contracts/                      # Kontrak resmi antar microservice — SUMBER KEBENARAN interface
│   ├── rest/                      # OpenAPI spec per service
│   ├── events/                    # dokumentasi Kafka event (mapping ke shared/events)
│   └── CHANGELOG.md               # log breaking/non-breaking change tiap kontrak
│
├── progress/                       # 🔥 Pusat tracking progress & planning tim
│   ├── plan/                      # roadmap, milestone, sprint log
│   ├── data/                      # progress service Go
│   ├── ml/                        # progress model & eksperimen
│   └── agent/                     # progress AI agent
│
├── api/                             # Dokumentasi API + Bruno collection (testing) — lihat section 6
│   ├── generated/                 # dokumentasi API hasil generate otomatis (auto, jangan edit manual)
│   └── bruno/                     # Bruno collection buat testing manual/exploratory tiap endpoint
│
├── deployment/                     # panduan deploy, environment, secrets management
└── runbooks/                       # SOP incident response, rollback, on-call
```

**Aturan:** setiap folder di atas punya `Readme.md` sendiri yang isinya index + link ke dokumen-dokumen di dalamnya. Dokumen ini (`docs/Readme.md`) hanya menjelaskan *cara pakai* struktur, bukan menyimpan isi detailnya.

> Catatan: folder `progress/` dan `deployment/` di struktur di atas adalah target struktur (belum tentu semua sudah dibuat fisik). Kalau lagi bikin folder baru sesuai peta ini, ikutin konvensi & template yang ada di section terkait di bawah.

---

## 2. `architecture/` — Architecture Decision Records (ADR)

Dipakai untuk keputusan yang **mahal untuk diubah**: pilihan database, pilihan framework, pola komunikasi antar service, pilihan algoritma inti.

**Kapan menulis ADR:** setiap kali keputusan teknis akan mempengaruhi lebih dari satu service, atau sulit di-reverse dalam waktu dekat.

**Template `adr/000X-judul-singkat.md`:**

```markdown
# ADR-000X: <Judul Keputusan>

- Status: Proposed | Accepted | Deprecated | Superseded by ADR-000Y
- Tanggal: YYYY-MM-DD
- Pengambil keputusan: <nama>

## Konteks
Masalah apa yang mendorong keputusan ini?

## Keputusan
Apa yang diputuskan?

## Alternatif yang dipertimbangkan
- Opsi A — kenapa ditolak
- Opsi B — kenapa ditolak

## Konsekuensi
Dampak positif dan negatif, termasuk technical debt yang sengaja diambil.
```

---

## 3. `specifications/` — Spesifikasi Teknis per Fitur

Ditulis **sebelum** implementasi. Satu file = satu fitur/kapabilitas. Disimpan sesuai pemilik service: `data/`, `ml/`, `agent/`, atau `platform/` kalau lintas service.

**Template `SPEC-XXX-nama-fitur.md`:**

```markdown
# SPEC-XXX: <Nama Fitur>

- Owner: <nama/role>
- Service terkait: data | ml | agent | platform
- Status: Draft | In Review | Approved | Implemented

## Problem Statement
Masalah bisnis/teknis apa yang diselesaikan?

## Goals
- ...

## Non-Goals
- ... (penting: apa yang sengaja TIDAK dikerjakan sekarang)

## Desain
Penjelasan pendekatan, flow, atau arsitektur.

## Kontrak yang terdampak
Link ke dokumen di /contracts jika fitur ini menambah/mengubah API, event, atau schema.

## Success Metrics
Bagaimana kita tahu ini berhasil? (angka, bukan opini)

## Open Questions
Hal yang belum diputuskan.
```

Contoh isi folder:
- `specifications/ml/eta-prediction-v2.md`
- `specifications/agent/rag-retrieval-strategy.md`
- `specifications/data/hub-risk-event-ingestion.md`

---

## 4. `contracts/` — Kontrak Antar Microservice

Ini folder paling kritis untuk sistem seperti SLAra karena `gateway`, `agent`, `data`, dan `ai` saling terhubung lewat REST, dan Kafka. **Kontrak adalah dokumen yang dibaca lintas tim sebelum coding**, bukan hasil reverse-engineer dari code.

| Sub-folder | Isi | Sumber teknis |
|---|---|---|
| `rest/` | OpenAPI/Swagger tiap endpoint publik (via gateway) | disinkronkan manual dari service |
| `events/` | Deskripsi tiap topic Kafka: producer, consumer, payload, retry policy | `shared/events/` |
| `CHANGELOG.md` | Log semua perubahan kontrak, ditandai `BREAKING` atau `NON-BREAKING` | manual, wajib diisi tiap PR yang mengubah kontrak |

**Aturan versi kontrak:**
- Breaking change **wajib** ADR + entri di `CHANGELOG.md` + notifikasi ke owner service consumer.
- Non-breaking change (menambah field opsional) cukup dicatat di `CHANGELOG.md`.
- Endpoint baru/berubah **wajib** juga tercermin di request Bruno terkait — lihat section 6.2.

**Template entri event (`events/<topic-name>.md`):**

```markdown
# Topic: shipment.delay.predicted

- Producer: ai-service
- Consumer(s): data-service, agent-service
- Versi schema: v1 (link ke shared/events/shipment-delay-predicted.v1.json)

## Payload
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| shipment_id | string | ya | |
| predicted_delay_minutes | number | ya | |
| confidence | number | ya | 0.0–1.0 |

## Retry & Error Policy
...
```

---

## 5. `progress/` — Tracking Progress & Planning

Ini bagian yang paling sering dibuka tim sehari-hari. Dipecah jadi 4 sub-folder agar setiap domain punya format yang sesuai dengan cara kerjanya masing-masing.

### 5.1 Status Label (dipakai konsisten di semua sub-folder)

| Label | Arti |
|---|---|
| 🔴 Not Started | Belum dikerjakan |
| 🟡 In Progress | Sedang dikerjakan |
| 🔵 In Review | Menunggu review/testing |
| 🟢 Done | Selesai & terverifikasi |
| ⏸️ Blocked | Terhambat, alasan wajib dicatat |

### 5.2 `progress/plan/` — Roadmap & Planning

Isi:
- `roadmap.md` — rencana per kuartal, level tinggi (mis: "Q3 2026: Agent bisa handle multi-hub rerouting otomatis")
- `milestones.md` — target konkret dengan tanggal
- `sprints/` — satu file per sprint/iterasi (`sprint-2026-07-a.md`)

**Template sprint:**

```markdown
# Sprint 2026-07-A (7–18 Juli)

## Fokus
Ringkasan tema sprint ini.

## Komitmen
| Item | Service | Owner | Status |
|---|---|---|---|
| ... | data/ml/agent | ... | 🟡 |

## Hasil Retro
- Apa yang jalan baik
- Apa yang perlu diperbaiki
```

### 5.3 `progress/data/` — Progress Service `data` (Go)

Tracking berbasis **fitur/endpoint**, karena unit kerja service ini adalah business logic.

**Template `progress/data/tracker.md`:**

```markdown
# Progress — Data Service

| Fitur | Domain | Status | Owner | Target | Catatan |
|---|---|---|---|---|---|
| CRUD Shipment | Shipment | 🟢 | ... | ... | |
| Driver assignment logic | Driver | 🟡 | ... | ... | |
| Neo4j route graph sync | Route | 🔴 | ... | ... | menunggu spec Neo4j schema |
| Weather ingestion → Kafka | Weather | 🟡 | ... | ... | |
```

### 5.4 `progress/ml/` — Progress Model & Eksperimen (FastAPI service)

Tracking berbasis **model registry + eksperimen**, bukan sekadar checklist fitur, karena yang penting adalah metrik.

**Template `progress/ml/model-registry.md`:**

```markdown
# Model Registry & Progress

| Model | Task | Versi | Status | Metrik Terbaru | Dataset | Deployed? |
|---|---|---|---|---|---|---|
| DelayPredictor | Delay Prediction | v3 | 🟢 | MAE: 4.2 min | 2026-Q2 | ✅ Prod |
| ETAModel | ETA Prediction | v1 | 🟡 | RMSE: 6.1 min | 2026-Q2 | ❌ Staging |
| CarbonCalc | Carbon Calculation | v1 | 🟢 | — (rule-based) | — | ✅ Prod |
| HubRiskDetector | Hub Risk Detection | v2 | 🟡 | F1: 0.78 | 2026-Q1 | ❌ |
| RouteOptimizer | Route Optimization (NSGA-II) | v1 | 🔴 | — | — | ❌ |

## Eksperimen Berjalan
| Eksperimen | Hipotesis | Status | Hasil |
|---|---|---|---|
| ... | ... | 🟡 | ... |
```

### 5.5 `progress/agent/` — Progress AI Agent

Tracking berbasis **kapabilitas & evaluasi**, karena "selesai" untuk agent AI diukur dari keandalan, bukan sekadar fitur ada/tidak.

**Template `progress/agent/capability-tracker.md`:**

```markdown
# Progress — AI Agent (LangGraph/LangChain)

## Kapabilitas
| Kapabilitas | Tools yang dipakai | Status | Eval terakhir | Catatan |
|---|---|---|---|---|
| Shipment status Q&A (RAG) | Qdrant retriever | 🟢 | akurasi jawaban 91% | |
| Rerouting recommendation | data-service API, ml-service API | 🟡 | belum di-eval | |
| Multi-hub negotiation flow | MCP tool: hub-service | 🔴 | — | butuh SPEC dulu |

## Prompt & Memory Versioning
| Komponen | Versi | Tanggal update | Alasan perubahan |
|---|---|---|---|
| System prompt utama | v4 | 2026-06-20 | kurangi hallucination saat data kosong |
| Memory strategy | v2 | 2026-05-10 | pindah short-term ke Redis |

## Evaluasi
| Tanggal | Jenis eval | Hasil | Link detail |
|---|---|---|---|
| ... | tool-calling accuracy | 88% | ... |
```

---

## 6. `api/` — Dokumentasi API & Testing (Bruno)

`api/` sekarang punya dua sub-folder dengan tujuan berbeda: dokumentasi yang di-generate otomatis, dan collection Bruno untuk testing manual/exploratory tiap endpoint.

```
docs/api/
├── generated/                     # dokumentasi API hasil generate otomatis (auto, jangan edit manual)
│   ├── data/
│   ├── agent/
│   └── ai/
└── bruno/                         # Bruno collection — testing manual & exploratory
    ├── bruno.json                 # config workspace/collection
    ├── environments/
    │   ├── local.bru              # base URL ke gateway lokal (docker compose)
    │   ├── staging.bru
    │   └── production.bru
    ├── data-service/
    │   ├── shipments/
    │   ├── drivers/
    │   ├── vehicles/
    │   └── routes/
    ├── agent-service/
    │   └── chat/
    └── ai-service/
        ├── eta/
        ├── delay/
        ├── carbon/
        ├── hub-risk/
        └── route-optimization/
```

### 6.1 `api/generated/` (tidak berubah)

Dokumentasi API hasil generate otomatis (misal dari OpenAPI). **Jangan edit manual** — kalau ada yang salah, perbaiki di source (`contracts/rest/`) lalu re-generate.

### 6.2 `api/bruno/` — Kenapa Bruno

Bruno dipilih karena collection-nya berupa file teks biasa (`.bru`), jadi **git-friendly** — bisa di-review lewat PR, di-diff, tanpa perlu export/import manual atau akun cloud kayak Postman.

**Aturan:**
- Satu folder collection per service (`data-service/`, `agent-service/`, `ai-service/`), sub-folder lagi per domain/resource (`shipments/`, `chat/`, `eta/`, dll) — mengikuti struktur `contracts/rest/`.
- **Endpoint baru atau berubah di `contracts/rest/` WAJIB disertai request Bruno yang sesuai di PR yang sama.** Kontrak dan collection testing harus selalu sinkron, jangan menyusul belakangan.
- Naming file request: kebab-case verb-noun, contoh `create-shipment.bru`, `get-shipment-by-id.bru`, `list-drivers.bru`.
- `environments/*.bru` cuma boleh isi base URL & nama variable — **JANGAN PERNAH** commit token/API key/secret asli di sini. Kalau butuh auth, pakai Bruno runtime variable yang di-load dari `.env` lokal (sama prinsipnya kayak `infra/environments/*.env`).
- Collection ini dipakai buat testing manual/exploratory harian, **bukan pengganti** automated test (unit/integration/contract tetap wajib — lihat Testing Strategy di `AGENTS.md`).

---

## 7. `deployment/`, `runbooks/`

- **`deployment/`** — cara jalankan tiap service, environment variable, dependency antar `infra/` (Kafka, MongoDB, Neo4j, Redis, Qdrant).
- **`runbooks/`** — SOP saat ada insiden (mis: Kafka consumer lag, model inference timeout, agent loop tak berhenti).

---

## 8. Konvensi Penamaan

| Jenis dokumen | Format nama |
|---|---|
| ADR | `NNNN-judul-singkat.md` (increment global) |
| Spec | `SPEC-NNN-judul-fitur.md` (increment per folder domain) |
| Sprint log | `sprint-YYYY-MM-X.md` |
| Event contract | `<topic.name.dot.case>.md` |
| Bruno request | `<verb>-<noun>.bru` (kebab-case, contoh: `create-shipment.bru`) |

Semua nomor (`NNNN`, `NNN`) **tidak boleh dipakai ulang** meski dokumennya di-deprecate — pakai status `Deprecated`/`Superseded`, jangan hapus/rename nomor.

---

## 9. Alur Kerja Mingguan (disarankan)

1. **Senin** — review `progress/plan/roadmap.md`, buat/update sprint file di `progress/plan/sprints/`.
2. **Sepanjang sprint** — setiap kali status berubah, update tabel di `progress/data/`, `progress/ml/`, atau `progress/agent/` yang relevan (bukan menunggu akhir sprint).
3. **Sebelum mulai fitur baru** — cek apakah sudah ada file di `specifications/`; kalau belum, tulis dulu sebelum coding.
4. **Setiap mengubah interface antar service** — update `contracts/` + `contracts/CHANGELOG.md` + request Bruno terkait di `api/bruno/`, sebelum merge, bukan setelahnya.
5. **Sebelum merge PR yang menyentuh endpoint** — jalankan request Bruno terkait minimal sekali secara manual buat sanity check, di luar automated test.
6. **Jumat / akhir sprint** — isi bagian retro di sprint file.

---

## 10. Ownership Matrix

| Folder | Penanggung jawab utama |
|---|---|
| `architecture/` | Tech lead / seluruh tim (perlu konsensus) |
| `specifications/data` | Pemilik service `data` (Go) |
| `specifications/ml` | Pemilik service `ai` (FastAPI/ML) |
| `specifications/agent` | Pemilik service `agent` (Hono/LangGraph) |
| `contracts/` | Wajib disetujui semua service yang terdampak |
| `api/generated/` | Auto-generated, tidak ada owner manual (source-nya `contracts/rest/`) |
| `api/bruno/` | Masing-masing owner service, untuk sub-folder collection-nya sendiri |
| `progress/*` | Update oleh masing-masing owner, direview tech lead saat sprint review |

---

## 11. Referensi Pendekatan

Struktur ini mengadaptasi (bukan copy mentah) beberapa praktik yang umum dipakai:
- **ADR** — format Michael Nygard, dipakai luas termasuk di banyak tim platform engineering.
- **Design doc / spec-first** — pola yang dipakai Google dan banyak perusahaan berbasis engineering-heavy.
- **Contract-first API design** — standar umum di arsitektur microservice untuk menghindari integration hell.
- **Model registry & eksperimen tracking** — pola umum di tim MLOps untuk memisahkan progress model dari progress fitur biasa.
- **Bruno collection sebagai living documentation** — pola umum tim yang mau API testing tetap git-friendly dan versioned, tanpa bergantung ke tool cloud-based.

Dokumen ini sendiri sebaiknya di-review ulang tiap kuartal — kalau strukturnya mulai terasa berat atau ada folder yang tidak pernah dipakai, sederhanakan, jangan dipertahankan demi kerapian di atas kertas.