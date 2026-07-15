import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { api } from "./routes/shipments.js";
import { initAudit } from "./orchestration/decide.js";
import { CONFIG } from "./config.js";

const app = new Hono();
app.get("/health", c => c.json({ status: "ok", service: "slara-agent", threshold: CONFIG.threshold }));
app.route("/api/v1", api);

await initAudit();
serve({ fetch: app.fetch, port: CONFIG.port });
console.log(`SLAra agent (M6) di :${CONFIG.port} -> ai: ${CONFIG.aiBase}`);
