import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createConnection, createServer } from "node:net";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const projectId = "voca_space";
const expectedApiPort = 45321;
const expectedDbPort = 45322;
const checkedPorts = [45320, 45321, 45322, 45323, 45324, 45327, 45329];
const forwardedArgs = process.argv.slice(3);
const command = process.argv[2] ?? "dev";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  assertRootProjectConfig();

  switch (command) {
    case "dev":
      await ensureRootSupabaseStarted();
      startNextWithRootSupabaseEnv();
      return;
    case "start":
      await ensureRootSupabaseStarted();
      printRootSupabaseStatus();
      return;
    case "status":
      runSupabaseOrExit(["status"]);
      return;
    case "stop":
      runSupabaseOrExit(["stop"]);
      return;
    default:
      throw new Error(`Unknown local development command: ${command}`);
  }
}

async function ensureRootSupabaseStarted() {
  assertCommand("docker", ["info"], "Docker is not running or is not available in PATH.");

  const status = runSupabase(["status"], { encoding: "utf8" });
  if (status.status === 0) {
    const env = getSupabaseEnv();
    if (isExpectedRootEnv(env) && (await areExpectedPortsListening())) return;

    console.log("Root Supabase is not listening on the canonical 4532x ports. Restarting with plain stop/start...");
    stopRootSupabase();
  }

  await assertConfiguredPortsAvailable();
  const start = runSupabase(["start"], { stdio: "inherit" });
  if (start.status !== 0) {
    throw new Error("Unable to start root local Supabase. Check Docker, Supabase CLI, and the canonical 4532x ports.");
  }

  const env = getSupabaseEnv();
  if (!isExpectedRootEnv(env)) {
    throw new Error(`Root Supabase started with an unexpected API URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  }
}

function getSupabaseEnv() {
  const result = runSupabase(["status", "-o", "env"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Unable to read root Supabase env:\n${result.stderr ?? ""}`);
  }

  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = stripEnvQuotes(match[2]);
  }

  for (const name of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL"]) {
    if (!values[name]) throw new Error(`Supabase status is missing ${name}.`);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    DB_URL: values.DB_URL,
  };
}

function startNextWithRootSupabaseEnv() {
  const env = getSupabaseEnv();
  assertRootSupabaseEnv(env);
  console.log(`Starting Next.js with root Supabase at ${env.NEXT_PUBLIC_SUPABASE_URL}.`);

  const npm = commandInvocation(npmCommand(), ["run", "dev:app", "--", ...forwardedArgs]);
  const child = spawn(npm.command, npm.args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      VOCASPACE_SUPABASE_PROJECT_ID: projectId,
    },
  });

  child.on("exit", (status, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(status ?? 1);
  });
}

function isExpectedRootEnv(env) {
  try {
    assertRootSupabaseEnv(env);
    return true;
  } catch {
    return false;
  }
}

function assertRootSupabaseEnv(env) {
  const apiUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  const isLoopback = apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost";
  if (apiUrl.protocol !== "http:" || !isLoopback) {
    throw new Error(`Refusing to run development against a non-local Supabase URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  }
  if (Number(apiUrl.port) !== expectedApiPort) {
    throw new Error(`Refusing to run development against unexpected Supabase API port: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  }

  const dbUrl = new URL(env.DB_URL);
  if (Number(dbUrl.port) !== expectedDbPort) {
    throw new Error(`Refusing to run development against unexpected Supabase DB port: ${env.DB_URL}`);
  }
}

function assertRootProjectConfig() {
  const configPath = resolve(repoRoot, "supabase", "config.toml");
  const config = readFileSync(configPath, "utf8");
  if (!/^project_id = "voca_space"$/m.test(config)) {
    throw new Error("Refusing to run because root supabase/config.toml is not project_id = \"voca_space\".");
  }
  if (existsSync(resolve(repoRoot, ".dev-runtime"))) {
    throw new Error("Refusing to run while abandoned .dev-runtime exists. Remove it before local development.");
  }
}

async function assertConfiguredPortsAvailable() {
  for (const port of checkedPorts) {
    await assertPortAvailable(port);
  }
}

function assertPortAvailable(port) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => {
      reject(new Error(`Port ${port} is unavailable for root Supabase project ${projectId}. Stop the conflicting process or choose another canonical port.`));
    });
    server.once("listening", () => {
      server.close(() => resolvePort());
    });
    server.listen({ host: "127.0.0.1", port });
  });
}

async function areExpectedPortsListening() {
  return (await canConnect(expectedApiPort)) && (await canConnect(expectedDbPort));
}

function canConnect(port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(2_000);
    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

function printRootSupabaseStatus() {
  runSupabaseOrExit(["status"]);
}

function stopRootSupabase() {
  const stop = runSupabase(["stop"], { stdio: "inherit" });
  if (stop.status !== 0) {
    throw new Error("Unable to stop root Supabase with the plain preserving stop command.");
  }
}

function runSupabaseOrExit(args) {
  const result = runSupabase(args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

function runSupabase(args, options = {}) {
  const invocation = commandInvocation(npxCommand(), ["supabase", ...args]);
  return spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    shell: false,
    env: {
      ...process.env,
      SUPABASE_TELEMETRY_DISABLED: "1",
    },
    ...options,
  });
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

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
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
