import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

if (!process.env.CI) {
  dotenv.config({ path: ".env.test.local" });
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/__tests__/integration/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
});