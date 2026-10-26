/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Public build: fictitious data, served from ambrealison.github.io/altera-trajectory/.
// Private build (mode "real"): the dataset in src/data/real/ (git-ignored), relative paths, own folder.
export default defineConfig(({ mode }) => {
  const real = mode === "real";
  return {
    base: real ? "./" : "/altera-trajectory/",
    plugins: [react()],
    resolve: {
      alias: {
        "@dataset": fileURLToPath(new URL(real ? "./src/data/real/dataset.ts" : "./src/data/fictitiousDataset.ts", import.meta.url)),
      },
    },
    build: { outDir: real ? "dist-real" : "dist", assetsInlineLimit: 0 },
    test: { include: ["src/**/*.test.ts"] },
  };
});
