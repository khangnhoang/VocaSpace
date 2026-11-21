import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

if (!process.env.CI) {
  dotenv.config({ path: ".env.local" });
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // next-intl phải đi qua Vite (không externalize) thì alias `next-intl/config` mới áp dụng cho import bên trong gói.
    server: { deps: { inline: ["next-intl"] } },
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      ".claude/worktrees/**",
      "**/__tests__/integration/**",
      ".agents/scripts/**/*.test.mjs",
      "scripts/docs/**/*.test.mjs",
      "scripts/e2e/**/*.test.mjs",
      "scripts/content/apply-free-toeic-vocab-course.test.mjs",
      "e2e/**",
    ],
  },
  resolve: {
    tsconfigPaths: true,
    // English localization U1 G8: Vitest không chạy với điều kiện "react-server", nên `next-intl/server` mặc định trỏ tới bản
    // ném lỗi cho client. Trỏ thẳng tới bản server và thay cấu hình request bằng bản test (mặc định tiếng Việt) để server
    // component và Server Action render được mà không cần mock thư viện trong từng test.
    alias: [
      {
        find: /^next-intl\/server$/,
        replacement: fileURLToPath(
          new URL("./node_modules/next-intl/dist/esm/development/server.react-server.js", import.meta.url),
        ),
      },
      {
        find: /^next-intl\/config$/,
        replacement: fileURLToPath(new URL("./__tests__/support/i18n-request.ts", import.meta.url)),
      },
    ],
  },
});
