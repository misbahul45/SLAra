export const CONFIG = {
  aiBase: process.env.AI_BASE_URL ?? "http://localhost:8000",
  port: Number(process.env.PORT ?? 3000),
  threshold: 0.70,
  weights: { conf_m1: 0.40, conf_m2: 0.15, cs_m4: 0.25, data_freshness: 0.10, audit_validity: 0.10 },
  // kalibrasi (ADR-005): sensitivitas deadline & toleransi dwell operasional
  slackSigmoidScaleMin: 30,     // conf_m1 deadline term: sigmoid(slack_p90 / 30)
  dwellToleranceMin: 45,        // conf_m2 situational: exp(-max(0, p90-45)/40)
  dwellDecayMin: 40,
  dataFreshness: 0.92,          // telemetry granularity 1 jam
  m4DwellBakedP50: 12.0,        // dwell yang sudah terpanggang di leg pertama M4
  m4DwellBakedP90: 21.6,
  m4Scenario: "jabodetabek_urban_sameday",
  aiTimeoutMs: 5000,
} as const;
export type ComponentKey = keyof typeof CONFIG.weights;
