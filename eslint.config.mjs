import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gitignored build and test output; linting it only adds noise.
    ".next-e2e/**",
    "test-results/**",
    ".playwright-cli/**",
    // Git worktrees of other sessions hold their own checkouts; they are not part of this one.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
