import assert from "node:assert/strict";
import test from "node:test";
import { checkShardIds, listIdsFromJsonReport, makeTestId, parseListReporterLog } from "./shard-ids.mjs";

const idA = makeTestId({ file: "e2e/smoke/a.smoke.spec.ts", titlePath: "does a", project: "chromium" });
const idB = makeTestId({ file: "e2e/smoke/b.smoke.spec.ts", titlePath: "group › does b at 375px", project: "chromium" });

test("reads passed, failed and skipped tests from a timestamped list-reporter log and ignores summary lines", () => {
  const log = [
    "2026-11-21T22:36:55.1930148Z   ✓   1 [chromium] › e2e/smoke/a.smoke.spec.ts:14:7 › does a (4.9s)",
    "2026-11-21T22:37:00.2959547Z   ✘   2 [chromium] › e2e/smoke/b.smoke.spec.ts:20:7 › group › does b at 375px (1.2m)",
    "2026-11-21T22:37:01.0000000Z   -   3 [chromium] › e2e/smoke/c.smoke.spec.ts:1:1 › skipped one",
    "  ok  4 [chromium] › e2e\\smoke\\a.smoke.spec.ts:14:7 › does a (9.6s)",
    "2026-11-21T22:37:02.0000000Z     [chromium] › e2e/smoke/b.smoke.spec.ts:20:7 › group › does b at 375px",
    "2026-11-21T22:37:03.0000000Z   86 passed (5.0m)",
  ].join("\n");
  assert.deepEqual(parseListReporterLog(log), [
    { id: idA, status: "passed" },
    { id: idB, status: "failed" },
    { id: makeTestId({ file: "e2e/smoke/c.smoke.spec.ts", titlePath: "skipped one", project: "chromium" }), status: "skipped" },
    { id: idA, status: "passed" },
  ]);
});

test("builds the same ID from a JSON listing as from a log line", () => {
  const report = {
    suites: [
      {
        title: "smoke/b.smoke.spec.ts",
        file: "smoke/b.smoke.spec.ts",
        specs: [],
        suites: [{ title: "group", specs: [{ title: "does b at 375px", file: "smoke/b.smoke.spec.ts", tests: [{ projectName: "chromium" }] }] }],
      },
      { title: "smoke/a.smoke.spec.ts", specs: [{ title: "does a", file: "smoke/a.smoke.spec.ts", tests: [{ projectName: "chromium" }] }] },
    ],
  };
  assert.deepEqual(listIdsFromJsonReport(report), [idB, idA]);
});

test("passes when the shards together hold each expected ID once and all passed", () => {
  const outcome = checkShardIds({
    expectedIds: [idA, idB],
    shards: [
      { name: "1", results: [{ id: idA, status: "passed" }] },
      { name: "2", results: [{ id: idB, status: "passed" }] },
    ],
  });
  assert.equal(outcome.ok, true);
});

test("fails on a missing, duplicated, failed or unexpected ID", () => {
  const outcome = checkShardIds({
    expectedIds: [idA, idB],
    shards: [
      { name: "1", results: [{ id: idA, status: "passed" }] },
      { name: "2", results: [{ id: idA, status: "passed" }, { id: "x › y [chromium]", status: "failed" }] },
    ],
  });
  assert.equal(outcome.ok, false);
  const text = outcome.problems.join("\n");
  assert.match(text, /ran 2 times/);
  assert.match(text, /failed: x › y/);
  assert.match(text, /unexpected ID: x › y/);
  assert.match(text, /missing: .*b\.smoke/);
});
