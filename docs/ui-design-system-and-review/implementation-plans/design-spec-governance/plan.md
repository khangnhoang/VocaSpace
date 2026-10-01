# Plan: Lightweight Design-Spec Governance

## Status

| Field | Value |
| --- | --- |
| Status | Owner-accepted on 2026-10-02 with D1–D4 as recommended and two Owner corrections: approval is the Owner's decision, not the merge event; interaction-semantics, cross-surface, accessibility, and destructive-confirmation changes are not small adjustments |
| Branch | `docs/design-spec-lightweight-governance` from `main` at `7f4de89` |
| Amends | [Master Plan](../../plan.md) "Design artifact lifecycle" |
| Next action | Owner accepts or corrects the Structure brief, and decides whether and how to open a PR |
| Current authority | Owner-granted on 2026-10-02: implement both checkpoints on this branch, commit locally, review the whole branch, reconcile stale `progress.md` lines, and push. No PR, merge, or skill change |

## Problem

The Owner's intent is that the agent writes a design to the Owner's standard (the `frontend-design` screen-type references), then designs and builds within it. In practice, every surface change has become a ceremony. The 2026-10-01 Structure §6.1 fix took a one-line spec edit, a new pre-publication SHA-256, a Status row amendment, a new `index.md` entry and a `progress.md` entry. All of that was for a back link that restored the obvious behavior.

Goal: a redesign or a new surface still gets a reviewed design. A small adjustment ships with only its PR.

## Repository facts

- No skill requires a pre-publication SHA-256. It is a convention that grew in the UI-2 and UI-4 plans. `frontend-ui-review` input 2 already accepts "its revision or recorded hash", so a commit revision is enough.
- The Master Plan lifecycle step 5 already says a bug fix that restores the accepted contract needs no spec edit, and that Git keeps history. The ritual goes beyond the written rule.
- `common-design-authoring.md` covers only product language and screen-type designs, and explicitly excludes surface-specific design. No written rule governs surface specs, so they inherited the common-design rigor.
- Accepted sources and sizes: Product Language 375 lines, Learning Experience 348, Teacher Authoring 453, Button 117, Structure surface 246.
- The `index.md` Structure entry is one paragraph carrying four hashes and three amendments. The Structure Status row repeats the same history.
- The Structure spec mixes design intent (§1–§5, §8) with behavior contracts (§6 URL and recovery matrix, §7 keyboard and focus, §11 acceptance checklist). Much of that behavior is already exercised by `__tests__/components/course-structure-workspace.test.tsx` and `e2e/smoke/course-structure.smoke.spec.ts`; the exact coverage map is not yet established.

## Proposed rules (binding once accepted)

**Tiers.**

1. `frontend-design` and its screen-type references: the Owner's standard. Unchanged.
2. Product Language, Learning Experience, Teacher Authoring, and shared-component contracts such as Button: the common design. Keeps explicit Owner acceptance.
3. Surface specs become **design briefs** of about 60–100 lines. A brief covers:
   - the job and reading path;
   - wide and narrow composition;
   - primary actions and Button roles;
   - the local signature and non-goals.

   It references upstream sources by name and does not restate values or test-level behavior.

**Approval levels.**

| Change | What is needed | Record |
| --- | --- | --- |
| New surface or redesign | A brief, then the Owner reviews the running result | One `index.md` line: link, `Accepted` date, commit SHA |
| Change to a tier-2 source | A candidate per `common-design-authoring`, with explicit Owner acceptance | Same one line, updated |
| Change to material interaction semantics, cross-surface behavior, an accessibility contract, or the destructive-confirmation model | An explicit Owner decision before implementation; no new brief. Update the brief in the same PR when it states the changed rule | The PR records the decision. No index, Status, or progress entry |
| Small adjustment: bug fix, copy, a focused visual or responsive repair within the brief's intent that none of the rows above covers | No spec change; if the brief's wording becomes wrong, fix it in the same PR | Owner approval may be given through approval or authorization of the PR; no separate design-freeze ceremony. The merged PR is the durable record. Merging alone does not create approval |

Examples of the second row that are not small: changing where focus goes after a delete, turning a local action into a shared interaction convention, or replacing a delete confirmation with undo.

