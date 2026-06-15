import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const host = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --webpack --hostname ${host} --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
