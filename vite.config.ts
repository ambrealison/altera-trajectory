/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Public demo: fictitious dataset, served from ambrealison.github.io/altera-trajectory/.
// Retailer version (mode "u"): the private repository copies its dataset into src/data/u/ (never
// committed here) and serves the build from /altera-trajectory-U/.
export default defineConfig(({ mode }) => {
  const u = mode === "u";
  return {
    base: u ? "/altera-trajectory-U/" : "/altera-trajectory/",
    plugins: [react()],
    resolve: {
      alias: {
        "@dataset": fileURLToPath(new URL(u ? "./src/data/u/dataset.ts" : "./src/data/publicDataset.ts", import.meta.url)),
      },
    },
    build: { outDir: "dist", assetsInlineLimit: 0 },
    // The retailer version runs its own checks only; the public tests assume the fictitious dataset.
    test: u
      ? { include: ["src/data/u/**/*.test.ts"] }
      : { include: ["src/**/*.test.ts"], exclude: ["src/data/u/**", "node_modules/**"] },
  };
});
