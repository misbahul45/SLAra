import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, confM1, confM2, primaryDriver, type Breakdown } from "../src/domain/confidence.js";
import { CONFIG } from "../src/config.js";

test("aggregate = jumlah tertimbang persis (juri bisa verifikasi)", () => {
  const v = { conf_m1: 0.5, conf_m2: 0.8, cs_m4: 0.996, data_freshness: 0.92, audit_validity: 1.0 };
  const expected = 0.4 * 0.5 + 0.15 * 0.8 + 0.25 * 0.996 + 0.1 * 0.92 + 0.1 * 1.0;
  assert.equal(aggregate(v), Math.round(expected * 1000) / 1000);
});

test("bobot berjumlah 1.0", () => {
  const sum = Object.values(CONFIG.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9);
});

test("conf_m1: slack negatif menurunkan confidence, positif menaikkan", () => {
  const tight = confM1(0.93, -20).value;
  const loose = confM1(0.93, +40).value;
  assert.ok(tight < 0.4, `tight=${tight}`);
  assert.ok(loose > 0.7, `loose=${loose}`);
  assert.ok(loose > tight);
});

test("conf_m2: dwell P90 di atas toleransi meluruh eksponensial", () => {
  const normal = confM2(0.9986, 34).value;      // CGK-02 normal
  const congested = confM2(0.9986, 95.7).value; // CGK-02 congested
  assert.ok(normal > 0.9, `normal=${normal}`);
  assert.ok(congested < 0.35, `congested=${congested}`);
});

test("primaryDriver: deadline_pressure saat deadline term < interval term", () => {
  const c1 = confM1(0.95, -25);
  const bd = {
    conf_m1: { value: c1.value, weight: 0.4, label: "", detail: c1.detail },
    conf_m2: { value: 0.9, weight: 0.15, label: "" },
    cs_m4: { value: 0.996, weight: 0.25, label: "" },
    data_freshness: { value: 0.92, weight: 0.1, label: "" },
    audit_validity: { value: 1, weight: 0.1, label: "" },
  } as Breakdown;
  const v = { conf_m1: c1.value, conf_m2: 0.9, cs_m4: 0.996, data_freshness: 0.92, audit_validity: 1 };
  assert.equal(primaryDriver(v, bd), "deadline_pressure");
});

test("failure cascade M2: conf_m2 fallback 0.5 masih bisa AUTO jika sisanya sehat", () => {
  const v = { conf_m1: 0.75, conf_m2: 0.5, cs_m4: 0.996, data_freshness: 0.92, audit_validity: 1.0 };
  const agg = aggregate(v); // 0.3+0.075+0.249+0.092+0.1 = 0.816
  assert.ok(agg >= 0.70 && agg < 0.85, `degradasi anggun, bukan outage: ${agg}`);
});
