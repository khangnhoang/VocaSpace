// LF3 AC1/AC2 (plan section 1.5): đo chi phí đọc nội dung của hai câu lệnh PostgREST đã bắt (statement-a.sql, statement-b.sql).
// Chỉ chạy trên DB của runtime E2E tách biệt (cổng 45442) sau `supabase db reset` + fixture.sql; không bao giờ trỏ vào root hay hosted.
// Ba phép đo, mỗi phép chạy với vai trò `authenticated` và claims của student@gmail.com (đúng như PostgREST):
//   counts : số lần gọi từng hàm trong MỘT transaction, đọc từ pg_stat_xact_user_functions (track_functions = all).
//   explain: EXPLAIN (ANALYZE, BUFFERS) để lấy hình dạng plan (tách riêng khỏi phép đo thời gian).
//   timing : 3 lần chạy nóng bị bỏ, rồi trung vị của 20 lần chạy, ghi HAI số tách biệt:
//            client_roundtrip_* = thời gian client của psql (`	iming`, gồm round trip loopback và serialize kết quả; KHÔNG phải thời gian thực thi);
//            server_execution_* = dòng "Execution Time" của EXPLAIN (ANALYZE, BUFFERS) từ chính server, cùng quy trình warm-up/n.
// Cách chạy:  PGPASSWORD=postgres node scripts/perf/lf3-read-cost/measure.mjs [counts|explain|timing|all]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = import.meta.dirname;
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
const port = process.env.LF3_DB_PORT ?? "45442";
if (port !== "45442") throw new Error("LF3 measurement is limited to the isolated runtime DB on port 45442");

const studentId = "33333333-3333-4333-8333-333333333333";
const claims = JSON.stringify({ sub: studentId, role: "authenticated", aud: "authenticated" });
const statements = {
  a: readFileSync(resolve(dir, "statement-a.sql"), "utf8").trim().replace(/;$/, ""),
  b: readFileSync(resolve(dir, "statement-b.sql"), "utf8").trim().replace(/;$/, ""),
};
const WARMUPS = 3;
const RUNS = 20;

function psql(script) {
  const r = spawnSync("psql", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input: script, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" },
  });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
  return r.stdout;
}

const asLearner = `set local role authenticated;\nselect set_config('request.jwt.claims', '${claims}', true) \\g ${nullDevice}\n`;

function counts(sql) {
  const out = psql(`begin;\nset local track_functions = 'all';\n${asLearner}\\o ${nullDevice}\n${sql};\n\\o\n`
    + `select funcname || ' = ' || calls as c from pg_stat_xact_user_functions where schemaname in ('private', 'public') order by funcname;\nrollback;\n`);
  return out.trim().split(/\r?\n/).filter(Boolean);
}

function explain(sql) {
  return psql(`begin;\n${asLearner}explain (analyze, buffers) ${sql};\nrollback;\n`);
}

function timing(sql) {
  const lines = [];
  for (let i = 0; i < WARMUPS + RUNS; i += 1) lines.push(`begin;\n${asLearner}\\o ${nullDevice}\n\\timing on\n${sql};\n\\timing off\n\\o\nrollback;\n`);
  const out = psql(`\\timing off\n${lines.join("")}`);
  const times = [...out.matchAll(/Time: ([\d.]+) ms/g)].map((m) => Number(m[1]));
  const measured = times.slice(WARMUPS).sort((x, y) => x - y);
  if (measured.length !== RUNS) throw new Error(`expected ${RUNS} timings, got ${measured.length} (of ${times.length})`);
  const median = (measured[RUNS / 2 - 1] + measured[RUNS / 2]) / 2;
  return { client_roundtrip_median_ms: Number(median.toFixed(2)), client_roundtrip_min_ms: measured[0], client_roundtrip_max_ms: measured[RUNS - 1] };
}

// Thời gian thực thi phía server: "Execution Time" của EXPLAIN (ANALYZE, BUFFERS), 3 lần nóng bị bỏ rồi trung vị của 20 lần.
function serverExecution(sql) {
  const scripts = [];
  for (let i = 0; i < WARMUPS + RUNS; i += 1) scripts.push(`begin;
${asLearner}explain (analyze, buffers) ${sql};
rollback;
`);
  const out = psql(scripts.join(""));
  const times = [...out.matchAll(/Execution Time: ([\d.]+) ms/g)].map((m) => Number(m[1]));
  const measured = times.slice(WARMUPS).sort((x, y) => x - y);
  if (measured.length !== RUNS) throw new Error(`expected ${RUNS} execution times, got ${measured.length} (of ${times.length})`);
  const median = (measured[RUNS / 2 - 1] + measured[RUNS / 2]) / 2;
  return { server_execution_median_ms: Number(median.toFixed(3)), server_execution_min_ms: measured[0], server_execution_max_ms: measured[RUNS - 1] };
}

const mode = process.argv[2] ?? "all";
for (const [name, sql] of Object.entries(statements)) {
  console.log(`==== statement ${name} ====`);
  if (mode === "counts" || mode === "all") console.log("function calls in one transaction:\n  " + (counts(sql).join("\n  ") || "(none)"));
  if (mode === "explain" || mode === "all") console.log("plan:\n" + explain(sql));
  if (mode === "timing" || mode === "all") {
    console.log("timing:", JSON.stringify({ n: RUNS, warmups: WARMUPS, ...timing(sql), ...serverExecution(sql) }));
  }
}
