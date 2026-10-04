# PR2 detail plan — docs structure check, program home, indexes, remaining migration and legacy marking

Revision: r4, 2026-10-05. Owner approval: 2026-10-05 (§1.4 decisions answered 2026-10-05; Codex plan round 1 found 7 Required, fixed in r3; round 2 found 2 Required, fixed in r4). Owner spec: [owner-spec.md](../../sources/owner-spec.md). PR1 plan: [pr1/plan.md](../pr1/plan.md).

r4 fixes Codex rounds 2–3: `no-state-in-plan` matches only the exact titles `State` and `Current State` (the owned rule); CP2 checks only `docs/refactors/` paths, CP4 adds the teacher-workflow paths; the bannered-program exemption is named a legacy-format exemption, separate from lifecycle.

r3 fixes Codex round 1: legacy programs are exempt from shape rules (so D1's living design references need no banner); lifecycle is separate from file format; CP2 remaps the link baseline; auth-onboarding `problems.md` is normalized and every active-program file audited; D6 also edits `maintain-repo-skills`; exact grammar lives in the templates; current and historical path references are verified separately.

r2 changes from r1: program home becomes `docs/programs/`; checker scope is "any folder with `progress.md`"; no owner-review-brief role; ADR scope, template and index; Programs index in `docs/README.md`; progress State holds the current unit only; auth-onboarding `progress.md` cleanup; `native-multi-agent` adopted and closed.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after PR2 merges, an agent cannot claim that program docs follow the `repo-docs-system` shape when they do not. The mechanical rules are checked by a script that the skill tells the agent to run and that CI runs on every PR. Every program lives in `docs/programs/<program>/` and follows the templates, or is marked legacy. Each fact has one owner, and two small indexes let an agent find every program and every cross-program decision without browsing folders.

| ID | Observable result |
| --- | --- |
| AC1 | `npm run docs:check-structure` exits 0 on the PR2 head, and exits 1 with `file:line [rule-id] message` for each violation of the rules in §1.5. `npm run docs:check` runs the structure check and the link check and fails if either fails. |
| AC2 | `node --test scripts/docs/check-structure.test.mjs` proves each rule in §1.5 with a fixture that passes and one that fails. It also proves that a bannered file is skipped by shape rules, that a program is found by its `progress.md` in any folder under `docs/`, and that a usage error exits 2. |
| AC3 | `.github/workflows/ci.yml` job `Test and Build` runs `npm run docs:check` and both `scripts/docs/*.test.mjs` suites. A PR that breaks a §1.5 rule or adds a new broken link fails `Test and Build`, and so `production-gate`. `production-gate` itself is unchanged. |
| AC4 | `repo-docs-system/SKILL.md` has a "Verify" section telling the agent to run `npm run docs:check` after editing docs and before claiming done or committing, and to report the result. It states the new rules in §1.6. The validator returns `valid` with no new warning, and `run-skill-evals.mjs validate --all` passes. |
| AC5 | `auth-onboarding`, `doc-system-optimization` and `student-user-flow-route` live under `docs/programs/`, moved with `git mv`. The three migration-cited paths under `docs/refactors/` resolve to one-line redirect files pointing at the new location. No other file remains under `docs/refactors/`. Skill text, templates and `docs/README.md` name `docs/programs/<program>/` as the program home. |
| AC6 | `docs/programs/student-user-flow-route/` follows the templates in English: master `plan.md` without State; `progress.md` with only `## State` and `## Milestones`; `problems.md` with resolved entries as one line. `implementation-plans/README.md` is removed (its unit list and status duplicate the master plan and progress). Frozen detail plans and other non-role files keep their content and get the legacy banner. No Owner decision, invariant, gate, deferred unit (D5, D6, D8, D9) or open problem is lost or changed in meaning against `eb36618`. |
| AC7 | Every file of an active program passes the checker. For auth-onboarding this includes `problems.md` (AUTH-002 and AUTH-004 gain the template fields, `Resolved when` becomes `Exit condition`, meaning unchanged). `docs/programs/auth-onboarding/progress.md` has only `## State` and `## Milestones`. State cells describe the current position only (no unit active; A3 or A4 next). Each fact removed from it is first confirmed present in the PR body or commit it came from (PR 119, 121, 122, 124, 125), or kept as a one-line milestone or a `problems.md` entry. |
| AC8 | Closed programs are bannered as decided in §1.4 D1, and `adr/refactor-teacher-workflow-*` moves to `docs/programs/teacher-workflow/`. `native-multi-agent/progress.md` gets one milestone recording the Owner's adoption (2026-10-05) before its banner. |
| AC9 | `docs/README.md` has a Programs table: one row per program with path and lifecycle (active, closed, legacy), no status column, and a line saying current status is read from that program's `progress.md` State. `docs/adr/README.md` lists every ADR with date, status and one-line summary. The checker fails when either index misses an entry (§1.5). |
| AC10 | `repo-docs-system` has an ADR template, and `docs/adr/docs-system.md` records this program's durable decisions (D3–D7, D9 below, and PR1's single State owner and English docs) with context and consequences. |
| AC11 | `scripts/docs/link-baseline.txt` shrinks: the root-relative code links in the four D1 correction plans are fixed. Every remaining entry has a comment saying why it stays. `npm run docs:check-links` reports 0 new broken links. This program's `progress.md` State is current. |

