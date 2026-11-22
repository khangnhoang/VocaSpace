import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readSmokeShards, shardFilePaths, smokeSpecNames, validateShards } from "./smoke-shards.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");

test("every smoke spec file runs in exactly one shard", () => {
  assert.deepEqual(validateShards(readSmokeShards(), smokeSpecNames(repoRoot)), []);
});

test("reports a spec that is in no shard, in two shards, or does not exist", () => {
  const problems = validateShards([["a", "b"], ["b", "ghost"]], ["a", "b", "c"]);
  assert.deepEqual(problems.sort(), [
    "b is listed in shards 1 and 2",
    "c is in no shard",
    "ghost is listed but e2e/smoke/ghost.smoke.spec.ts does not exist",
  ]);
});

test("maps a shard number to its spec file paths", () => {
  assert.deepEqual(shardFilePaths([["a"], ["b", "c"]], 2), ["e2e/smoke/b.smoke.spec.ts", "e2e/smoke/c.smoke.spec.ts"]);
  assert.throws(() => shardFilePaths([["a"]], 2), /no smoke shard 2/);
});

test("rejects a manifest with a third shard or an empty shard", () => {
  assert.deepEqual(validateShards([["a"], ["b"], ["c"]], ["a", "b", "c"]), ["the manifest has 3 shards; ci.yml runs 2"]);
  assert.deepEqual(validateShards([["a", "b"], []], ["a", "b"]), ["shard 2 is empty"]);
  assert.throws(() => shardFilePaths([["a"], []], 2), /Smoke shard 2 is empty/);
});

test("collects spec files in sub-folders and files without the smoke suffix", () => {
  const root = mkdtempSync(join(tmpdir(), "smoke-shards-"));
  try {
    mkdirSync(join(root, "e2e", "smoke", "sub"), { recursive: true });
    for (const file of ["a.smoke.spec.ts", "sub/x.smoke.spec.ts", "new-flow.spec.ts", "helper.ts", "other.test.mjs"]) {
      writeFileSync(join(root, "e2e", "smoke", file), "");
    }
    const names = smokeSpecNames(root);
    assert.deepEqual(names, ["a", "new-flow.spec.ts", "other.test.mjs", "sub/x"]);
    assert.deepEqual(validateShards([["a", "sub/x"], ["new-flow.spec.ts"]], names).sort(), [
      "new-flow.spec.ts is collected by Playwright but is not named *.smoke.spec.ts",
      "other.test.mjs is collected by Playwright but is not named *.smoke.spec.ts",
      "other.test.mjs is in no shard",
    ].sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
