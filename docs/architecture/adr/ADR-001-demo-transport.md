# ADR-001 — Demo transport: gateway-first dengan fallback direct-port

- **Status:** Accepted
- **Tanggal:** 2026-07-15
- **Konteks plan:** Phase 0 · Deadline keras 17 Jul 2026 (video submit)
- **Terkait:** [ADR-003](ADR-003-demo-scope-exclusions.md) · `infra/docker-compose*.yml` · `services/gateway/nginx.conf`

## Konteks

Topologi target: `Browser → Nginx gateway :80 → { agent :3000, ai :8000, data :8081 }`. Gateway
adalah kontrak arsitektur yang benar dan sudah ter-set di `infra/docker-compose.yml`.

Tapi audit Docker 14 Jul menemukan rantai kegagalan yang menyentuh persis jalur ini:

- **B1** — healthcheck `qdrant` memakai `wget`, yang tidak ada di image → qdrant `unhealthy`.
- **Cascade** — `agent` `depends_on` qdrant `service_healthy` → agent tak pernah start →
  gateway `depends_on` agent → **gateway tak pernah start**.
- **B2** — healthcheck `app` di dev menembak port 3000, padahal Vite dengar di 5173 → `app`
  unhealthy → **B3**: gateway tak pernah healthy di dev.

Artinya: satu healthcheck salah di dependency yang **bukan bagian demo path** bisa menjatuhkan
seluruh demo. Waktu efektif tersisa ~2.5 hari kerja, solo.

## Keputusan

**Gateway-first, dengan fallback direct-port yang sudah disiapkan sebelum dibutuhkan.**

1. **Jalur utama (gateway):** FE memakai `VITE_API_BASE` → `/api/agent/v1` lewat gateway :80.
   Ini yang didemokan kalau stack compose naik.
2. **Fallback (direct-port):** FE memakai `VITE_API_BASE` → `http://localhost:3000` (agent) dan
   `http://localhost:8000` (ai) langsung; `uvicorn` + `pnpm dev` jalan di host tanpa compose.
3. **Perbedaan keduanya hanya nilai satu environment variable** — bukan perubahan kode. Ini yang
   membuat fallback murah dan tidak berisiko.

### Kondisi trigger fallback (eksplisit, supaya tidak jadi debat saat panik)

Fallback diambil kalau **salah satu** terpenuhi:

- Setelah R1–R4 (fix B1/B2/B3/S3) dieksekusi, stack compose masih tidak naik dalam **>30 menit**.
- Gateway `unhealthy` karena dependency **di luar demo path** (qdrant/kafka/neo4j/mongo).
- Kurang dari 12 jam sebelum deadline dan demo path belum pernah hijau end-to-end.

Escape hatch ini diambil dari plan §Bagian 2: *"Gateway itu demo enhancement, bukan demo requirement."*

## Alasan

- **Yang dinilai adalah keputusan AI-nya (M1–M6), bukan reverse proxy.** Gateway tidak menambah
  satu pun poin kapabilitas ML; ia menambah risiko total kegagalan demo.
- **Biaya fallback ~0, biaya gagal demo = total.** Asimetri ini menentukan keputusan.
- **Gateway tetap jalur utama** karena ia kontrak arsitektur yang benar dan sudah ada di compose —
  menghapusnya justru menciptakan utang yang harus dibayar di final.

## Konsekuensi

**Positif**
- Demo tidak pernah tersandera health dependency yang bukan bagian dari cerita AI.
- Keputusan fallback sudah punya kriteria objektif → tidak ada improvisasi menit terakhir.

**Negatif / utang**
- Kalau fallback dipakai, demo tidak membuktikan jalur gateway → **harus** dibuktikan sebelum final.
- CORS: pada direct-port, browser memanggil origin berbeda (`:5173` → `:3000`/`:8000`) sehingga
  agent/ai perlu CORS permisif untuk dev. Di jalur gateway hal ini tidak muncul (same-origin).
  **Ini beda perilaku nyata antara dua jalur** — jangan sampai ketahuan pertama kali saat demo.
- Dua jalur = dua konfigurasi yang harus sama-sama dijaga sampai final.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Gateway-only (perbaiki compose sampai benar) | Waktu tidak terbatas — asumsinya semua fix selesai tepat waktu. Risiko total. |
| Direct-port-only (buang gateway dari demo) | Membuang kerja infra yang sudah ada + menciptakan utang arsitektur; gateway hampir jadi. |
| Tunnel/ngrok ke tiap service | Menambah dependency eksternal + latensi di jalur demo. Tidak menyelesaikan apa pun. |
