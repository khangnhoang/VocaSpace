import assert from "node:assert/strict";
import { resolve } from "node:path";
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
