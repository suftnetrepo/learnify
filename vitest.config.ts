import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Next.js API/service tests. DB and auth are mocked in each test; nothing touches Postgres.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include:     ["src/__tests__/**/*.test.ts"],
  },
});