### 1.2 Scope and non-goals

- In scope:
  - `scripts/docs/check-structure.mjs` and its test, the npm scripts, and CI steps;
  - `repo-docs-system` SKILL text (§1.6), the ADR template, path updates in the four templates and `references/migration.md`;
  - removing the owner-review-brief document owner from `implementation-planning-and-pr-breakdown/references/tracked-program-and-durable-plan.md` line 51 and `maintain-repo-skills/SKILL.md` line 124, stating that existing briefs are history and new decisions go to the plans (D6);
  - the `docs/programs/` move, the three redirect files, migration of `student-user-flow-route`, the auth-onboarding `progress.md` cleanup and `problems.md` normalization, banners and the teacher-workflow move;
  - `docs/README.md`, `docs/adr/README.md`, `docs/adr/docs-system.md`, moving this program's `owner-spec.md` to `sources/owner-spec.md`, link-baseline cleanup, this program's `progress.md`.
- Non-goals:
  - rewriting or translating closed or legacy content, including the four existing ADRs;
  - moving `docs/agent-loops.md`, `docs/agent-self-review.md`, `agent-skills/`, `agent-workflow/`, `native-multi-agent/`, `ui-design-system-and-review/`, `data_flow/`, `agent-self-review-plan.md`;
  - editing a published migration;
  - checking whether State is true, whether an exit condition is really met, whether State cells are short enough, or whether State was updated in the same commit (judgment, left to the agent and review);
  - a pre-commit hook; SOP templates; product code;
  - updating agent memory (outside the repo; done separately by the agent).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The checker enforces only rules stated in `repo-docs-system` (SKILL or templates). A rule the checker needs is added to the skill in the same checkpoint, not invented in code. | Two owners for one rule; the script and the skill drift apart and agents follow the wrong one. |
| G2. Migration and cleanup preserve meaning, as in PR1 G1: every Owner decision, invariant, gate, deferred unit, open problem and evidence fact appears in the new files or in a cited PR/commit with the same meaning, checked against `git show eb36618:<path>`. | A live program loses an Owner decision (for example D5 deferred but not dropped) or a hosted-state fact. |
| G3. Never edit a published migration. The paths cited by `supabase/migrations/*.sql` (`refactors/auth-onboarding/.../a1/plan.md`, `refactors/student-user-flow-route/.../d3/plan.md`, `.../d4/plan.md`) keep resolving, through redirect files. | Published contract comments point at nothing. |
| G4. Wire CI only after the repository passes `docs:check` on the branch, checked in a clean checkout. Do not rename, duplicate or change `production-gate`. | `main` goes red for every PR; the production release gate SOP is broken. |
| G5. Legacy content is not rewritten. A bannered file gets the banner line, and changes only where a link must be fixed for a move or for AC11. The only content addition to a legacy file is the AC8 adoption milestone. | Closed history is rewritten without review; meaning drifts in files nobody re-reviews. |
| G6. `scripts/docs/*.test.mjs` stays out of vitest (the `vitest.config.ts` exclude from PR1). | The PR #120 CI failure repeats. |
| G7. The move checkpoint is a pure `git mv` plus link and path fixes, with no content edits, in its own commit. | Git loses rename detection and file history breaks; reviewers cannot separate moves from rewrites. |

### 1.4 Owner decisions that bind this unit

All dated 2026-10-05.

