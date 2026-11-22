// Which smoke spec files each CI shard runs. Names in smoke-shards.json are file names without ".smoke.spec.ts".
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const suffix = ".smoke.spec.ts";
// The ci.yml E2E matrix runs shards 1 and 2; a third array would never run and an empty one would run the whole E2E tree.
export const shardCount = 2;
// Playwright's default test-file pattern (`**/*.@(spec|test).?(c|m)[jt]s?(x)`): the check must see every file it collects.
const collectedPattern = /\.(spec|test)\.[cm]?[jt]sx?$/;

export function readSmokeShards() {
  return JSON.parse(readFileSync(join(here, "smoke-shards.json"), "utf8")).shards;
}

// Every file Playwright collects under e2e/smoke, recursively. A file named *.smoke.spec.ts is listed without that suffix
// (and with its sub-folder); any other collected file keeps its full name so validateShards rejects it.
export function smokeSpecNames(repoRoot) {
  const root = join(repoRoot, "e2e", "smoke");
  const names = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (collectedPattern.test(entry.name)) {
        const name = relative(root, path).split(sep).join("/");
        names.push(name.endsWith(suffix) ? name.slice(0, -suffix.length) : name);
      }
    }
  };
  visit(root);
  return names.sort();
}

export function shardFilePaths(shards, shardNumber) {
  const names = shards[shardNumber - 1];
  if (!names) throw new Error(`There is no smoke shard ${shardNumber}; the manifest has ${shards.length}.`);
  if (names.length === 0) throw new Error(`Smoke shard ${shardNumber} is empty; an empty file list would run the whole E2E tree.`);
  return names.map((name) => `e2e/smoke/${name}${suffix}`);
}

// Every smoke spec must run in exactly one shard, and the manifest may not name a spec that does not exist.
export function validateShards(shards, specNames) {
  const problems = [];
  if (shards.length !== shardCount) problems.push(`the manifest has ${shards.length} shards; ci.yml runs ${shardCount}`);
  shards.forEach((names, index) => {
    if (names.length === 0) problems.push(`shard ${index + 1} is empty`);
  });
  for (const name of specNames) {
    if (collectedPattern.test(name)) problems.push(`${name} is collected by Playwright but is not named *${suffix}`);
  }
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
