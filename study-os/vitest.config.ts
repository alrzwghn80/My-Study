import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Domain-service integration tests hit a real Postgres in a shared
    // transaction-per-test pattern; run them sequentially to avoid the
    // "one active session per user" constraint colliding across parallel
    // test files that reuse the same seeded user.
    fileParallelism: false,
  },
});
