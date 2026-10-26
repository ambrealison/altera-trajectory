/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Public build: fictitious data, served from ambrealison.github.io/altera-trajectory/.
// Private build (mode "real"): the dataset in src/data/real/ (git-ignored), one self-contained HTML file
// in dist-real/ that opens without a server and is shared privately, never published.
export default defineConfig(({ mode }) => {
  const real = mode === "real";
  return {
    base: real ? "./" : "/altera-trajectory/",
    plugins: real ? [react(), viteSingleFile()] : [react()],
    resolve: {
      alias: {
        "@dataset": fileURLToPath(new URL(real ? "./src/data/real/dataset.ts" : "./src/data/fictitiousDataset.ts", import.meta.url)),
      },
    },
    build: real ? { outDir: "dist-real" } : { outDir: "dist", assetsInlineLimit: 0 },
    test: { include: ["src/**/*.test.ts"] },
  };
});
