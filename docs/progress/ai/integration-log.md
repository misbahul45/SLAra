# Integration Log — services/ai (M1 v2 + M2 + M4 + M5)

> Catatan kronologis integrasi deliverable ML ke `services/ai`. Tujuan dokumen ini: siapa pun yang
> baca ulang repo bisa paham **apa yang dipindah, kenapa ada deviasi dari rencana, dan angka
> verifikasi apa yang benar-benar diobservasi** — bukan yang diasumsikan.
>
> Tanggal: 2026-07-15 · Branch: `dev` · Verifikasi dijalankan di host Windows (bukan container).

---

## 1. Penempatan deliverable

Sumber staging: `_incoming/` (dihapus di akhir integrasi — isinya sudah pindah semua).

| Deliverable | Tujuan | Catatan |
|---|---|---|
| `services_ai/app/` (api, core, ml, main, schemas) | `services/ai/app/` | menggantikan scaffold `Hello from ml!` |
| `services_ai/tests/` | `services/ai/tests/` | golden test M1 + additivity M5 |
| `services_ai/data/*.json` | `services/ai/data/` | `hub_telemetry.json`, Pareto M4 |
| `m2_artifacts/models/*` | `services/ai/models/m2/` | `m2_dwell_p50.txt`, `m2_dwell_p90.txt` |
| `m2_artifacts/configs/*` | `services/ai/configs/m2/` | target encoding, historical median, coverage |
| `m1v2_artifacts/models/*` | `services/ai/models/m1/` | sudah identik dengan yang ter-commit (checksum SAMA) |
| `m4_artifacts/M4_RESULTS.md` | `docs/models/evidence/M4_RESULTS.md` | bukti hasil |
| `m4_artifacts/m4_nsga2.py` | `services/ai/experiments/m4_nsga2.py` | **bukti engine, bukan runtime path** (ADR-004) |

### Scaffold lama yang dihapus
`main.py` (root), `app/config/init_model.py`, `app/config/init_env.py`, `Readme.md` (tree aspiratif).
File Docker dipertahankan sesuai instruksi: `Dockerfile`, `Dockerfile.dev`, `.dockerignore`, `.python-version`.

### Dedup Pareto M4
Tiga salinan `pareto_routes_jabodetabek_urban.json` dibandingkan dengan MD5 — **ketiganya identik**
(`8d06fa7c227fc53ce973c7e62f068d02`):

- `_incoming/pareto_routes_jabodetabek_urban.json`
- `_incoming/services_ai/data/pareto_routes_jabodetabek_urban.json`
- `_incoming/m4_artifacts/m4_artifacts/pareto_routes_jabodetabek_urban.json`

Karena identik → salinan `_incoming` dibuang, yang dipakai berasal dari paket `services_ai/data/`.
Tidak ada overwrite yang perlu dilakukan.

---

## 2. Deviasi dari instruksi (semua disengaja, dengan alasan)

Empat hal di bawah **tidak ada di daftar tugas** tapi wajib dilakukan supaya service benar-benar jalan.
Tanpa ini, `uv sync` / `pytest` / container gagal — bukan soal rapi-rapi.

### D1 — Import path di-rewrite dari staging ke `app.*`
Semua modul Python dikirim dengan import berakar di lokasi staging:

```python
from _incoming.services_ai.app.core.artifacts import ART   # sebelum
from app.core.artifacts import ART                          # sesudah
```

11 import di 6 file (`app/main.py`, `app/api/internal.py`, `app/ml/{m1,m2,m5}.py`,
`tests/test_golden_m1.py`). Kalau tidak di-rewrite, `pytest` gagal saat **collection**
(`ModuleNotFoundError: No module named '_incoming'`) — bukan saat assert — dan `_incoming/`
memang dihapus di akhir, jadi import-nya menunjuk folder yang sudah tidak ada.

### D2 — Python 3.14 → 3.12 (`.python-version` + `requires-python`)
`.python-version` mem-pin `3.14`; `uv sync` gagal:

```
RuntimeError: Cannot install on Python version 3.14.6; only versions >=3.6,<3.10 are supported.
hint: `llvmlite` was included because `slara-ai` depends on `shap` which depends on `llvmlite`
```

Sesuai instruksi ("sesuaikan requires-python ke versi lokal ≥3.12, jangan downgrade dependency"):
`.python-version` → `3.12`, `requires-python` → `>=3.12,<3.13` (Python lokal: 3.12.6).
**Tidak ada dependency yang di-downgrade.**

### D3 — `numpy` dibatasi `<2.5` (root cause resolusi numba)
Ini yang paling menipu, jadi dicatat lengkap. Setelah pindah ke 3.12, `uv sync` **masih** gagal:

