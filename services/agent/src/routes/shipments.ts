import { Hono } from "hono";
import { byId, enrich, kpiSummary, shipments } from "../state.js";
import { decide } from "../orchestration/decide.js";

export const api = new Hono();

api.get("/kpi/summary", async c => { await enrich(); return c.json(kpiSummary()); });

api.get("/shipments", async c => {
  await enrich();
  const tier = c.req.query("tier");
  const list = tier ? shipments.filter(s => s.risk_tier === tier) : shipments;
  return c.json({ shipments: list, total: list.length });
});

api.post("/shipments/:id/decide", async c => {
  const s = byId.get(c.req.param("id"));
  if (!s) return c.json({ error: { code: "NOT_FOUND", message: "shipment tidak ditemukan" } }, 404);
  const out = await decide(s);
  s.decision_status = out.decision === "AUTO_EXECUTE" ? "AUTO_EXECUTED" : "ESCALATED";
  if (out.decision === "AUTO_EXECUTE") s.executed_route_id = out.selected_route_id ?? undefined;
  return c.json(out);
});

api.post("/shipments/:id/resolve", async c => {
  const s = byId.get(c.req.param("id"));
  if (!s) return c.json({ error: { code: "NOT_FOUND", message: "shipment tidak ditemukan" } }, 404);
  const body = await c.req.json<{ action: "APPROVE" | "REJECT"; route_id?: string; operator_note?: string }>();
  s.decision_status = body.action === "APPROVE" ? "APPROVED" : "REJECTED";
  if (body.action === "APPROVE") s.executed_route_id = body.route_id;
  return c.json({ shipment_id: s.shipment_id, decision_status: s.decision_status,
    executed_route_id: s.executed_route_id ?? null, resolved_at: new Date().toISOString() });
});
