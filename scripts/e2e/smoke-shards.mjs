// Which smoke spec files each CI shard runs. Names in smoke-shards.json are file names without ".smoke.spec.ts".
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const suffix = ".smoke.spec.ts";

export function readSmokeShards() {
  return JSON.parse(readFileSync(join(here, "smoke-shards.json"), "utf8")).shards;
}

export function smokeSpecNames(repoRoot) {
  return readdirSync(join(repoRoot, "e2e", "smoke"))
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .sort();
}

export function shardFilePaths(shards, shardNumber) {
  const names = shards[shardNumber - 1];
  if (!names) throw new Error(`There is no smoke shard ${shardNumber}; the manifest has ${shards.length}.`);
  return names.map((name) => `e2e/smoke/${name}${suffix}`);
}

// Every smoke spec must run in exactly one shard, and the manifest may not name a spec that does not exist.
export function validateShards(shards, specNames) {
  const problems = [];
  const seen = new Map();
  shards.forEach((names, index) => {
    for (const name of names) seen.set(name, [...(seen.get(name) ?? []), index + 1]);
  });
  for (const [name, where] of seen) {
    if (where.length > 1) problems.push(`${name} is listed in shards ${where.join(" and ")}`);
    if (!specNames.includes(name)) problems.push(`${name} is listed but e2e/smoke/${name}${suffix} does not exist`);
  }
  for (const name of specNames) {
    if (!seen.has(name)) problems.push(`${name} is in no shard`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const shardNumber = Number(process.argv[2]);
  console.log(shardFilePaths(readSmokeShards(), shardNumber).join(" "));
}
