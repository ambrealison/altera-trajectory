/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from ambrealison.github.io/altera-trajectory/
export default defineConfig({
  base: "/altera-trajectory/",
  plugins: [react()],
  build: { outDir: "dist", assetsInlineLimit: 0 },
  test: { include: ["src/**/*.test.ts"] },
});
