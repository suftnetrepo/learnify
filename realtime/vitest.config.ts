import { defineConfig } from "vitest/config";

// Own config so Vitest doesn't walk up and pick the Next.js app's vitest.config.ts
export default defineConfig({
  test: {
    environment: "node",
    include:     ["src/__tests__/**/*.test.ts"],
  },
});
