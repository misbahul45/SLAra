"""Artifact loader — dipanggil sekali saat startup (lifespan).

Kebijakan:
- M1 & M4: fail-fast. Tanpa mereka /decide tidak bermakna (sesuai failure cascade design).
- M2: degraded-tolerant. Model hilang -> fallback historical median, m2_degraded=True
  (sesuai desain: M2 down = degradasi anggun, bukan outage).
- M5: dibangun dari booster M1 P90; additivity check saat startup.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

import lightgbm as lgb
import yaml

log = logging.getLogger("ai.artifacts")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _p(*parts: str) -> str:
    return os.path.join(BASE_DIR, *parts)


def _load_yaml_maybe(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return yaml.safe_load(f)


@dataclass
class Artifacts:
    # M1
    m1_p50: lgb.Booster = None
    m1_p90: lgb.Booster = None
    m1_thresholds: dict = field(default_factory=dict)
    m1_config: dict = field(default_factory=dict)
    # M2
    m2_p50: Optional[lgb.Booster] = None
    m2_p90: Optional[lgb.Booster] = None
    m2_target_encoding: dict = field(default_factory=dict)
    m2_hist_median: dict = field(default_factory=dict)
    m2_confidence: dict = field(default_factory=dict)
    m2_available: bool = False
    # M4
    m4_scenarios: dict[str, Any] = field(default_factory=dict)
    # telemetry mock
    hub_telemetry: dict = field(default_factory=dict)
    # M5 (diisi oleh ml.m5 saat startup)
    m5_explainer: Any = None
    m5_additivity_ok: bool = False


ART = Artifacts()


def load_all() -> Artifacts:
    # ---------- M1 (fail-fast) ----------
    ART.m1_p50 = lgb.Booster(model_file=_p("models", "m1", "m1_eta_v2_p50.txt"))
    ART.m1_p90 = lgb.Booster(model_file=_p("models", "m1", "m1_eta_v2_p90.txt"))
    ART.m1_thresholds = _load_yaml_maybe(_p("configs", "m1", "risk_thresholds.yaml"))
    ART.m1_config = _load_yaml_maybe(_p("configs", "m1", "model_config.yaml")) or {}
    if not ART.m1_thresholds:
        raise RuntimeError("configs/m1/risk_thresholds.yaml wajib ada (fail-fast M1)")
    log.info("M1 loaded: dual quantile + thresholds %s", ART.m1_thresholds)

    # ---------- M2 (degraded-tolerant) ----------
    p50_path = _p("models", "m2", "m2_dwell_p50.txt")
    p90_path = _p("models", "m2", "m2_dwell_p90.txt")
    if os.path.exists(p50_path) and os.path.exists(p90_path):
        ART.m2_p50 = lgb.Booster(model_file=p50_path)
        ART.m2_p90 = lgb.Booster(model_file=p90_path)
        ART.m2_available = True
        log.info("M2 loaded: dual quantile")
    else:
        log.warning("M2 model TIDAK ditemukan di models/m2/ -> serving degraded (historical median)")
    ART.m2_target_encoding = _load_yaml_maybe(_p("configs", "m2", "hub_target_encoding.yaml")) or {}
    ART.m2_hist_median = _load_yaml_maybe(_p("configs", "m2", "hub_historical_median.yaml")) or {}
    ART.m2_confidence = _load_yaml_maybe(_p("configs", "m2", "coverage_confidence.yaml")) or {}

    # ---------- M4 (fail-fast) ----------
    m4_path = _p("data", "pareto_routes_jabodetabek_urban.json")
    with open(m4_path) as f:
        sc = json.load(f)
    ART.m4_scenarios[sc["scenario"]["id"]] = sc
    log.info("M4 loaded: %s (%d kandidat, cs_m4=%s)",
             sc["scenario"]["id"], len(sc["candidates"]), sc["cs_m4"])

    # ---------- Hub telemetry mock ----------
    tel_path = _p("data", "hub_telemetry.json")
    if os.path.exists(tel_path):
        with open(tel_path) as f:
            ART.hub_telemetry = json.load(f)
        log.info("Hub telemetry mock: %d hub", len(ART.hub_telemetry))

    return ART
