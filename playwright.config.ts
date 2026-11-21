import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const host = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${host}:${port}`;
// CI chạy trên bản build sẵn trong .next-e2e (E2E_WEB_SERVER=start) vì `next dev` biên dịch từng route khi gọi nên quá chậm trên runner.
const serverScript = process.env.E2E_WEB_SERVER === "start" ? "start" : "dev:app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    // English localization U1: E2E chạy bằng tiếng Việt; Chromium mặc định gửi Accept-Language tiếng Anh.
    locale: "vi-VN",
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
    command: `npm run ${serverScript} -- --hostname ${host} --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    // Build vào .next-e2e để không đụng khóa `.next/dev/lock` của `next dev` đang chạy ở cổng 3000.
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