**Stop.**

- New pre-publication hashes, amendment IDs (`*-CANDIDATE-N`, `*-CORRECTION-N`), and per-amendment history inside a spec or `index.md`. Git history and the PR own that history.
- `progress.md` entries for small adjustments.

**Unchanged.** Every agent still discovers and reuses accepted sources, and still stops before inventing a material visual or shared-interaction decision. `frontend-ui-review` still runs for redesigns and new surfaces.

## Owner decisions (accepted 2026-10-02 as recommended)

| ID | Question | Decision |
| --- | --- | --- |
| D1 | Tier-2 records: keep pre-publication SHA-256 or switch to commit SHA? | Commit SHA for all tiers. A file cannot contain its own hash; that is what made "pre-publication" necessary and confusing. |
| D2 | Existing hashes and amendment history in `index.md` and Status rows: remove now, or only stop adding? | Remove from `index.md` and the Structure Status row; Git keeps them. Leave tier-2 bodies untouched unless D1 changes their Status rows. |
| D3 | Where do the rules live: Master Plan lifecycle plus a short `index.md` header (docs only), or also a `frontend-design` skill change? | Docs only. `frontend-design` already routes agents to `index.md`; a skill change triggers `maintain-repo-skills` evaluation work with no concrete failure to prevent. Revisit if an agent ignores the index rule. |
| D4 | Structure behavior removed from the brief (§6.2 recovery matrix, §7 keyboard and focus, §11 checklist): require a test for every item, or only for items without existing coverage that the Owner wants kept? | Coverage map in the PR. Items with no test become either one new focused test or an explicit drop the Owner sees in the PR. |

## Scope and exclusions

**In scope:**

- the Master Plan lifecycle section;
- `index.md`;
- the Structure surface spec, rewritten as the first brief;
- tests only where D4 requires them.

This work belongs to no tracked program, so it adds no `progress.md` entry; this plan's State is its only progress record.

**Excluded:**

- the content of Product Language, Learning Experience, Teacher Authoring, and Button;
- the `frontend-design`, `frontend-ui-review`, and other skills, unless D3 changes;
- historical implementation plans (UI-1 to UI-5, ui-4-reorder);
- `candidates/` and `future-features.md`;
- runtime UI.

## Delivery

Two checkpoints on this branch, rules first, because the Structure rewrite must follow the accepted rules. Each checkpoint is one local commit; the Owner decides any PR split.

**Checkpoint A — governance rules (docs only).**

- Replace Master Plan lifecycle steps 3–5 with the tiers and approval levels above.
- Add a header of 5 lines or fewer to `index.md` restating the levels.
- Shrink every `index.md` entry to one line, as D1 and D2 decide.

Acceptance:

- A reader of `index.md` alone can tell whether a given change needs Owner review.
- No entry carries amendment history.
- The Master Plan and `index.md` do not contradict each other or `frontend-design`'s design-sources paragraph.

**Checkpoint B — Structure brief pilot (depends on A).**

- Rewrite `surfaces/teacher/course-structure.md` as a brief of about 100 lines or fewer.
- Record a coverage map for every removed behavior rule in this plan's State: the existing test, a new test, or dropped.
- Add only the tests D4 requires.

Acceptance:

- The brief keeps §1–§5 and §8 intent, with no lost design decision.
- Every removed behavior line maps to a test or an explicit Owner-visible drop.
- Targeted Vitest and the Structure smoke pass.
- The Owner accepts the brief as the template for later surfaces.

## Verification

- Checkpoint A:
  - check links and paths;
  - `git diff --check`;
  - grep that no accepted-source entry still cites a pre-publication hash (unless D1 keeps them);
  - read `frontend-design` §"Design sources" to confirm no conflict.
- Checkpoint B:
  - `npx vitest run __tests__/components/course-structure-workspace.test.tsx __tests__/components/course-workspace-routes.test.tsx`;
  - `npm run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` when tests change.
- No browser UI review: the runtime does not change.

## Risks

