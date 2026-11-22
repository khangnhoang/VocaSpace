# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U2 plan](./implementation-plans/u2-e2e-parallel-workers/plan.md) r3, Codex plan gate PASS, Owner-approved 2026-11-22. INFRA-U1: [plan](./implementation-plans/u1-test-runtime/plan.md) r3, closed. |
| Current unit / checkpoint | INFRA-U2 CP1 (not started). |
| Status | Plan r3 approved; handed to the Sonnet implementor for CP1–CP3. |
| Completed evidence | INFRA-U2 discovery 2026-11-22: a read-only audit of the 26 smoke files found 16 unsafe and 4 risky under more than one worker (shared fixture IDs, seeded rows, student-wide counts); facts in plan section 2. INFRA-U1 evidence is in its milestones and PR 194. |
| Accepted deviations | None. |
| Blockers / Owner decisions | INFRA-U2 Owner decisions 1–3 recorded in the plan. |
| Next action | Implementor starts CP1 with the base smoke ID list and the pilot pair. |
| Current authority | Owner 2026-11-22: implementation of r3 CP1–CP3 through the Sonnet implementor with local commits on `infra/u2-e2e-parallel`. CI budget: two runs on the final revision, each needing its own grant. No push, PR, re-run or merge. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (`dfd4f43a`)
- 2026-11-22 CP2: adopted agent rules (test verification stages, tool selection, finding triage, shared writer rule, Skill-tool reading, PowerShell for Node, MSIX) at their owners (`e895c59d`)
- 2026-11-22 CP3 local part: CI E2E background Supabase start, cache steps and a reset-decision runner with a focused test; the reset skip is not enabled yet, pending the CI probe check (`56362dfc`)
- 2026-11-22 CP3: workflow opts into the reset skip through `E2E_SKIP_DB_RESET_EVIDENCE`; push this commit only after the probe check on `56362dfc` (`cf2ff2da`)
- 2026-11-22 CP1 step 4: the four approved worktrees removed with git worktree remove after the G6 recheck and the Owner's per-path confirmation; no prune, no branch deletion (`9b343dcd`)
- 2026-11-22 CP4 local work added duration-balanced shard lists and a shard-ID check; the Owner then dropped CP4 and H6, and the next commit removes the shard lists again (`0edea8a7`)
- 2026-11-22 INFRA-U1 closed at CP3: CP3 CI evidence recorded (PR 194, slowest-shard median 557 s over two runs of `9b343dcd`, G2 probe proven, AC7 identity holds), CP4 and H6 dropped, FEAT-028 recorded (`354b7569`)
- 2026-11-22 INFRA-U1 merged to main (PR 194, 1e3ae411)
- 2026-11-22 INFRA-U2 opened: plan r3 for parallel E2E workers and balanced shards, Codex plan gate PASS, Owner-approved (this commit)