- D1. Lifecycles (lifecycle is independent of file format: a closed program may be bannered or not): `student-user-flow-route` is active and migrated. `teacher-workflow`, `agent-skills`, `agent-workflow` and `native-multi-agent` are closed and bannered. `ui-design-system-and-review` is closed: banner only its program files (`plan.md`, `progress.md`, `implementation-plans/**`), not the living design references (`index.md`, `product-language.md`, `components/`, `screen-types/`, `surfaces/`, `candidates/`).
- D2. The Owner adopts the native multi-agent workflow (its Phase 5 "adoption pending Owner" is resolved).
- D3. Program home is `docs/programs/<program>/` for every program, whether refactor or feature. No `refactors/` vs `features/` split. The three migration-cited paths keep redirect files.
- D4. The checker finds a program by its `progress.md`, in any folder under `docs/`, not by folder name.
- D5. Moves: only `adr/refactor-teacher-workflow-{plan,problems,progress}.md`, to `docs/programs/teacher-workflow/`. The other closed program folders stay where they are (eval suites, `.gitignore`, `scripts/` and `README.md` cite them).
- D6. No owner-review-brief role. Owner decisions live in the master plan or the detail plan §1.4; current authority lives in progress State. Existing briefs stay as history under banners.
- D7. `docs/adr/` holds decisions that outlive one program or span programs (architecture, product rules, workflow, docs structure). Program-only decisions stay in that program's master plan. `docs/adr/README.md` indexes them. The four existing ADRs keep their content.
- D8. Clean up auth-onboarding `progress.md` in this PR (AC7).
- D9. Progress State describes the current unit only; a finished unit shrinks to milestone lines citing its PR.
- D10. Review: author self-review, one Codex round on this plan, one Codex implementation round. Fresh-reader cases run after the implementation review passes, and only for the changed skill text.

### 1.5 Rules the checker enforces

A program is a folder under `docs/` containing `progress.md` (D4). A program whose `progress.md` is bannered has the legacy-format exemption: its files get only `legacy-banner`, and the program gets only `programs-index`. Its indexed lifecycle (closed or legacy) is independent of this exemption. This keeps D1's living design references in `ui-design-system-and-review` and the D5 retained folders valid without extra banners. Each rule maps to skill text; rules marked "§1.6" need the new text added in CP1 (G1). Test fixtures are derived from the templates.

| Rule ID | Check | Skill source |
| --- | --- | --- |
| `legacy-banner` | A file containing the exact banner has it as its first non-blank line, or as the first non-blank line after YAML front matter (blank lines allowed, as in `a1/plan.md`). A bannered file is skipped by every shape rule. | SKILL "Lifecycle and legacy marking" |
| `file-role` | In a program without the legacy-format exemption, every `.md` is one of: `plan.md`, `progress.md`, `problems.md`, `future-features.md`, `sources/**`, `implementation-plans/<unit>/plan.md`. Otherwise it is bannered. | SKILL "File roles" |
| `progress-state` | Unless bannered, `progress.md` has exactly two `##` headings, `State` then `Milestones`. The State table has every required field of the progress template ("Hosted state" optional). | progress template; §1.6 "only State and Milestones" |
| `no-state-in-plan` | A master or detail `plan.md` has no heading whose text, after any number prefix and ignoring case, is exactly `State` or `Current State`, unless that section's only content is the one-line pointer to `progress.md` (as in `pr1/plan.md` §8). A detail `plan.md` links to `progress.md`. Other headings that contain the word are allowed; AC2 fixtures include passing `## State transitions` and `## 2. State transitions`. | SKILL "State has one owner"; detail-plan template |
| (scope) | `sources/**` and `future-features.md` get `legacy-banner` and `file-role` only. | SKILL "File roles" ("no template") |
| `milestone-format` | Each list item under `## Milestones` matches the grammar stated in the progress template (§1.6): date, text, and a final parenthesis holding a short hash, `PR <n>`, both, or `this commit`. | progress template (§1.6) |
| `this-commit` | At most one milestone cites `(this commit)`, and it is the last one. | progress template (§1.6) |
| `problems-shape` | `problems.md` has `## Open` and `## Resolved`. Each open `###` entry has Status, Problem, Evidence, Direction and Exit condition. Each resolved entry is one list line. IDs are unique across both sections. | SKILL "Problems", problems template |
| `programs-index` | Every program has exactly one row in the `docs/README.md` Programs table, and every row points to a program. A row marked `active` must not have a bannered `progress.md`; a bannered `progress.md` must not be marked `active` (closed or legacy both allowed). | §1.6 |
| `adr-index` | Every `docs/adr/*.md` except `README.md` is linked from `docs/adr/README.md`. | §1.6 |
| `redirect-only` | Every `.md` under `docs/refactors/` is a redirect file (one heading and one line linking under `docs/programs/`). | §1.6 |

### 1.6 Skill text added in CP1

