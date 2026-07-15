import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Agent (M6) untuk proxy dev. Di target topology, nginx gateway yang menyatukan
// origin; di dev, proxy ini perannya sama.
const AGENT_ORIGIN = process.env.AGENT_ORIGIN ?? "http://localhost:3000";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    // Bind ke 0.0.0.0 supaya reachable dari docker network (bukan cuma loopback container).
    host: "0.0.0.0",
    // Browser memanggil /api/v1/* same-origin -> tidak kena CORS preflight. Agent
    // sengaja tidak dikasih header CORS: di produksi request lewat gateway, jadi
    // CORS itu artefak dev semata. Fetch sisi SSR tetap absolut (lihat lib/api.ts).
    proxy: {
      "/api/v1": {
        target: AGENT_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
