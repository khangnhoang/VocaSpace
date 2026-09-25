import { spawn, spawnSync } from "node:child_process";

const DATABASE_HOST = "127.0.0.1";
const DATABASE_PORT = "45322";
const PSQL_ARGS = ["-h", DATABASE_HOST, "-p", DATABASE_PORT, "-w", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
const COORDINATION_TIMEOUT_MS = 15_000;

type PsqlExit = { code: number | null; signal: NodeJS.Signals | null };

export type LocalPostgresTransaction = {
  pid: number;
  finish: (command: "COMMIT" | "ROLLBACK") => Promise<void>;
};

export async function beginLocalPostgresTransaction(
  sql: string,
  readyPrefix: string,
): Promise<LocalPostgresTransaction> {
  const child = spawn("psql", PSQL_ARGS, {
    stdio: "pipe",
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: process.env.LOCAL_SUPABASE_DB_PASSWORD ?? "postgres" },
  });
  let stdout = "";
  let stderr = "";
  let exit: PsqlExit | null = null;
  let spawnError: Error | null = null;
  let finished = false;
  const closed = new Promise<PsqlExit>((resolve) => {
    child.on("error", (error) => { spawnError = error; });
    child.on("close", (code, signal) => {
      exit = { code, signal };
      resolve(exit);
    });
  });
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });

  try {
    child.stdin.write(`${sql.trim()}\n`);
    const deadline = Date.now() + COORDINATION_TIMEOUT_MS;
    let readyLine: string | undefined;
    while (!readyLine && Date.now() < deadline) {
      readyLine = stdout.split(/\r?\n/).find((line) => line.startsWith(readyPrefix));
      if (readyLine) break;
      if (exit || spawnError) {
        const detail = stderr.trim();
        throw new Error(`Local PostgreSQL session exited before ${readyPrefix}.${detail ? ` ${detail}` : ""}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (!readyLine) throw new Error(`Timed out waiting for local PostgreSQL session marker ${readyPrefix}.`);

    const pid = Number(readyLine.slice(readyPrefix.length));
    if (!Number.isSafeInteger(pid) || pid <= 0) {
      throw new Error(`Local PostgreSQL session returned an invalid backend PID: ${readyLine}`);
    }

    return {
      pid,
      finish: async (command) => {
        if (finished) return;
        if (exit) {
          finished = true;
          if (exit.code !== 0) throw new Error(`Local PostgreSQL session exited: ${stderr || exit.code}`);
          return;
        }
        child.stdin.write(`${command};\n`);
        child.stdin.end();
        const timeout = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("Timed out closing local PostgreSQL session.")), COORDINATION_TIMEOUT_MS);
          timer.unref();
        });
        try {
          const result = await Promise.race([closed, timeout]);
          finished = true;
          if (result.code !== 0) throw new Error(`Local PostgreSQL session failed: ${stderr || result.code}`);
        } catch (error) {
          child.kill();
          await closed;
          finished = true;
          throw error;
        }
      },
    };
  } catch (error) {
    child.kill();
    await closed;
    throw error;
  }
}

export async function waitForLocalPostgresQuery(sql: string, description: string): Promise<string> {
  const deadline = Date.now() + COORDINATION_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    const result = spawnSync("psql", [...PSQL_ARGS, "-c", sql], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
      env: { ...process.env, PGPASSWORD: process.env.LOCAL_SUPABASE_DB_PASSWORD ?? "postgres" },
    });
    if (result.error || result.status !== 0) {
      lastError = result.error?.message ?? result.stderr.trim();
    } else {
      const output = result.stdout.trim();
      if (output) return output;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${description}.${lastError ? ` Last database error: ${lastError}` : ""}`);
}