- Verify section: run `npm run docs:check`; report its result; do not claim the docs shape is correct without it.
- `progress.md` has only `## State` and `## Milestones`. State describes the current unit and current authority only; when a unit finishes, its evidence shrinks to milestone lines citing the PR or commit that holds the detail.
- In the progress template: the exact milestone grammar (`- YYYY-MM-DD <text> (<ref>).` where `<ref>` is a short hash, `PR <n>`, `PR <n>, <hash>`, or `this commit`); at most one `(this commit)`, always last; replace it with the hash in the next commit that edits the file.
- Legacy banner placement: first non-blank line, or first non-blank line after YAML front matter. A program with a bannered `progress.md` has the legacy-format exemption from file roles and shape rules; its lifecycle is recorded separately in the Programs index.
- Taxonomy: new and active programs live in `docs/programs/<program>/`; closed programs listed in the Programs index may stay where they are (D5); `docs/refactors/` holds redirect files for migration-cited paths only.
- Programs index: every program has a row in `docs/README.md` with lifecycle; status is not copied there. Update the row when the lifecycle changes.
- Closing a program: State says completed, open problems are resolved or moved to another program, the Programs row becomes `closed`.
- ADR: when to write one (D7), the template, and the `docs/adr/README.md` index rule.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `eb36618`, checked 2026-10-05.

