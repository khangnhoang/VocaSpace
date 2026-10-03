# PR1 detail plan — documentation skill, templates, planning-skill fixes, auth-onboarding migration

## 1. Status and authority

- r3 2026-10-03 (r1 written the same day; r2 fixes Codex plan review r1: R1 State field-list owner, R2 link-check negative test, R3 rollback; Advisory A1 applied; r3 closes Codex r2's partial R3: rollback also covers the State blocks in the master and A1 plans; Codex r3 PASS, 0 Critical/Required) on `docs/doc-system-optimization` (worktree `C:\VocaSpace-docsys`, base `main` at `3094600`, no upstream). Source: [owner-spec.md](../../owner-spec.md) (Owner decisions 1–11, 2026-10-03).
- **Authority:** planning only. Implementation needs Owner approval of this plan plus a separate go-ahead. Commit, push, PR and merge each need explicit Owner permission. One Codex plan review round is pre-approved (Decision 11). The Owner answered Q1–Q4 on 2026-10-03 (§4); the plan itself is not yet approved.
- Size: **large** by governance signals, not file count: a new repo-local skill, a change to who owns State in the planning skill, and a migration of a live program that has an open hosted rollout (A1 step 6) and a parallel A2 session.
- This program has no `progress.md` yet; it is created in CP4 as the first instance of the new progress template. Until then the status lines above are the only State.

## 2. Binding Spec

### 2.1 Outcome

After PR1 merges, an agent that starts A2 (or any new program unit) can find one skill that tells it exactly which file holds what, copy the shape from a template instead of from an old program, and update State in one place; and `auth-onboarding` already follows that shape.

### 2.2 Acceptance

| ID | Observable result |
| --- | --- |
| AC1 | `.agents/skills/repo-docs-system/SKILL.md` exists, is routed in `AGENTS.md`, and `node .agents/scripts/validate-skill.mjs` returns `valid` with no new warning. `node .agents/scripts/run-skill-evals.mjs validate --all` still passes. |
| AC2 | The skill states: the file-role table (master plan, detail plan, progress, problems, future-features, sources) with "holds / must not hold"; that progress is the only State owner; the default update rule; the lifecycle (active / closed / legacy) and the exact legacy banner; "use the templates, never copy structure from existing program docs"; English docs / Vietnamese reports; size targets as soft guidance. |
| AC3 | Templates exist for master plan, detail plan, progress and problems, each routed with an exact read condition. A detail plan built from the template has no State section, only a one-line pointer to progress. |
| AC4 | `implementation-planning-and-pr-breakdown` no longer tells a plan author to keep a State section when program progress exists, names the default update points, bounds "repository facts", says the master plan has no State, and routes document shape to `repo-docs-system`. It keeps State semantics (what State is, when to update it, how discoveries are routed) but no longer defines the State field list; that list exists only in the `repo-docs-system` progress template. No other behaviour of that skill changes. |
| AC5 | `docs/refactors/auth-onboarding/` follows the templates: master `plan.md` has no State section; `progress.md` has one in-place State block plus one-line milestones; `problems.md` resolved entries are one line; the A1 detail plan has a pointer line instead of §11 State (see Q2). No Owner decision, invariant, gate, runbook step or open problem is lost or changed in meaning (checked against `main` at `3094600` and the facts in §3.4). |
| AC6 | A link check over `docs/`, `.agents/`, `.claude/`, `AGENTS.md`, `README.md` reports no broken relative link that is not in the recorded baseline (§3.3). Every path cited by a published migration still resolves. |
| AC7 | `docs/README.md` records the docs taxonomy decision and which moves are deferred to PR2. |

### 2.3 Scope

- New skill `repo-docs-system` (working name, Decision 9) with templates and a migration procedure.
- `AGENTS.md` route; one ownership line in `docs/agent-loops.md` "Skill Ownership".
- The five planning-skill gaps from the owner spec, in `SKILL.md`, `references/spec-state-and-hierarchy.md`, `references/tracked-program-and-durable-plan.md`.
- `docs/README.md` (taxonomy index, new).
- Migration of `docs/refactors/auth-onboarding/` (`plan.md`, `progress.md`, `problems.md`, A1 `plan.md` State section).
- A small dependency-free link-check script with a `node --test` behaviour test and a committed baseline (Q3).
- This program's own `progress.md` (CP4).

### 2.4 Non-goals (PR2 or later)

- Any file move or rename under `docs/` (PR1 needs none; §3.2).
- Migration of `student-user-flow-route` or any other program; legacy banners on closed programs.
- ADR, SOP and future-features templates (no PR1 consumer; added in PR2 with the ADR/SOP restructure).
- Fixing the 74 pre-existing broken links (§3.3); CI wiring of the link check (Q3).
- New eval suites for either skill; changes to `maintain-repo-skills`, `native-multi-agent-workflow`, `.claude/`, `.codex/`.
- Anything in `C:\VocaSpace` or on `feat/auth-a2-password-recovery` (the A2 session owns it; Q1).

### 2.5 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Migration preserves meaning: every Owner decision, invariant (G1–G8, hard rules after T_on), gate, rollout step and open problem in the old files appears in the new files with the same meaning. Reword only for shape; do not re-decide. | A2/A4 or the Owner rollout loses a reviewed safety rule (e.g. "never turn off Confirm email"). |
| G2. Never edit a published migration; keep every path cited by `supabase/migrations/*.sql` resolvable. | Published contract comments point at nothing; editing them breaks "never edit a published migration". |
| G3. Do not touch `C:\VocaSpace`, its untracked `a2/` plan or its branch. | Destroys or races the parallel A2 session's work. |
| G4. The new skill owns document shape and State placement only; planning method, approval and permission rules stay in `implementation-planning-and-pr-breakdown`, `maintain-repo-skills` and `docs/agent-loops.md`. No rule in those sources is weakened. | Two skills claim the same rule, or a permission gate silently disappears (safety veto in `maintain-repo-skills`). |
| G5. Every bundled file is routed in the skill's resource table (validator `RESOURCE_NOT_ROUTED`). | Validator warning; unrouted template never read. |

### 2.6 Owner decisions applied

Decisions 1–11 of the owner spec. Agent proposals that need Owner confirmation are marked **P** below and in §4.

- **P1 — skill layout:** `SKILL.md` (core: activation, ownership split, taxonomy, file-role table, State rule and update points, lifecycle + banner, templates-not-examples rule, language, size guidance, stop conditions) + `references/templates/{master-plan,detail-plan,progress,problems}.md` + `references/migration.md` (read only when migrating an existing program). future-features and `sources/` are one table row each, no template.
- **P2 — default update rule:** State is updated in the same commit as the checkpoint code; a standalone docs commit only for a blocker, a merge/rollout event, or a session handoff. Milestones are one line: date, what, commit/PR.
- **P3 — repository facts:** a detail plan keeps only facts that justify a Spec item or expose a conflict, with baseline commit; frozen after approval (implementation discoveries go to State as deviations, not back into facts).
- **P4 — taxonomy for PR1:** program home stays `docs/refactors/<program>/` because four published migrations cite paths under it (§3.2). PR1 moves nothing; `docs/README.md` lists the PR2 candidates (ADR files that are plans/progress, `data_flow/`, agent-program folders).
- **P5 — no `_old` files:** the old versions stay in Git at `3094600`; the migration review diffs against `git show 3094600:<path>`. (Decision 3 allows either; Owner confirmed 2026-10-03, Q2.)

## 3. Repository facts (baseline `3094600`, checked 2026-10-03)

### 3.1 Skills and validation

- 14 skills in `.agents/skills`; no documentation skill. `maintain-repo-skills` and `native-multi-agent-workflow` have no eval suite, so a suite is not mandatory for a new skill.
- CI (`.github/workflows/ci.yml`) runs `validate-skill.test.mjs`, `run-skill-evals.test.mjs`, `validate-skill.mjs` and `run-skill-evals.mjs validate --all`. The validator reports a skill without an explicit `AGENTS.md` route as a warning (`SKILL_NOT_EXPLICITLY_ROUTED`), not an error, and warns on any bundled file missing from the resource routing table (`RESOURCE_NOT_ROUTED`); the route itself is required by `AGENTS.md`/`maintain-repo-skills`, and AC1 treats any new warning as a failure.
- `implementation-planning-and-pr-breakdown` eval suites contain no expectation about a State section in plans, so gap fixes 1–5 should not break them. `validate --all` checks suite and context structure only; it does not execute expected behaviour, so semantic evidence for the planning-skill change comes from the fresh-reader cases (Q4).
- `maintain-repo-skills` requires a fresh-reader check when changed skill text changes source-of-truth hierarchy or lifecycle/status interpretation (fix 1 and the new skill do). Self-review does not count.

### 3.2 Paths that constrain moves

- Published migrations cite `docs/refactors/student-user-flow-route/implementation-plans/d3/plan.md`, `.../d4/plan.md` and `docs/refactors/auth-onboarding/implementation-plans/a1/plan.md`.
- `AGENTS.md`, skills, `.claude/agents/*`, `.codex/agents/*` cite `docs/agent-loops.md` and `docs/agent-self-review.md`; frontend skills cite `docs/ui-design-system-and-review/`; `README.md` cites `docs/case-studies/` and `docs/agent-skills`; eval suites cite many `docs/agent-skills/...` paths; `.gitignore` cites `docs/native-multi-agent/reviews/`.

### 3.3 Link baseline

No markdown link checker exists in the repo (no dependency, no script). A throwaway scan of 208 `.md` files found 74 broken relative links in 6 files: four `student-user-flow-route/implementation-plans/d1/correction-plan-deepseek*.md` (72), `.agents/skills/playwright-cli/references/pr-attachments.md` (1), `.claude/README.md` (1, gitignored reviews dir).

### 3.4 auth-onboarding state outside `main`

- `main` (`3094600`) has the A1 merge but its docs still say "Next: merge PR 119".
- Unpushed `ade2cd6` on `feat/auth-a2-password-recovery` records: A1 merged in PR 119, hosted step 5 passed (Owner, production), A1 Rollout pending until step 6 (after A2 + AUTH-013); it edits the same three files PR1 migrates.
- Untracked `a2/plan.md` r1 (old format, has its own State) and an uncommitted `progress.md` edit (A2 = Planning) exist in `C:\VocaSpace`.

## 4. Owner answers (2026-10-03)

- **Q1 — A2 coordination:** PR1's migrated `progress.md` carries the `ade2cd6` facts (A1 merged, step 5 passed, A2 planning r1 exists). The A2 session pauses until PR1 merges, then rebases on `main`, drops `ade2cd6`, and reshapes `a2/plan.md` to the detail template (State → progress) before its review.
- **Q2 — A1 detail plan:** frozen. §11 State becomes the pointer line, the legacy banner is added, everything else and its path stay. P5 confirmed: no `_old` files; old versions live in Git at `3094600`.
- **Q3 — link check:** `scripts/docs/check-links.mjs` (no dependency) + `npm run docs:check-links`, with a committed baseline list; PR1 acceptance = no new broken link. CI step and baseline cleanup in PR2.
- **Q4 — fresh-reader:** 2–3 read-only manual cases in CP2 with a fresh Claude subagent given only `AGENTS.md`, the two skills and a scenario (e.g. "A2 checkpoint CP2 done — which files do you update and how?"), recorded with the `maintain-repo-skills` fresh-reader record. This authorizes those runs only once implementation is approved.

## 5. Bounded implementation hypotheses

- Planning-skill edits are small replacements in the two references plus one row in `SKILL.md` "Related skills" and step 12; the State field list moves out of `spec-state-and-hierarchy.md` into the `repo-docs-system` progress template, and the reference keeps State semantics plus a pointer to that template (one owner for document shape, G4).
- The progress State block reuses the existing ~8 State fields (revision, unit/checkpoint, status, evidence, deviations, blockers, next action, authority) plus "hosted state" for programs with production rollout.
- Master plan migration mostly deletes §10 State and shortens §1; decisions stay numbered and dated (already close to one line each).
- `problems.md`: AUTH-011 is the likely resolved entry to shrink; others stay open.
- Changing these is fine while AC1–AC7 and G1–G5 hold.

## 6. Checkpoints

Order is a hard dependency chain: the templates must exist before the migration uses them; the link check must exist before CP3 is verified.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `repo-docs-system` skill + templates + migration reference + `AGENTS.md` route + `agent-loops.md` ownership line + `docs/README.md` | `validate-skill.mjs` valid, no new warning; `run-skill-evals.mjs validate --all`; `node --test .agents/scripts/validate-skill.test.mjs`; self-review against AC1–AC3, AC7, G4–G5 |
| CP2 | Planning-skill gaps 1–5 fixed; routes to `repo-docs-system` | Same validator runs; `git diff` shows no change outside the listed sections; 2–3 fresh-reader cases (Q4) |
| CP3 | Link-check script + baseline + its test; auth-onboarding migrated | `node --test scripts/docs/check-links.test.mjs` with fixture files proves: valid links exit 0, a broken link listed in the baseline is accepted, a broken link not in the baseline exits non-zero; link check on the repo: no new broken link; every migration-cited path resolves; side-by-side meaning check of old (`3094600`) vs new per G1, recorded as a short checklist in the commit message body or review notes, not in the docs |
| CP4 | This program's `progress.md` from the template; this plan's §8 becomes the pointer line; full-PR self-review | `git diff --check`; validator; link check |

The one pre-approved Codex round (Decision 11) reviews this plan after the Owner answers §4, before implementation.

Checkpoints are review/resume boundaries; commits happen only with Owner permission.

## 7. Risks, stop and rollback

| Risk | Mitigation |
| --- | --- |
| Migration silently drops a hosted safety rule | G1 meaning check; keep A1 plan frozen (Q2); Codex review covers the migrated files only if the Owner asks for a second round |
| A2 session edits the same files in parallel | Q1; PR1 never touches `C:\VocaSpace`; stop if the A2 branch is pushed or merged before PR1 |
| New skill and planning skill overlap or contradict | G4; fresh-reader cases (Q4); stop and report any rule both skills claim |
| Validator or eval regression | Run CI-equivalent commands locally before handoff |

Stop when: `main` moves and touches `docs/refactors/auth-onboarding/`; a migrated rule cannot be expressed without changing meaning; the validator reports an error; an Owner question changes scope. Rollback: PR1 is docs and skill text only, with no hosted or database state, but a full revert would restore pre-reconcile auth-onboarding State ("Next: merge PR 119") and drop the `ade2cd6` facts PR1 carries (Q1). So: before merge, fix forward on the branch; after merge, prefer a bounded correction PR. A revert must keep the auth-onboarding `progress.md` State and milestones at their current truth, and keep the master `plan.md` and A1 `plan.md` without State (pointer to progress); if any old State block (master §10, A1 §11) is restored, reconcile it to current truth or mark it historical in the same change before the rollback is complete; if A2 has already started on the new format, stop and reconcile its State and dependencies with the Owner before any revert.

## 8. State

Current State and milestones: [progress.md](../../progress.md).
