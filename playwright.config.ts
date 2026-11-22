import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const host = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${host}:${port}`;
// CI chạy trên bản build sẵn trong .next-e2e (E2E_WEB_SERVER=start) vì `next dev` biên dịch từng route khi gọi nên quá chậm trên runner.
const serverScript = process.env.E2E_WEB_SERVER === "start" ? "start" : "dev:app";

// G5: số worker chỉ đến từ E2E_WORKERS (mặc định 1, chạy cục bộ không đổi hành vi); CI đặt giá trị này tường minh.
const workers = parseWorkers(process.env.E2E_WORKERS);

function parseWorkers(value: string | undefined) {
  if (value === undefined || value === "") return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`E2E_WORKERS must be a positive integer, got "${value}".`);
  }
  return parsed;
}

// G2: các file đọc/ghi hàng seed dùng chung (hàng B2 của học viên seed, admin gate, khóa học seed) chạy trong project
// `seed` giới hạn 1 worker; không project nào khác ghi các hàng đó. Mọi file smoke khác nằm trong project `chromium`
// (file mới mặc định ở đó, nên file mới cần hàng seed phải được thêm vào danh sách này).
const seedBoundSpecs = [
  "admin-gate",
  "enrolled-course-overview",
  "learning-workspace",
  "review-session-recovery",
  "review-session",
].map((name) => `**/smoke/${name}.smoke.spec.ts`);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  // Các file chạy song song giữa các worker; test trong một file vẫn tuần tự trên cùng một worker.
  fullyParallel: false,
  workers,
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
      testIgnore: seedBoundSpecs,
      use: {
        browserName: "chromium",
      },
    },
    {
      name: "seed",
      testMatch: seedBoundSpecs,
      workers: 1,
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
