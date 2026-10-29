/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Public demo: fictitious dataset, served from ambrealison.github.io/altera-trajectory/.
// Client version (mode "client"): a private repository copies its dataset into src/data/client/
// (never committed here); relative asset paths let it be served from any address.
export default defineConfig(({ mode }) => {
  const client = mode === "client";
  return {
    base: client ? "./" : "/altera-trajectory/",
    plugins: [react()],
    resolve: {
      alias: {
        "@dataset": fileURLToPath(new URL(client ? "./src/data/client/dataset.ts" : "./src/data/publicDataset.ts", import.meta.url)),
      },
    },
    build: { outDir: "dist", assetsInlineLimit: 0 },
    // The client version runs its own checks only; the public tests assume the fictitious dataset.
    test: client
      ? { include: ["src/data/client/**/*.test.ts"] }
      : { include: ["src/**/*.test.ts"], exclude: ["src/data/client/**", "node_modules/**"] },
  };
});
