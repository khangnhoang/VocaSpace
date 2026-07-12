import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareSupabaseWorkdir } from "./prepare-supabase-workdir.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const forwardedArgs = process.argv.slice(2);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  loadLocalEnv();
  assertCommand("docker", ["info"], "Docker is not running or is not available in PATH.");
  assertChromiumInstalled();

  const { workdir } = prepareSupabaseWorkdir(repoRoot);
  ensureSupabaseStarted(workdir);

  const supabaseEnv = getSupabaseEnv(workdir);
  assertLocalSupabaseEnv(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL);
  resetSupabaseDatabase(workdir);

  const playwright = commandInvocation(npxCommand(), [
    "playwright",
    "test",
    "--config",
    "playwright.config.ts",
    ...forwardedArgs,
  ]);

  const result = spawnSync(playwright.command, playwright.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...supabaseEnv,
      E2E_SUPABASE_WORKDIR: workdir,
    },
  });

  process.exit(result.status ?? 1);
}

function loadLocalEnv() {
  for (const file of [".env.e2e.local", ".env.test.local", ".env.local"]) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

function ensureSupabaseStarted(workdir) {
  const status = runSupabase(workdir, ["status"], { encoding: "utf8" });
  if (status.status === 0) return;

  console.log("Starting isolated Supabase E2E runtime...");
  const start = runSupabase(workdir, ["start"], { stdio: "inherit" });
  if (start.status !== 0) {
    throw new Error("Unable to start local Supabase E2E runtime. Check Docker and Supabase CLI.");
  }
}

function getSupabaseEnv(workdir) {
  const result = runSupabase(workdir, ["status", "-o", "env"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Unable to read Supabase E2E env:\n${result.stderr ?? ""}`);
  }

  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = stripEnvQuotes(match[2]);
  }

  const required = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"];
  for (const name of required) {
    if (!values[name]) throw new Error(`Supabase status is missing ${name}`);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  };
}

function assertLocalSupabaseEnv(url) {
  const parsed = new URL(url);
  const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "http:" || !isLocalHost) {
    throw new Error(`Refusing to run E2E against a non-local Supabase URL: ${url}`);
  }
}

function resetSupabaseDatabase(workdir) {
  console.log("Resetting isolated Supabase E2E database...");

  const result = runSupabase(workdir, ["db", "reset"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Unable to reset the isolated Supabase E2E database.");
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

function assertChromiumInstalled() {
  const executablePath = chromium.executablePath();
  if (!existsSync(executablePath)) {
    throw new Error("Playwright Chromium is not installed. Run `npx playwright install chromium` and try again.");
  }
}

function runSupabase(workdir, args, options = {}) {
  const invocation = commandInvocation(npxCommand(), ["supabase", "--workdir", workdir, ...args]);
  return spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    shell: false,
    ...options,
  });
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function shouldInvokeViaCmd(command) {
  return process.platform === "win32" && command.endsWith(".cmd");
}

function commandInvocation(command, args) {
  if (!shouldInvokeViaCmd(command)) return { command, args };

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")],
  };
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
