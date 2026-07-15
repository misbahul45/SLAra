"""M3 — Carbon accounting, rule-based (metodologi GLEC/ISO 14083, EF distance-based).

Interface final sesuai dokumen M3: (distance, vehicle, load) -> co2_kg.
EF (kg CO2e/km) konsisten dengan yang dipakai M4 & generator demo.
"""
EMISSION_FACTORS = {
    'MOTORCYCLE': 0.029,
    'VAN': 0.18,
    'TRUCK_CDE': 0.32,
    'TRUCK_CDD': 0.45,
}


def compute(distance_km: float, vehicle_type: str, load_kg: float = 0.0) -> dict:
    vt = vehicle_type.upper()
    if vt not in EMISSION_FACTORS:
        raise ValueError(f"vehicle_type tidak dikenal: {vehicle_type}")
    ef = EMISSION_FACTORS[vt]
    co2 = distance_km * ef * (1.0 + max(0.0, load_kg) / 1000.0)
    return {
        'co2_kg': round(co2, 3),
        'emission_factor_kg_per_km': ef,
        'method': 'distance-based EF, load-adjusted (GLEC/ISO 14083 aligned)',
    }