| Risk | Treatment |
| --- | --- |
| "Small adjustment" stretches to cover a real redesign | The levels table names what is not small: composition, action roles, reading path, interaction semantics, cross-surface behavior, accessibility contract, destructive confirmation. Code review checks the classification. |
| Thinning Structure loses behavior that only the spec held | The D4 coverage map. Nothing is removed without a test or a visible drop. |
| Old plans and progress still describe the hash ritual | They are historical records and stay as they are. The Master Plan lifecycle is the current rule. |

## State

- 2026-10-02: plan accepted by the Owner.
- Checkpoint A done: Master Plan lifecycle steps 3–5 replaced; `index.md` has an approval header and one line per source citing the commit that carries the accepted content. Tier-2 source bodies keep their historical Status rows (out of scope). Consumers checked: `frontend-ui-review` input 2 and its eval cases still read correctly.
- Checkpoint B done, pending Owner acceptance of the brief: the Structure spec went from 246 to 83 lines. Three focused tests were added for rules that had no test. Coverage map for behavior removed from the brief (`ws` = `__tests__/components/course-structure-workspace.test.tsx`, `smoke` = `e2e/smoke/course-structure.smoke.spec.ts`):

| Removed rule | Coverage |
| --- | --- |
| Search threshold, title/number match, result announcement, no-match and clear | `ws` "offers chapter search only from the threshold…" |
| Row numbering, `aria-current`, unknown topic count omitted, topic count before lifecycle counts | `ws` "numbers chapters by position…", "counts the chapter's topics…" |
| Chapter moves on rows, edge reasons, hidden while filtering, retryable error and focus | `ws` "moves any chapter from its row…", "hides chapter moves while filtering…", "returns focus to the moved chapter's control…"; `smoke` |
| Inline rename keys, blur cancel, failure keeps value, focus return | `ws` "renames a topic with Enter…", "keeps the input and typed value…", "renames the chapter in place…"; `smoke` |
| Phone topic rename dialog | `ws` "renames through the shared dialog…", "cancels the rename dialog…" |
| Shared title dialog, create failure, focus on cancel | `ws` "opens the shared create-chapter dialog…", "returns focus to the add-topic control…", "keeps the create dialog open…" |
| Capability gates, read-only, pending-topic lock with reason | `ws` "gates rename, reorder and delete…", "hides authoring controls…", "keeps an outside-group topic…", "locks rename and delete of a pending topic…" |
| Preview menu explanation and quota block with `Xem phân bổ` | `ws` "explains what preview marking does…", "offers the allocation view…" |
| Move pending, confirmed re-read, announcement, focus at edges, failure and retry | `ws` move and drop tests (645–1061); `smoke` |
| Drop placement, stale-order notice, cancelled drag, retry without pre-placement, handle only when reorderable | `ws` "topic drop" and drag tests |
| URL selection, stale fallback with notice, next chapter after delete | `ws` "opens the chapter named in the URL", "falls back to the first chapter…", "selects the next chapter after a delete…"; `smoke` |
| Narrow back returns focus; wide selection announced | `ws` "returns to the chapter list…", "announces the selected chapter…" |
| Chapters failed to load | `ws` "shows a retryable error instead of an empty course…" |
| Totals fail without blocking | New: `ws` "keeps chapters usable and offers a retry when course totals fail" |
| Empty-course well, no duplicate `Thêm chương` | New: `ws` "shows one empty-course well…" |
| Restored chapter becomes selected | New: `ws` "selects a restored chapter" |
| Issue notices clear after first create; Back does not replay | `e2e/smoke/issue-deep-links.smoke.spec.ts`, `e2e/smoke/topic-create-navigation.smoke.spec.ts` |
| Topic Builder back link restores the chapter | `__tests__/components/course-workspace-routes.test.tsx`; `e2e/smoke/topic-create-navigation.smoke.spec.ts` |
| Loading skeleton copy, focus to the workbench heading after create/delete, menu and dialog keyboard behavior | Dropped from the brief without a new test. Skeleton copy is wording. Menu and dialog keyboard behavior belongs to the shared primitives. Heading focus after create/delete is runtime-implemented (`focusHeadingOnDialogCloseRef`) but untested; flagged to the Owner |
| Exact motion durations and settle tint | Kept in the brief §5 (design intent) |
| UI-4 CP3 acceptance checklist | Dropped: a pilot-time checklist, not a standing contract |
