import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("motion")) return "vendor-motion";
          if (id.includes("zod") || id.includes("hookform"))
            return "vendor-forms";
          if (id.includes("lucide")) return "vendor-icons";
          if (id.includes("react") || id.includes("scheduler"))
            return "vendor-react";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
});
