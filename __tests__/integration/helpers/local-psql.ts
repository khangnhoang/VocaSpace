import { spawnSync } from "node:child_process";
import { resolveLocalDatabasePort } from "./local-database-port";

// Chạy SQL một lần trên PostgreSQL local (quyền postgres) và trả stdout; lỗi SQL ném ra ngay.
// Cổng đi theo runtime của NEXT_PUBLIC_SUPABASE_URL; đích lạ ném lỗi trước khi psql được spawn.
export function runLocalPsql(sql: string): string {
  const databasePort = resolveLocalDatabasePort();
  const result = spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", databasePort, "-w", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    {
      input: sql,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, PGPASSWORD: process.env.LOCAL_SUPABASE_DB_PASSWORD ?? "postgres" },
    },
  );
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr || result.error}`);
  return result.stdout.trim();
}
