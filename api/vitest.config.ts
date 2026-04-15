import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/ingestion/**", "src/jobs/**"],
    },
    // Load .env before tests so DATABASE_URL is available for integration tests
    setupFiles: ["dotenv/config"],
  },
});
