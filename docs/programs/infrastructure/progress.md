# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U1 plan](./implementation-plans/u1-test-runtime/plan.md) r3, Owner-approved 2026-11-22. |
| Current unit / checkpoint | INFRA-U1 CP1, CP2 and CP3 done; CP4 local part implemented (shard balance and the AC7 identity check), CP4 CI samples pending. |
| Status | CP4 local checks passed; AC6, the AC7 identity check on the final revision and AC8 wait for two CI runs of the final revision. |
| Completed evidence | AC1 and AC2: `npx vitest list --filesOnly` 702 → 167 files and the integration config 203 → 52, none under `.claude/worktrees`, main-checkout lists identical; `tsc` already listed none, ESLint now ignores worktrees. AC3: four worktrees removed after the G6 recheck. AC4 and AC5: `validate-skill.mjs` and `docs:check` pass. CP3 (PR 194, slowest shard job over its E2E job pair, seconds; baseline median 683): `56362dfc` run 44955514848 attempt 1, all caches miss, 572 / 579, G2 probe proven on both shards (data volume absent before start, present after), setup-cli and npx both 2.106.0; attempt 2, Playwright and Next caches hit, build 9–14 s, 448 / 586; `9b343dcd` run 44957368378 with the reset skipped on both shards, attempt 1 523 / 467, attempt 2 591 / 492. Median of the slowest shard over the two `9b343dcd` runs: 557 s, 126 s below baseline (CP3 startup result, not AC6). Step medians on `9b343dcd`: dependencies about 77 s, Chromium with cache hit 16 s, wait for Supabase about 37 s (the start still outlasts `npm ci` and Chromium), build 13–15 s, E2E run 299–411 s; the same shard's E2E step varied by up to 64 s on one revision. AC7 for `9b343dcd` (both attempts): merged shard logs hold 86 distinct IDs, each once and passed, equal to `npx playwright test e2e/smoke --list` (86). CP4 local: Playwright's `--shard` splits by test count and `fullyParallel` would not move the boundary (the serial files keep their groups together), so CI now runs duration-balanced file lists; replayed on the logged durations the slowest shard's test time falls from 331.6 and 395.1 s to 313.9 and 351.3 s. `node --test` on the E2E scripts passes (16 of 16). The two new shard lists run locally on fresh stacks, one after the other: 48 passed, and 37 passed with 1 failed; the 86 IDs of both logs equal `e2e/smoke --list`, each once, and the one failure is the local-only [E2E-LOCAL-001](./problems.md) (passes in CI). |
| Accepted deviations | H6: shards are balanced by an explicit file list in `scripts/e2e/smoke-shards.json` instead of `fullyParallel` or splitting a spec, because `fullyParallel` changes nothing here and splitting would edit test setup. No smoke spec was edited or split, so no old-to-new ID mapping exists. |
| Blockers / Owner decisions | CP4 needs two CI runs of the final revision (push and re-run grants held by Main). The 2/3/4-shard decision (AC8) is the Owner's after those runs. |
| Next action | Main pushes the CP4 commit and runs two CI samples; then AC6, AC7 and AC8 are evaluated from them. |
| Current authority | Owner 2026-11-22: implementation of r3 and local commits on `docs/infra-u1-test-runtime`. No push, PR, re-run, merge or branch deletion; the local branch `claude/laughing-dijkstra-654589` stays. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (`dfd4f43a`)
- 2026-11-22 CP2: adopted agent rules (test verification stages, tool selection, finding triage, shared writer rule, Skill-tool reading, PowerShell for Node, MSIX) at their owners (`e895c59d`)
- 2026-11-22 CP3 local part: CI E2E background Supabase start, cache steps and a reset-decision runner with a focused test; the reset skip is not enabled yet, pending the CI probe check (`56362dfc`)
- 2026-11-22 CP3: workflow opts into the reset skip through `E2E_SKIP_DB_RESET_EVIDENCE`; push this commit only after the probe check on `56362dfc` (`cf2ff2da`)
- 2026-11-22 CP1 step 4: the four approved worktrees removed with git worktree remove after the G6 recheck and the Owner's per-path confirmation; no prune, no branch deletion (`9b343dcd`)
- 2026-11-22 CP3 CI evidence recorded (slowest-shard median 557 s over two runs of `9b343dcd`, PR 194, G2 probe proven, AC7 identity holds); CP4 local part: duration-balanced smoke shard lists and a shard-ID identity check (this commit)
