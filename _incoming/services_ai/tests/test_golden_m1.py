"""Golden test: endpoint /internal/m1/eta HARUS identik dgn m1_v2_inference.py.

Nilai expected diambil dari smoke test helper asli (14 Jul):
  urban dekat      -> 24.8 / 33.9  SAFE     conf 0.817
  same-day jauh    -> 130.2 / 137.8 CRITICAL conf 0.971
  ekstrem          -> 281.8 / 291.8 CRITICAL conf 0.982
"""
import pytest
from fastapi.testclient import TestClient

from _incoming.services_ai.app.main import app

CASES = [
    (dict(distance_km=6.0, weather_severity=0, traffic_index=0.8, vehicle_type_encoded=0,
          pickup_hour=10, hub_dwell_time_predicted=7.0, promised_deadline=55.0),
     24.8, 33.9, "SAFE", 0.817),
    (dict(distance_km=32.0, weather_severity=1, traffic_index=1.3, vehicle_type_encoded=1,
          pickup_hour=17, hub_dwell_time_predicted=14.0, promised_deadline=85.0),
     130.2, 137.8, "CRITICAL", 0.971),
    (dict(distance_km=45.0, weather_severity=2, traffic_index=1.8, vehicle_type_encoded=2,
          pickup_hour=18, hub_dwell_time_predicted=18.0, promised_deadline=120.0),
     281.8, 291.8, "CRITICAL", 0.982),
]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("payload,p50,p90,tier,conf", CASES)
def test_golden(client, payload, p50, p90, tier, conf):
    r = client.post("/internal/m1/eta", json=payload)
    assert r.status_code == 200, r.text
    out = r.json()
    assert abs(out["eta_p50_min"] - p50) < 0.15
    assert abs(out["eta_p90_min"] - p90) < 0.15
    assert out["risk_tier"] == tier
    assert abs(out["conf_m1"] - conf) < 0.005


def test_health_and_m5_additivity(client):
    h = client.get("/health").json()
    assert h["models"]["m1"]["loaded"] and h["models"]["m4"]["loaded"]
    assert h["models"]["m5"]["additivity_ok"] is True
