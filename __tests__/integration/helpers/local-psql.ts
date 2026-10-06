import { spawnSync } from "node:child_process";

const DATABASE_PORT = "45322";

// Chạy SQL một lần trên PostgreSQL local (quyền postgres) và trả stdout; lỗi SQL ném ra ngay.
export function runLocalPsql(sql: string): string {
  const result = spawnSync(
    "psql",
    ["-h", "127.0.0.1", "-p", DATABASE_PORT, "-w", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
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
