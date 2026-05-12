import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["node_modules", "dist"],
    pool: "forks",
    fileParallelism: false,
    globalSetup: ["./vitest.integration.global.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
