import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

if (!process.env.CI) {
  dotenv.config({ path: ".env.local" });
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/__tests__/integration/**",
      "e2e/**",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
});