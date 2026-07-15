# ADR-002 — M6 sebagai deterministic orchestration core di `agent` (LangGraph ditunda)

- **Status:** Accepted
- **Tanggal:** 2026-07-15
- **Konteks plan:** Phase 0 (keputusan) · Phase 3 (implementasi M6 di `agent`)
- **Terkait:** `docs/models/M6_MultiAgent_Orchestration.md` · [ADR-003](ADR-003-demo-scope-exclusions.md) · `docs/contracts/rest/v1.md` §A3

## Konteks

AGENTS.md mendeskripsikan `agent` sebagai **Hono + LangGraph** (AI orchestration, RAG, tool calling,
MCP). Kondisi nyata: `services/agent/src/index.ts` masih `Hello Hono!` satu file — tidak ada
LangGraph, tidak ada `src/adapters`.

M6 sendiri, menurut desainnya, adalah orkestrasi **7 langkah berurutan** dengan satu percabangan:

```
1. GET  ai/internal/m2/dwell    (dwell + conf_m2)
2. POST ai/internal/m1/eta      (inject dwell_p50 → fitur ke-10)
3. POST ai/internal/m3/carbon
4. GET  ai/internal/m4/routes   (precomputed Pareto + cs_m4)
5. POST ai/internal/m5/explain  (HANYA jika WARNING/CRITICAL)   ← satu-satunya conditional
6. confidence = 0.40·conf_m1 + 0.15·conf_m2 + 0.25·cs_m4 + 0.10·data_freshness + 0.10·audit_validity
7. confidence ≥ 0.70 → AUTO_EXECUTE | < 0.70 → ESCALATE
```

Fakta paling menentukan: **tidak ada LLM di jalur keputusan ini.** Rute tidak pernah dipilih oleh
model bahasa — ia dipilih oleh Pareto set M4 + guardrail. Confidence adalah aritmatika berbobot.
Threshold adalah konstanta. Ini memang desainnya, bukan penyederhanaan.

## Keputusan

**M6 diimplementasikan sebagai deterministic orchestration core di `agent` (TypeScript biasa),
dengan struktur node yang mengikuti desain graph LangGraph. Adopsi LangGraph ditunda ke final.**

Konkretnya (Phase 3): `src/orchestration/decide.ts` berisi node berurutan —
`fetch dwell → eta → carbon → routes → (conditional) explain → confidence → branch`.
Tiap langkah = satu fungsi murni dengan input/output eksplisit, sehingga pemetaan 1:1 ke node
LangGraph tetap terjaga.

## Alasan

1. **LLM tidak pernah memutuskan rute** — sesuai desain M6. Graph engine dengan state machine,
   checkpointer, dan retry policy menyelesaikan masalah yang **belum kita punya**.
2. **Deterministik = bisa di-golden-test.** Alur yang sama, input sama → output sama. Ini juga yang
   membuat demo bisa diulang tanpa kejutan — properti yang jauh lebih berharga daripada
   nama framework di slide.
3. **Anggaran waktu.** 2.5 hari, solo. Belajar/menyetel LangGraph adalah risiko tanpa imbalan
   fungsional untuk demo.
4. **Struktur node dipertahankan** → migrasi ke LangGraph nanti adalah pekerjaan mekanis, bukan
   penulisan ulang. Utangnya kecil dan diketahui.

## Konsekuensi

**Positif**
- M6 bisa di-unit-test tanpa dependency framework; latency budget lebih mudah dijaga.
- Tidak ada kejutan runtime dari abstraksi graph di jalur demo.

**Negatif / utang**
- Klaim "LangGraph" di AGENTS.md **belum benar** sampai final — jangan dinarasikan di video seolah
  sudah ada. Yang jujur: *"deterministic orchestration core, struktur node mengikuti desain LangGraph."*
- Fitur yang datang gratis dari LangGraph (checkpointing, replay, streaming state) harus ditulis
  tangan kalau nanti dibutuhkan.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Pakai LangGraph sekarang | Risiko belajar/tuning tanpa imbalan fungsional; tidak ada LLM di jalur keputusan. |
| M6 di-embed di FastAPI `ai` | Kontrak §A3 memang membolehkan, tapi mencampur "penyaji model" dengan "pengambil keputusan" → merusak batas service yang sudah benar. |
| M6 di FE (orkestrasi di browser) | Rahasia bisnis + bobot confidence bocor ke klien; tak bisa diaudit. |
