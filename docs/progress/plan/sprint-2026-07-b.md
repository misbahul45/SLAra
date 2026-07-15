
# Sprint 2026-07-B (14–25 Juli)

## Fokus

Remediasi **startup & health Docker dev stack** agar demo path (`gateway`, `agent`, `data`, `ai`, `app`, `kafka`) `healthy` dan `gateway` bisa di-boot. `mongodb`/`neo4j`/`redis`/`qdrant` di-disable per ADR-003 (bukan lagi 10/10 container). Mengikuti `docs/specifications/platform/SPEC-001-docker-dev-startup-health.md` dan keputusan `docs/architecture/adr/0003-gateway-dev-mode-strategy.md`.

Fase ini **hanya planning + dokumentasi** (analysing → planning). Implementasi kode (Dockerfile/compose/nginx) dilakukan setelah spec & ADR di-review.

## Komitmen

| Item | Service | Owner | Status | Ref |
|---|---|---|---|---|
| B1 — Qdrant healthcheck pakai bash `/dev/tcp` | platform | Platform | 🟡 In Progress (spec) | SPEC-001 §5.1 |
| B2 — Override healthcheck `app` di dev overlay | platform | Platform | 🟡 | SPEC-001 §5.1 |
| B3 — Strategi nginx dev (Opsi A) | platform | Tech lead | 🟡 (ADR Proposed) | ADR-0003 |
| S3 — Bind `app` via `vite.config.ts` | app | Platform | 🔴 | SPEC-001 §5.2 |
| H3 — `pnpm-workspace.yaml` di prod agent Dockerfile | agent | Agent | 🔴 | SPEC-001 §5.4 |
| D1 — Sinkronkan runbook ke `check-health.sh` | docs | Platform | 🔴 | SPEC-001 §5.3 |
| D2 — Commit `infra/check-health.sh` | infra | Platform | 🔴 | SPEC-001 §5.3 |
| H1 — Dokumentasikan script di AGENTS.md / infra README | docs | Platform | 🔴 | SPEC-001 §5.4 |
| S1/S2 — Verifikasi race `initial_sync` (U4) | data, ai | Platform | ⏸️ Blocked (butuh runtime) | SPEC-001 §8 U4 |
| H2 — Pin tag infra image | platform | Platform | 🔴 | SPEC-001 §5.4 |
| H4 — Verifikasi `python:3.14` / `golang:1.25` (U2) | data, ai | Platform | ⏸️ Blocked (butuh Docker Hub) | SPEC-001 §8 U2 |

## Dependensi & Urutan

1. B1 + B2 + B3 (blocker, buka jalur `gateway` start) — harus bersamaan.
2. S3 (reliabilitas app reachable).
3. H3 (hindari break prod).
4. D1 + D2 + H1 (dokumentasi & recoverability).
5. H2 / H4 (paralel, butuh akses eksternal).

## Exit Criteria (Sprint Done)

- 🟢 `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build` → demo path `healthy` (6/6: gateway, agent, data, ai, app, kafka). `mongodb`/`neo4j`/`redis`/`qdrant` di-disable per ADR-003.
- 🟢 `curl -s http://localhost/` → 200 (bukan 502).
- 🟢 `bash infra/check-health.sh --gateway-only` → all pass.
- 🟢 ADR-0003 → Accepted.

## Hasil Retro

- _(diisi akhir sprint)_
