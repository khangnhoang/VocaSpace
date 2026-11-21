// Test identity for the smoke shards (INFRA-U1 AC7): a test is "file › title path [project]". The merged results of all shards
// must contain each expected ID exactly once and every one passed, whatever the shard split is.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ansiPattern = /\x1b\[[0-9;]*m/g;
// List reporter line: "✓   1 [chromium] › e2e/smoke/x.spec.ts:14:7 › title path (4.9s)", optionally after a CI timestamp.
// Windows consoles print "ok" and "x" instead of ✓ and ✘.
const resultLinePattern = /^\s*(✓|✘|ok|x|-)\s+\d+ \[([^\]]+)\] › ([^:]+):\d+:\d+ › (.*?)(?: \([\d.]+(?:ms|s|m)\))?\s*$/;
const passedMarks = new Set(["✓", "ok"]);
const failedMarks = new Set(["✘", "x"]);

export function makeTestId({ file, titlePath, project }) {
  return `${normalizeFile(file)} › ${titlePath} [${project}]`;
}

// Playwright prints the file relative to the working directory in reports and to testDir in JSON; both map to one form.
function normalizeFile(file) {
  return file.replace(/\\/g, "/").replace(/^e2e\//, "");
}

export function parseListReporterLog(text) {
  const results = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\S+Z /, "").replace(ansiPattern, "");
    const match = line.match(resultLinePattern);
    if (!match) continue;
    const status = passedMarks.has(match[1]) ? "passed" : failedMarks.has(match[1]) ? "failed" : "skipped";
    results.push({ id: makeTestId({ project: match[2], file: match[3], titlePath: match[4] }), status });
  }
  return results;
}

// `playwright test --list --reporter=json`: suites nest as file → describe blocks, specs carry the tests of each project.
export function listIdsFromJsonReport(report) {
  const ids = [];
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        ids.push(makeTestId({ file: spec.file, titlePath: [...titles, spec.title].join(" › "), project: test.projectName }));
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  };
  for (const fileSuite of report.suites ?? []) visit(fileSuite, []);
  return ids;
}

export function checkShardIds({ expectedIds, shards }) {
  const problems = [];
  const expected = new Set(expectedIds);
  if (expected.size !== expectedIds.length) problems.push("The expected list contains a duplicate ID.");

  const passedBy = new Map();
  for (const shard of shards) {
    for (const result of shard.results) {
      if (result.status !== "passed") problems.push(`${shard.name}: ${result.status}: ${result.id}`);
      if (!expected.has(result.id)) problems.push(`${shard.name}: unexpected ID: ${result.id}`);
      passedBy.set(result.id, [...(passedBy.get(result.id) ?? []), shard.name]);
    }
  }
  for (const [id, names] of passedBy) {
    if (names.length > 1) problems.push(`ran ${names.length} times (${names.join(", ")}): ${id}`);
  }
  for (const id of expected) {
    if (!passedBy.has(id)) problems.push(`missing: ${id}`);
  }
  return { ok: problems.length === 0, problems, expectedCount: expected.size, resultCount: passedBy.size };
}

export function readExpectedIds(cwd) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["playwright", "test", "e2e/smoke", "--list", "--reporter=json"], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`playwright --list failed:\n${result.stderr}`);
  return listIdsFromJsonReport(JSON.parse(result.stdout));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const logFiles = process.argv.slice(2);
  if (logFiles.length === 0) {
    console.error("Usage: node scripts/e2e/shard-ids.mjs <shard list-reporter log>...");
    process.exit(2);
  }
  const shards = logFiles.map((name) => ({ name, results: parseListReporterLog(readFileSync(name, "utf8")) }));
  const outcome = checkShardIds({ expectedIds: readExpectedIds(process.cwd()), shards });
  console.log(`Expected ${outcome.expectedCount} test IDs; ${outcome.resultCount} distinct IDs in ${shards.length} shard log(s).`);
  for (const problem of outcome.problems.slice(0, 20)) console.error(problem);
  if (outcome.problems.length > 20) console.error(`... and ${outcome.problems.length - 20} more problems.`);
  console.log(outcome.ok ? "AC7 identity check: PASS" : "AC7 identity check: FAIL");
  process.exit(outcome.ok ? 0 : 1);
}