- PR1 shipped only `docs:check-links` (`scripts/docs/check-links.mjs`, 186 lines, exports `findBrokenLinks`). No script checks document shape, and CI runs neither. This justifies AC1–AC3.
- `ci.yml` `Test and Build` already runs the `node --test` suites for `.agents/scripts` and the skill validators. `production-gate` only requires that job. This justifies AC3 and G4.
- `vitest.config.ts` excludes `scripts/docs/**/*.test.mjs` (PR #120 fix `e34ce16`). This justifies G6.
- 65 of the 66 baseline entries are root-relative code links (for example `app/layout.tsx#L8`) in the four `student-user-flow-route/implementation-plans/d1/correction-plan-deepseek*.md` files. The 66th is `.claude/README.md -> ../docs/native-multi-agent/reviews/`, a gitignored folder that exists locally, so a local run reports 65 while a clean checkout reports 66. This justifies AC11 and the clean-checkout runs in CP5.
- `student-user-flow-route` is Vietnamese and in the old shape: `plan.md` 485 lines, `progress.md` 852, `problems.md` 420; 26 `.md` files. Its plan records D5 as deferred (Owner Decision 20) and D6, D8, D9 as open. `implementation-plans/README.md` has a "planning status" column per unit (merged PRs) that duplicates progress. This justifies AC6.
- `auth-onboarding/progress.md` (migrated in `4fa8813`, 2026-10-04) has two extra sections between State and Milestones, `## A2 local verification` and `## A2 review correction` (command and review logs), and State cells that carry review history and the evidence of all four finished units. Its `problems.md` has AUTH-002 without Evidence and with `Resolved when` instead of `Exit condition`, and AUTH-004 without Direction and Exit condition. This justifies AC7, D9 and the `progress-state` section check.
- Four published migrations cite exactly three docs paths: `docs/refactors/auth-onboarding/implementation-plans/a1/plan.md` and `docs/refactors/student-user-flow-route/implementation-plans/{d3,d4}/plan.md`. Outside `docs/` and migrations, `repo-docs-system` SKILL and templates and `scripts/docs/link-baseline.txt` (entries key on the source path, `check-links.mjs` line 140) name `docs/refactors`. Historical revision-qualified references such as `git show <rev>:docs/refactors/...` exist in program files and stay valid. No unmerged local branch changes files under `docs/refactors/`. This justifies D3, AC5 and G3.
- Files outside `docs/` cite `docs/agent-skills` (8 files), `docs/native-multi-agent` (4) and `docs/ui-design-system-and-review` (4); nothing outside `docs/` cites `docs/adr/refactor-teacher-workflow-*`. This justifies D5.
- `native-multi-agent/progress.md` records Phase 5 complete (`e313309`, on `main`) with "adoption pending Owner". This justifies AC8.
- `implementation-planning-and-pr-breakdown/references/tracked-program-and-durable-plan.md` line 51 and `maintain-repo-skills/SKILL.md` line 124 name an owner-review brief as a document owner; `repo-docs-system` has no such role; 24 tracked briefs exist: 21 in `agent-skills`, `agent-workflow` and `native-multi-agent` (bannered by D1) and 3 in `student-user-flow-route` detail folders (bannered by AC6). This justifies D6.
- `docs/adr/` holds four ADRs (last edited 2026-09-04) plus the three teacher-workflow program files. This justifies D5, D7 and AC10.
- This program has `owner-spec.md` at its root, which is not a file role. This justifies moving it to `sources/`.

## 3. Bounded implementation hypotheses

- `check-structure.mjs` reuses the markdown file walk and code-span stripping from `check-links.mjs`. It may extract a small shared module, provided `check-links` keeps its CLI, exit codes and tests.
- The rules use line-based parsing (headings, table rows, list items), not a markdown AST dependency. This may change if every AC2 fixture still holds and no dependency is added.
- The new `student-user-flow-route` `progress.md` reuses the auth-onboarding State fields; unit status lives only in State and milestones.
- Bannering is done by a throwaway local command, not a committed script.
- The meaning checklists for AC6 and AC7 go in the commit body, not in a repository file.

## 4. Checkpoints

Hard order: CP1 is needed to verify CP2–CP4; CI (CP5) is wired only once everything passes.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Checker, test, `docs:check-structure` and `docs:check` npm scripts; `repo-docs-system` §1.6 text, progress-template grammar and ADR template; D6 edits in the planning skill reference and `maintain-repo-skills` | `node --test scripts/docs/check-structure.test.mjs`; `check-links.test.mjs` still 7/7; `validate-skill.mjs` valid for all three changed skills, no new warning; `run-skill-evals.mjs validate --all`; `validate-skill.test.mjs`. Checker on the repo lists violations (expected before CP2–CP4) |
| CP2 | `git mv docs/refactors/<3 programs> docs/programs/`; three redirect files; path updates in skill, templates, `migration.md`, `docs/README.md`; source paths in `link-baseline.txt` remapped (same 65 entries, new paths); current links fixed (G7) | `git diff -M --stat` shows renames; `docs:check-links` 0 new with the same entry count; each redirect file links to the exact moved file and that file exists; current-reference check (below) for `docs/refactors/` only |
| CP3 | `student-user-flow-route` migrated (English, templates); README removed; non-role files bannered; D1 correction-plan links fixed; baseline shrunk | Checker 0 violations for this program; `docs:check-links` 0 new; G2 meaning checklist against `eb36618` in the commit body |
| CP4 | Auth-onboarding `progress.md` cleanup and `problems.md` normalization (AC7); D1 banners and the NMA adoption milestone; teacher-workflow move; `owner-spec.md` to `sources/`; Programs index; `docs/adr/README.md` and `docs/adr/docs-system.md` | `npm run docs:check` exits 0 on the whole repo; AC7 fact checklist in the commit body; current-reference check (below) for both `docs/refactors/` and `adr/refactor-teacher-workflow-` |
| CP5 | First `docs:check` in a clean `git worktree` of the branch head, then CI steps; this program's `progress.md`; full-PR self-review | `vitest run` (G6); all CI-equivalent commands locally; `git diff --check` |

Current-reference check: Markdown links are covered by the link check. Literal path mentions are found with `git grep -n` for the moved prefixes of that checkpoint (CP2: `docs/refactors/`; CP4: also `adr/refactor-teacher-workflow-`); every hit must be a published migration, a redirect file, a revision-qualified historical reference (`git show <rev>:<path>`, a commit-pinned URL), or dated milestone or legacy text describing the past. Historical references are not rewritten.

CP5's CI step is proven in the real PR run. To prove the gate fails, add one temporary violation in the working tree, run `docs:check` locally, then restore the file. Do not push a red commit.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The checker flags legitimate shapes and agents learn to banner files to silence it | Rules are only the §1.5 mechanical subset; the banner is reserved for closed or frozen files; review checks any new banner |
| State cells grow again, which the checker cannot measure | D9 rule text plus the size guidance; review judges it |
| The student-user-flow-route migration or the auth cleanup drops a decision or evidence fact | G2 checklists in commit bodies; the Codex implementation round covers these files |
| Rewriting about 1,750 Vietnamese lines into a short English shape loses nuance | Translate from the meaning checklist, not line by line; keep decision numbers and problem IDs; frozen detail plans stay untranslated |
| The move breaks open branches or session prompts that cite `docs/refactors/...` | No unmerged local branch touches it (fact); Git rename detection; redirect files only for migration-cited paths; other stale paths fail the link check where they live |
| The new CI step makes `main` red | G4: wired last, after a clean-checkout pass |
| Banners on closed agent programs touch files cited by eval suites | Banner-only edits; `validate --all` rerun |

- Rollout runbook: none (no hosted or database state).
- Stop when: a decision or evidence fact cannot be kept; a move would break a migration-cited path; `main` changes files under `docs/refactors/` during the work.
- Rollback: before merge, fix forward. After merge, prefer a correction PR. Reverting only the CI step is safe on its own. A full revert must leave each moved program's State at its current truth.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
