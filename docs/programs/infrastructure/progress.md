# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U1 plan](./implementation-plans/u1-test-runtime/plan.md) r3, Owner-approved 2026-11-22. |
| Current unit / checkpoint | INFRA-U1 CP1, CP2 and CP3 done; CP4 and H6 dropped by the Owner. |
| Status | INFRA-U1 closed out at CP3 pending the Owner's merge of PR 194. |
| Completed evidence | AC1 and AC2: `npx vitest list --filesOnly` 702 → 167 files and the integration config 203 → 52, none under `.claude/worktrees`, main-checkout lists identical; `tsc` already listed none, ESLint now ignores worktrees. AC3: four worktrees removed after the G6 recheck. AC4 and AC5: `validate-skill.mjs` and `docs:check` pass. CP3 (PR 194, slowest shard job over its E2E job pair, seconds; baseline median 683): `56362dfc` run 44955514848 attempt 1, all caches miss, 572 / 579, G2 probe proven on both shards (data volume absent before start, present after), setup-cli and npx both 2.106.0; attempt 2, Playwright and Next caches hit, build 9–14 s, 448 / 586; `9b343dcd` run 44957368378 with the reset skipped on both shards, attempt 1 523 / 467, attempt 2 591 / 492. Median of the slowest shard over the two `9b343dcd` runs: 557 s, 126 s below the baseline (AC6 as judged by the Owner, see deviations). Step medians on `9b343dcd`: dependencies about 77 s, Chromium with cache hit 16 s, wait for Supabase about 37 s (the start still outlasts `npm ci` and Chromium), build 13–15 s, E2E run 299–411 s; the E2E step of one shard varied by up to 64 s on one revision. AC7 for `9b343dcd`, both attempts, from the saved shard logs: 86 distinct IDs in the merged shards, each once and passed, equal to `npx playwright test e2e/smoke --list` (86); `scripts/e2e/shard-ids.mjs` repeats this check from any pair of shard logs. |
| Accepted deviations | Owner 2026-11-22: CP4 and H6 (shard balancing) are dropped because the GitHub Actions quota is nearly used up, and no further CI run is made. AC6 is judged on the two `9b343dcd` samples (slowest-shard median 557 s against the 683 s baseline, about 126 s faster); AC8 is not run; AC7 is checked on `9b343dcd` only, which is the revision CI ran. The shard decision stays at 2 shards. Shard balancing and the 3/4-shard measurement are recorded as [FEAT-028](./future-features.md#feat-028-balance-e2e-shards-and-measure-3-and-4-shards). |
| Blockers / Owner decisions | None open; the merge of PR 194 is the Owner's. |
| Next action | Owner merges PR 194. |
| Current authority | Owner 2026-11-22: implementation of r3 and local commits on `docs/infra-u1-test-runtime`. No push, PR, re-run, merge or branch deletion; the local branch `claude/laughing-dijkstra-654589` stays. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (`dfd4f43a`)
- 2026-11-22 CP2: adopted agent rules (test verification stages, tool selection, finding triage, shared writer rule, Skill-tool reading, PowerShell for Node, MSIX) at their owners (`e895c59d`)
- 2026-11-22 CP3 local part: CI E2E background Supabase start, cache steps and a reset-decision runner with a focused test; the reset skip is not enabled yet, pending the CI probe check (`56362dfc`)
- 2026-11-22 CP3: workflow opts into the reset skip through `E2E_SKIP_DB_RESET_EVIDENCE`; push this commit only after the probe check on `56362dfc` (`cf2ff2da`)
- 2026-11-22 CP1 step 4: the four approved worktrees removed with git worktree remove after the G6 recheck and the Owner's per-path confirmation; no prune, no branch deletion (`9b343dcd`)
- 2026-11-22 CP4 local work added duration-balanced shard lists and a shard-ID check; the Owner then dropped CP4 and H6, and the next commit removes the shard lists again (`0edea8a7`)
- 2026-11-22 INFRA-U1 closed at CP3: CP3 CI evidence recorded (PR 194, slowest-shard median 557 s over two runs of `9b343dcd`, G2 probe proven, AC7 identity holds), CP4 and H6 dropped, FEAT-028 recorded (this commit)