```
RuntimeError: Cannot install on Python version 3.12.6; only versions >=3.6,<3.10 are supported.
hint: `numba` (v0.53.1) ... because `slara-ai` depends on `shap` (v0.52.0) which depends on `numba`
```

Padahal `uv pip compile` untuk `shap` di 3.12 resolve mulus ke `numba==0.66.0`. Selisihnya:

- `numba` modern mensyaratkan `numpy<2.5`. Tanpa batas atas, uv memilih `numpy==2.5.1` lebih dulu,
  lalu **backtrack numba** sampai `0.53.1` (rilis 2021, metadata numpy longgar, tidak punya wheel
  untuk 3.12) → uv coba build dari sdist → gagal di `_guard_py_ver`.
- Dengan `numpy>=1.26,<2.5`, resolusi ter-**fork** dengan benar (42 → 44 paket):
  `numba==0.66.0` untuk `platform_machine != 'x86_64' or sys_platform != 'darwin'`, dan
  `numba==0.53.1` **hanya** untuk Intel macOS (numba 0.66 memang drop wheel Intel-mac).

Kesimpulan: batas `numpy<2.5` adalah syarat supaya `shap` bisa dipakai di 3.12 — bukan downgrade
model library (`shap` tetap 0.52.0, `lightgbm` tetap 4.6.0).

> **Catatan untuk kontributor macOS Intel**: lock akan memilih `numba 0.53.1` di platform itu dan
> `uv sync` kemungkinan gagal. Dev di Apple Silicon / Linux / Windows tidak terpengaruh.

`uv.lock` lama (punya scaffold `ml`, beda nama paket & dependency) dihapus dan di-generate ulang —
lock itu sempat menyamarkan D3 karena mempertahankan preferensi `numpy 2.5.1` bahkan saat `uv lock --upgrade`.

### D4 — `pythonpath` pytest + entrypoint Docker
- Paket ini *virtual* (tanpa `build-system`), jadi `app/` tidak masuk `sys.path` → `pytest` gagal
  collection. Ditambah `[tool.pytest.ini_options] pythonpath = ["."]` supaya perintah yang
  didokumentasikan (`uv run pytest tests/ -q`) jalan apa adanya.
- `Dockerfile`/`Dockerfile.dev` masih `CMD uvicorn main:app` (menunjuk `main.py` yang sudah dihapus)
  dan base `python:3.14-slim` (inkompatibel dengan shap, lihat D2). Diubah ke `app.main:app` +
  `python:3.12-slim`. File Docker tetap dipertahankan, hanya isinya diselaraskan.

---

## 3. Hasil verifikasi (observasi nyata, bukan klaim)

| Gate | Perintah | Hasil |
|---|---|---|
| 2a | `uv sync` | ✅ 44 paket ter-resolve, terinstal |
| 2b | `uv run pytest tests/ -q` | ✅ **4 passed** (~49s) — test & model tidak disentuh |
| 2c | `uv run uvicorn app.main:app --port 8000` | ✅ `Startup selesai. M5 additivity: PASS \| M2 mode: FULL` (~37s, SHAP init) |
| 2d | `curl localhost:8000/health` | ✅ `m1.loaded=true`, `m2.mode=FULL`, `m4.loaded=true`, `m5.additivity_ok=true` |
| 2e | `POST /internal/m2/dwell` | ✅ lihat tabel di bawah |

### Tes link M2 — `HUB-CGK-02`

| Kondisi | `dwell_p50_minutes` | `dwell_p90_minutes` | queue | dock util | `m2_degraded` |
|---|---|---|---|---|---|
| `normal` | **16.09** | 34.07 | 4 | 0.38 | `false` |
| `congested` | **29.13** | 95.21 | 19 | 0.91 | `false` |

`congested` > `normal` sebesar **+13.04 menit (+81%)**, `m2_degraded: false` di keduanya,
`model_version: m2_v1.0.0-lightgbm-quantile`, `coverage_P90: 0.896`, `model_confidence: 0.95`.

Ini bukti M2 benar-benar FULL: di mode DEGRADED kedua kondisi akan menghasilkan angka **identik**
(keduanya jatuh ke historical median, `p50 = hist_median` tanpa melihat `condition`) — itulah cara
membedakannya tanpa lihat log.

---

## 4. Yang perlu diperhatikan berikutnya

- **`.dockerignore` mengecualikan `models/`** (by design: model di-mount sebagai volume, bukan
  di-bake ke image). Karena `app/core/artifacts.py` **fail-fast** untuk M1/M4, container akan mati
  saat startup kalau `infra/docker-compose.yml` tidak mount `./models`. Dicek di Step 4.
- Verifikasi di atas dijalankan **di host**, belum di dalam container.
