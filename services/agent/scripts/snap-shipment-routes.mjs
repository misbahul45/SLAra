// Precompute per-shipment road geometry (build-time, run once).
//
// Kontrak §A3 (FROZEN) mendefinisikan `routes[].geometry` di /decide sebagai jalur
// per-shipment origin→destination. Implementasi lama me-reuse geometri TUR M4
// (Hub Cibitung, 16 stop) untuk semua shipment → garis tidak nyambung dengan marker
// start/finish dan identik untuk 12 shipment. Skrip ini memulihkan niat kontrak:
// ambil jalur jalan nyata (OSRM `route`, alternatives) per shipment, simpan ke
// data/shipment_routes.json — agent memuatnya saat startup (tanpa OSRM runtime,
// pola sama dengan ADR-004).
//
// OSRM alternatives bersifat best-effort (rute intra-kota sering hanya 1–2 jalur
// masuk akal). Kandidat ke-i memakai alternatif ke-min(i, n-1) — kalau jalurnya
// memang satu, ketiga kandidat menggambar jalur yang sama (jujur: yang membedakan
// kandidat adalah metrik plan, bukan jalan yang ditempuh leg ini).
//
// Jalankan (dari services/agent/):
//   node scripts/snap-shipment-routes.mjs
//   node scripts/snap-shipment-routes.mjs http://localhost:5000   # OSRM self-host
import { readFileSync, writeFileSync } from "node:fs";

const SERVER = process.argv[2] ?? "https://router.project-osrm.org";
const shipmentsUrl = new URL("../data/shipments.json", import.meta.url);
const outUrl = new URL("../data/shipment_routes.json", import.meta.url);

const shipments = JSON.parse(readFileSync(shipmentsUrl, "utf-8"));
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const routes = {};
for (const s of shipments) {
  const o = s.origin_hub, d = s.destination;
  const url = `${SERVER}/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}`
    + `?alternatives=3&overview=simplified&geometries=geojson&continue_straight=false`;
  const payload = await (await fetch(url)).json();
  if (payload.code !== "Ok") throw new Error(`${s.shipment_id}: OSRM code=${payload.code}`);
  routes[s.shipment_id] = {
    // GeoJSON [lng,lat] -> [lat,lng] (urutan kontrak §A3)
    alternatives: payload.routes.map((rt) =>
      rt.geometry.coordinates.map(([lng, lat]) => [r5(lat), r5(lng)])),
    osrm_distance_km: payload.routes.map((rt) => +(rt.distance / 1000).toFixed(1)),
    osrm_duration_min: payload.routes.map((rt) => +(rt.duration / 60).toFixed(1)),
  };
  const alt = routes[s.shipment_id];
  console.log(`  ${s.shipment_id}: ${alt.alternatives.length} alt, `
    + `pts=[${alt.alternatives.map((a) => a.length)}], km=[${alt.osrm_distance_km}]`);
  await sleep(1000); // sopan ke server publik
}

writeFileSync(outUrl, JSON.stringify({
  source: "OSRM /route driving, alternatives=3, overview=simplified (precomputed build-time)",
  generated_at: new Date().toISOString(),
  routes,
}, null, 1));
console.log(`Wrote data/shipment_routes.json (${Object.keys(routes).length} shipments)`);
