"""SLAra AI service — serving M1-M5. Jalankan: uv run uvicorn app.main:app --port 8000"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from _incoming.services_ai.app.api.internal import router as internal_router
from _incoming.services_ai.app.core.artifacts import ART, load_all
from _incoming.services_ai.app.ml import m5

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("ai.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all()
    m5.init()
    log.info("Startup selesai. M5 additivity: %s | M2 mode: %s",
             "PASS" if ART.m5_additivity_ok else "FAIL",
             "FULL" if ART.m2_available else "DEGRADED")
    yield


app = FastAPI(title="SLAra AI Service", version="1.0.0", lifespan=lifespan)
app.include_router(internal_router)


@app.middleware("http")
async def latency_log(request: Request, call_next):
    t0 = time.perf_counter()
    resp = await call_next(request)
    resp.headers["X-Latency-Ms"] = f"{(time.perf_counter() - t0) * 1000:.2f}"
    return resp


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "models": {
            "m1": {"loaded": ART.m1_p50 is not None,
                   "version": ART.m1_config.get("version"),
                   "thresholds": ART.m1_thresholds},
            "m2": {"loaded": ART.m2_available,
                   "mode": "FULL" if ART.m2_available else "DEGRADED"},
            "m3": {"loaded": True, "type": "rule-based"},
            "m4": {"loaded": len(ART.m4_scenarios) > 0,
                   "scenarios": list(ART.m4_scenarios)},
            "m5": {"loaded": ART.m5_explainer is not None,
                   "additivity_ok": ART.m5_additivity_ok,
                   "explains": "m1_eta_v2_p90"},
        },
    }
