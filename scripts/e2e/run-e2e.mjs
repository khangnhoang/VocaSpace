import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareSupabaseWorkdir } from "./prepare-supabase-workdir.mjs";
import { decideDatabaseReset, skipResetEvidenceEnv } from "./reset-decision.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const forwardedArgs = process.argv.slice(2);
const kongContainer = "supabase_kong_voca_space_e2e";
const runtimeContainerFilter = "label=com.supabase.cli.project=voca_space_e2e";
// The smoke suite does not use these services; analytics (logflare) and vector alone take about 0.5 GB per stack.
// CLI 2.106 matches the image names below, not the older names its --help still lists.
const excludedServices = ["studio", "imgproxy", "mailpit", "edge-runtime", "logflare", "vector", "postgres-meta"];

main().then(
  (exitCode) => process.exit(exitCode),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

async function main() {
  loadLocalEnv();
  assertCommand("docker", ["info"], "Docker is not running or is not available in PATH.");
  assertChromiumInstalled();

  const { workdir } = prepareSupabaseWorkdir(repoRoot);
  let exitCode = 1;
  try {
    ensureSupabaseStarted(workdir);

    const supabaseEnv = getSupabaseEnv(workdir);
    assertLocalSupabaseEnv(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL);
    const resetDecision = decideDatabaseReset(readResetEvidence());
    if (resetDecision.reset) {
      console.log(`Resetting the database: ${resetDecision.reason}.`);
      resetSupabaseDatabase(workdir);
    } else {
      console.log(`Skipping the database reset: ${resetDecision.reason}.`);
    }
    await ensureKongReachesServices(supabaseEnv);

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
    exitCode = result.status ?? 1;
  } finally {
    if (process.env.E2E_KEEP_SUPABASE === "1") {
      console.log("E2E_KEEP_SUPABASE=1: leaving the isolated Supabase E2E runtime running.");
    } else if (!stopSupabaseRuntime(workdir)) {
      exitCode = 1;
    }
  }

  return exitCode;
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

function readResetEvidence() {
  const evidencePath = process.env[skipResetEvidenceEnv];
  let evidenceText = null;
  if (evidencePath) {
    try {
      evidenceText = readFileSync(evidencePath, "utf8");
    } catch {
      // Unreadable evidence means reset; the decision names it.
    }
  }
  return {
    evidencePath,
    evidenceText,
    job: { GITHUB_RUN_ID: process.env.GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT: process.env.GITHUB_RUN_ATTEMPT },
  };
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
  const start = runSupabase(workdir, ["start", ...excludedServices.flatMap((service) => ["-x", service])], { stdio: "inherit" });
  if (start.status !== 0) {
    throw new Error("Unable to start local Supabase E2E runtime. Check Docker and Supabase CLI.");
  }
}

// Supabase containers restart with Docker, so an idle E2E runtime keeps holding memory until it is stopped.
function stopSupabaseRuntime(workdir) {
  console.log("Stopping isolated Supabase E2E runtime...");
  const stop = runSupabase(workdir, ["stop"], { stdio: "inherit" });
  const remaining = spawnSync("docker", ["ps", "-a", "-q", "--filter", runtimeContainerFilter], {
    encoding: "utf8",
    shell: false,
  });
  if (stop.status === 0 && remaining.status === 0 && remaining.stdout.trim() === "") return true;

  // Reported instead of thrown so a test or setup error raised earlier is not replaced.
  console.error(
    "Unable to stop the isolated Supabase E2E runtime; run `npx supabase stop --project-id voca_space_e2e` and check `docker ps -a`.",
  );
  return false;
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

// After `db reset`, Kong can keep answering auth and storage calls with 502 until it restarts.
async function ensureKongReachesServices(supabaseEnv) {
  if (await waitForServicesThroughKong(supabaseEnv, 30_000)) return;

  console.log(`Auth or storage is unreachable through Kong after the reset; restarting ${kongContainer}...`);
  assertCommand("docker", ["restart", kongContainer], `Unable to restart ${kongContainer}.`);

  if (!(await waitForServicesThroughKong(supabaseEnv, 60_000))) {
    throw new Error("Auth or storage is still unreachable through Kong after restarting it.");
  }
}

async function waitForServicesThroughKong(supabaseEnv, timeoutMs) {
  const serviceKey = supabaseEnv.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const probes = ["/auth/v1/health", "/storage/v1/bucket"].map(
    (path) => new URL(path, supabaseEnv.NEXT_PUBLIC_SUPABASE_URL),
  );
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statuses = await Promise.all(
      probes.map((url) =>
        fetch(url, { headers, signal: AbortSignal.timeout(5_000) }).then(
          (response) => response.status,
          () => 0,
        ),
      ),
    );
    if (statuses.every((status) => status === 200)) return true;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }

  return false;
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
