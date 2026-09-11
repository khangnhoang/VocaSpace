// Test plan:
// - Mục tiêu: khóa bốn refinement vận hành giúp review native multi-agent ít round và không tự stale.
// - Loại test: Node static contract test trên skill core và hai reference trực tiếp.
// - Invariant: deterministic closure, materiality bar, root-cause/focused rereview và stable progress đều có core rule, procedure và scenario.
// - Giới hạn: test xác minh contract text; không phải native smoke hay bằng chứng model behavior.
// - Kết quả verify gần nhất: passed 4 tests bằng `node --test .agents/scripts/native-multi-agent-workflow.test.mjs` trên Node v24.11.1.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const bundleRoot = resolve(scriptDirectory, "..", "skills", "native-multi-agent-workflow");
const core = readFileSync(resolve(bundleRoot, "SKILL.md"), "utf8");
const reconciliation = readFileSync(
  resolve(bundleRoot, "references", "review-artifact-and-reconciliation.md"),
  "utf8",
);
const scenarios = readFileSync(resolve(bundleRoot, "references", "verification-scenarios.md"), "utf8");

test("closes established deterministic failures before Reviewer dispatch", () => {
  assert.match(core, /deterministic pre-review closure/);
  assert.match(core, /without duplicate execution/);
  assert.match(reconciliation, /encoding, consistent EOL, final newline, exact status literals/);
  assert.match(reconciliation, /do not rerun an unchanged passing check merely to duplicate evidence/);
  assert.match(scenarios, /Return to the owning writer before Reviewer dispatch; no review\/correction round consumed/);
});

test("blocks findings by material impact instead of artifact type", () => {
  const materialBoundary = /authority, routing\/state transition, ownership\/source of truth, candidate identity, acceptance\/verification, or completion truth/;
  assert.match(core, materialBoundary);
  assert.match(reconciliation, /Finding severity is artifact-neutral/);
  assert.match(scenarios, /Cosmetic or historical wording has no material causal path/);
});

test("requires root-cause closure and bounds focused rereview", () => {
  assert.match(core, /corrects the governing invariant and scans the full candidate/);
  assert.match(reconciliation, /previous findings, per-finding dispositions, the exact correction diff/);
  assert.match(scenarios, /Repeat the full review package/);
});

test("records completion without a self-staling progress reference", () => {
  assert.match(core, /tracker never records its own commit hash/);
  assert.match(reconciliation, /Git history supplies the progress-only commit identity/);
  assert.match(scenarios, /never its own hash or `pending this checkpoint`/);
});
