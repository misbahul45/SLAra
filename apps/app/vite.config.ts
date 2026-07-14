import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    // Bind ke 0.0.0.0 supaya reachable dari docker network (bukan cuma loopback container).
    host: "0.0.0.0",
  },
  resolve: {
    tsconfigPaths: true,
  },
});
