import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include:     ["tests/**/*.test.ts"],
    setupFiles:  ["tests/setup.ts"],
    // DB-backed suites share one throwaway database — run files one at a time
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
