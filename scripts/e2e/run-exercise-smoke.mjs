import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSmokeTitle,
  fixture,
  prepareExerciseSmokeFixture,
} from "./exercise-smoke-fixture.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const defaultLocalSupabaseUrl = "http://127.0.0.1:55421";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  loadLocalEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.E2E_SUPABASE_URL ?? defaultLocalSupabaseUrl;
  assertLocalSupabaseEnv();
  assertCommand("docker", ["info"], "Docker chưa chạy hoặc không có trong PATH.");
  ensureSupabaseStarted();
  assertChromiumInstalled();

  const title = buildSmokeTitle();
  await prepareExerciseSmokeFixture();

  const playwright = commandInvocation(npxCommand(), [
    "playwright",
    "test",
    "--config",
    "playwright.config.ts",
    "e2e/exercise-authoring-smoke.spec.ts",
  ]);
  const result = spawnSync(playwright.command, playwright.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      E2E_EXERCISE_TITLE: title,
      E2E_TEACHER_EMAIL: fixture.teacherEmail,
      E2E_TEACHER_PASSWORD: fixture.teacherPassword,
      E2E_COURSE_ID: fixture.courseId,
      E2E_TOPIC_ID: fixture.topicId,
    },
  });

  process.exit(result.status ?? 1);
}

function loadLocalEnv() {
  for (const file of [".env.e2e.local", ".env.test.local", ".env.local"]) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;

    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trimStart().startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = stripEnvQuotes(match[2]);
    }
  }
}

function stripEnvQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function assertLocalSupabaseEnv() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const parsed = new URL(url);
  const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "http:" || !isLocalHost) {
    throw new Error(`Chặn smoke E2E vì Supabase URL không phải local: ${url}`);
  }
}

function assertCommand(command, args, failureMessage) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${failureMessage}${detail ? `\n${detail}` : ""}`);
  }
}

function ensureSupabaseStarted() {
  const statusCommand = commandInvocation(npxCommand(), ["supabase", "status"]);
  const status = spawnSync(statusCommand.command, statusCommand.args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  if (status.status === 0) return;

  console.log("Supabase local chưa chạy; đang khởi động bằng `npx supabase start`...");
  const startCommand = commandInvocation(npxCommand(), ["supabase", "start"]);
  const start = spawnSync(startCommand.command, startCommand.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });

  if (start.status !== 0) {
    throw new Error("Không thể khởi động Supabase local. Kiểm tra Docker và Supabase CLI.");
  }

  assertCommand(
    npxCommand(),
    ["supabase", "status"],
    "Supabase local đã start nhưng chưa trả trạng thái sẵn sàng.",
  );
}

function assertChromiumInstalled() {
  const executablePath = chromium.executablePath();
  if (!existsSync(executablePath)) {
    throw new Error("Playwright Chromium chưa được cài. Chạy `npx playwright install chromium` rồi thử lại.");
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function useShellForCommand(command) {
  return process.platform === "win32" && command.endsWith(".cmd");
}

function commandInvocation(command, args) {
  if (!useShellForCommand(command)) return { command, args };

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")],
  };
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
