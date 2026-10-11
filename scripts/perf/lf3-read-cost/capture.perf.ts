import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";

// LF3 AC1/AC2 (plan section 1.5): lấy SQL chính xác mà PostgREST sinh ra cho hai câu lệnh đo từ log Postgres của
// runtime E2E tách biệt. Bật `log_min_duration_statement = 0` chỉ trong lúc bắt, rồi trả về mặc định.
// (a) đọc các lựa chọn của một câu hỏi; (b) request topic của `getLearningWorkspace` (hàm thật, client học viên thật).
// Ghi hai file `statement-a.sql` và `statement-b.sql` cạnh script này, tham số đã thay bằng giá trị thật.
// Cách chạy (sau db reset + fixture.sql, env trỏ vào 45441):
//   npx vitest run --config scripts/perf/vitest.config.ts scripts/perf/lf3-read-cost/capture.perf.ts

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => authenticated.client }));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const runtimeUrl = new URL(api || "http://invalid.local");
if (
  process.env.ALLOW_DB_INTEGRATION_TESTS !== "true"
  || process.env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime"
  || runtimeUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(runtimeUrl.hostname)
  || runtimeUrl.port !== "45441"
) {
  throw new Error("LF3 capture requires the explicitly enabled isolated E2E runtime on port 45441");
}

const DB_CONTAINER = "supabase_db_voca_space_e2e";
const outDir = resolve(import.meta.dirname);
const QUESTION_ID = "f3070000-0000-4000-8000-000000000001";
// Mỗi lệnh là một `-c` riêng vì ALTER SYSTEM không chạy được trong transaction (nhiều lệnh trong một `-c` là một transaction).
const psqlAdmin = (...statements: string[]) => {
  const r = spawnSync("psql", ["-h", "127.0.0.1", "-p", "45442", "-U", "supabase_admin", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", ...statements.flatMap((sql) => ["-c", sql])], {
    encoding: "utf8", env: { ...process.env, PGPASSWORD: "postgres" },
  });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
};

type LogRecord = { text: string };
function logRecords(since: string): LogRecord[] {
  const r = spawnSync("docker", ["logs", "--since", since, DB_CONTAINER], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const records: LogRecord[] = [];
  for (const line of `${r.stdout}\n${r.stderr}`.split(/\r?\n/)) {
    if (/^\S+ \d{4}-\d{2}-\d{2} /.test(line)) records.push({ text: line });
    else if (records.length > 0) records[records.length - 1].text += `\n${line}`;
  }
  return records;
}

// Gắn `execute <tên>: WITH pgrst_source ...` của authenticator với DETAIL tham số liền sau nó rồi thay $n bằng giá trị.
function postgrestStatements(records: LogRecord[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const match = records[i].text.match(/authenticator@postgres LOG:\s+duration: [\d.]+ ms\s+execute [^\s:]+: (WITH pgrst_source[\s\S]*)$/);
    if (!match) continue;
    let sql = match[1].trim();
    const detail = records[i + 1]?.text.match(/authenticator@postgres DETAIL:\s+Parameters: ([\s\S]*)$/);
    if (detail) {
      const params = new Map<number, string>();
      for (const p of detail[1].matchAll(/\$(\d+) = (NULL|'((?:[^']|'')*)')/g)) {
        params.set(Number(p[1]), p[2] === "NULL" ? "NULL" : `'${p[3]}'`);
      }
      sql = sql.replace(/\$(\d+)/g, (token, n) => params.get(Number(n)) ?? token);
    }
    out.push(sql);
  }
  return out;
}

async function capture(run: () => Promise<unknown>): Promise<string[]> {
  const since = new Date(Date.now() - 500).toISOString();
  await run();
  await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
  return postgrestStatements(logRecords(since));
}

describe("LF3 statement capture", () => {
  afterAll(() => psqlAdmin("alter system reset log_min_duration_statement", "select pg_reload_conf()"));

  it("captures the PostgREST SQL of the question_options read and the workspace topic request", async () => {
    const learner = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await learner.auth.signInWithPassword({ email: "student@gmail.com", password: "123123" });
    if (signedIn.error) throw signedIn.error;
    authenticated.client = learner;

    psqlAdmin("alter system set log_min_duration_statement = 0", "select pg_reload_conf()");
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));

    const a = await capture(async () => {
      const r = await learner.from("question_options")
        .select("id, question_id, content, label, is_correct, order_index, removed_at").eq("question_id", QUESTION_ID);
      expect(r.error).toBeNull();
      expect(r.data).toHaveLength(4);
    });
    const statementA = a.find((sql) => sql.includes('"public"."question_options"'));
    expect(statementA).toBeDefined();

    const b = await capture(async () => {
      const r = await getLearningWorkspace("lf3-perf-1", "lf3-perf-topic-1");
      expect(r.status).toBe("success");
    });
    const statementB = b.find((sql) => sql.includes('"public"."cards"') && sql.includes('"public"."exercises"'));
    expect(statementB).toBeDefined();

    writeFileSync(resolve(outDir, "statement-a.sql"), `${statementA};\n`);
    writeFileSync(resolve(outDir, "statement-b.sql"), `${statementB};\n`);
  }, 60_000);
});
