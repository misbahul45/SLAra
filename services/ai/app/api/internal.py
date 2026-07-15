"""Endpoint internal M1-M5 — kontrak docs/contracts/rest/v1.md §B."""
from __future__ import annotations

import time

from app.ml import m1, m2, m3
from fastapi import APIRouter, HTTPException, Query

from app.core.artifacts import ART
from app.ml import m5
from app.schemas import M1EtaRequest, M2DwellRequest, M3CarbonRequest, M5ExplainRequest

router = APIRouter(prefix="/internal")


def _timed(payload: dict, t0: float) -> dict:
    payload.setdefault("latency_ms", round((time.perf_counter() - t0) * 1000, 2))
    return payload


@router.post("/m1/eta")
def m1_eta(req: M1EtaRequest) -> dict:
    t0 = time.perf_counter()
    return _timed(m1.predict(req.model_dump()), t0)


@router.post("/m2/dwell")
def m2_dwell(req: M2DwellRequest) -> dict:
    return m2.predict(req.hub_id, req.condition, req.overrides)


@router.post("/m3/carbon")
def m3_carbon(req: M3CarbonRequest) -> dict:
    t0 = time.perf_counter()
    return _timed(m3.compute(req.distance_km, req.vehicle_type, req.load_kg), t0)


@router.get("/m4/routes")
def m4_routes(scenario: str = Query(default="jabodetabek_urban_sameday")) -> dict:
    sc = ART.m4_scenarios.get(scenario)
    if sc is None:
        raise HTTPException(404, f"scenario '{scenario}' tidak ditemukan; tersedia: {list(ART.m4_scenarios)}")
    return sc


@router.post("/m5/explain")
def m5_explain(req: M5ExplainRequest) -> dict:
    t0 = time.perf_counter()
    return _timed(m5.explain(req.model_dump()), t0)
