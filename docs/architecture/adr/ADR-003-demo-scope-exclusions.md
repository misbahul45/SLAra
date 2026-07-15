# ADR-003 — Kafka, Neo4j, Qdrant, Mongo-penuh, dan `data` service di luar demo path

- **Status:** Accepted
- **Tanggal:** 2026-07-15
- **Konteks plan:** Phase 0 · §1.3 "Di luar demo path (eksplisit)"
- **Terkait:** [ADR-001](ADR-001-demo-transport.md) · [ADR-002](ADR-002-m6-deterministic-core.md) · `AGENTS.md`

## Konteks

AGENTS.md mendeskripsikan platform lengkap: event bus Kafka (KRaft), Neo4j untuk graph, Qdrant untuk
vector/RAG, MongoDB sebagai store utama, dan `data` service (Go) sebagai pemilik business logic
shipment/driver/vehicle/route. Semuanya sudah ter-deklarasi di `infra/docker-compose.yml`.

Kondisi nyata per 15 Jul 2026:

- `services/data` — punya domain entity yang solid (driver, geo, hub, route, shipment, traffic,
  vehicle, weather) tapi belum ada endpoint yang dikonsumsi demo path.
- Tidak ada `shared/events/`, tidak ada schema Kafka, tidak ada producer/consumer.
- Qdrant terpasang tapi tidak ada RAG di jalur keputusan (lihat ADR-002: tidak ada LLM di sana).
- Demo path (plan §1.3) hanya menyentuh: **Browser → gateway → agent (M6) → ai (M1–M5)**.

Audit Docker juga menunjukkan biaya nyata dari komponen yang tidak dipakai: healthcheck qdrant yang
rusak (B1) menjatuhkan agent lalu gateway — **dependency yang tidak dipakai demo tetap bisa
menggagalkan demo** (ini yang memicu ADR-001).

## Keputusan

**Kafka, Neo4j, Qdrant, MongoDB-penuh, dan `data` service dinyatakan DI LUAR demo path.**
Untuk demo, daftar shipment di-serve dari **JSON statis oleh `agent`**.

Ini **keputusan, bukan kelalaian** — dicatat supaya tidak dibaca sebagai pekerjaan yang terlupakan.

Batas yang tegas:
- `agent` **tidak** memanggil `data` service; ia membaca fixture JSON.
- `agent` **tidak** memproduksi/mengonsumsi event Kafka.
- Tidak ada retrieval vector di jalur `/decide`.

## Alasan

1. **Tidak satu pun dari komponen ini mengubah kualitas keputusan yang didemokan.** Nilai produk ada
   di M1–M6: ETA terkalibrasi, dwell, karbon, Pareto rute, SHAP, confidence. Kafka/Neo4j/Qdrant
   adalah masalah *skala & integrasi*, bukan *kecerdasan*.
2. **Setiap komponen aktif menambah permukaan kegagalan** di jalur demo — sudah terbukti lewat B1.
3. **Anggaran waktu** 2.5 hari solo: mengintegrasikan `data` service + event schema butuh berhari-hari
   dan menghasilkan nol tambahan demo.
4. **Batas service tetap benar.** Yang ditunda adalah *integrasi*, bukan *desain*. Entity Go dan
   topologi compose tetap berdiri sebagai jalan ke production.

## Konsekuensi

**Positif**
- Demo path pendek, cepat, dan bisa dites end-to-end berulang kali.
- Jumlah container yang wajib sehat saat demo turun drastis.

**Negatif / utang (semua sadar & tercatat)**
- Klaim "microservices + event-driven" di AGENTS.md **belum terbukti jalan** — narasi video tidak
  boleh menyiratkan Kafka aktif. Yang jujur: *"event-driven architecture is designed and scaffolded;
  the demo path runs synchronously."*
- Shipment dari JSON = tidak ada persistensi, tidak ada write path, tidak ada concurrency nyata.
- `data` service tetap tanpa test dan tanpa konsumen → risiko drift makin besar makin lama ditunda.

## Jalur ke production (urutan yang disarankan)

1. **`data` service dulu** — pindahkan fixture JSON jadi endpoint REST beneran (`GET /shipments`);
   `agent` cukup ganti URL. Perubahan terkecil, nilai terbesar.
2. **MongoDB** sebagai store `data` — write path + persistensi.
3. **Kafka** — mulai dari satu topik nyata (`shipment.created`, `delay.predicted`) dengan schema di
   `shared/events/*.json` sesuai AGENTS.md (wajib `event_id`, `event_type`, `event_version`,
   `occurred_at`, `payload`). Jangan bikin bus dulu tanpa konsumen.
4. **Neo4j** — saat routing butuh graph query lintas hub yang tidak lagi masuk akal di JSON/Mongo.
5. **Qdrant** — saat (dan hanya saat) ada fitur berbasis LLM/RAG yang nyata. Selama tidak ada LLM di
   jalur keputusan (ADR-002), vector DB tidak punya pekerjaan.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Integrasikan `data` service sekarang | Berhari-hari kerja, nol tambahan untuk demo. |
| Buang service/infra yang tak dipakai dari compose | Membuang desain yang benar demi kerapian sesaat; compose adalah kontrak yang dibangun-menuju. |
| Biarkan implisit ("nanti saja") | Justru ini yang bikin gap dibaca sebagai kelalaian. Ditulis supaya jadi keputusan. |
