import { defineConfig } from "vitest/config";

// Cấu hình riêng cho phép đo LF2; không nạp .env* để không vô tình trỏ vào runtime root.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["scripts/perf/**/*.perf.ts"],
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
});
