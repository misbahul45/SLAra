"""Pydantic v2 schemas — sesuai docs/contracts/rest/v1.md §B."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class M1EtaRequest(BaseModel):
    distance_km: float = Field(gt=0, le=200)
    weather_severity: int = Field(ge=0, le=3)
    traffic_index: float = Field(ge=0.5, le=3.0)
    is_weekend: int = Field(default=0, ge=0, le=1)
    vehicle_type_encoded: int = Field(ge=0, le=2)
    pickup_hour: int = Field(default=12, ge=0, le=23)
    hub_dwell_time_predicted: float = Field(ge=0, le=180)
    promised_deadline: float = Field(gt=0)


class M2DwellRequest(BaseModel):
    hub_id: str
    condition: Literal["normal", "congested"] = "normal"
    overrides: Optional[dict] = None


class M3CarbonRequest(BaseModel):
    distance_km: float = Field(gt=0)
    vehicle_type: Literal["MOTORCYCLE", "VAN", "TRUCK_CDE", "TRUCK_CDD"]
    load_kg: float = Field(default=0.0, ge=0)


class M5ExplainRequest(M1EtaRequest):
    """Fitur sama dengan M1 — yang dijelaskan adalah prediksi P90 M1."""
