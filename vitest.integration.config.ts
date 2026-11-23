import { configDefaults, defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

if (!process.env.CI) {
  dotenv.config({ path: ".env.test.local" });
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/__tests__/integration/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    fileParallelism: false,
    // Giống vitest.config.ts (English localization U1 G8): action có dịch thông báo gọi getTranslations, cần alias server và cấu hình
    // request mặc định tiếng Việt thì test tích hợp mới giữ nguyên assertion tiếng Việt.
    server: { deps: { inline: ["next-intl"] } },
  },
  resolve: {
    tsconfigPaths: true,
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