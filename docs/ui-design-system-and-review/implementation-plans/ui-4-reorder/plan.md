# UI-4 Follow-up Plan: Topic Drag-and-Drop and Pending-Topic Reorder

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — the Owner accepted this plan and R1–R4 on 2026-10-01. R2 was amended to the current `@dnd-kit/react` + `@dnd-kit/helpers` packages. No implementation has started |
| Origin | Owner decision 2026-10-01, recorded in [progress.md](../../progress.md) (UI-4 CP3 round 1): a separate branch after UI-4 adds (1) drag-and-drop reordering and (2) a policy that lets pending topics be reordered; every other pending-topic policy stays unchanged |
| Upstream authority | [Structure surface spec](../../surfaces/teacher/course-structure.md) (`Accepted`, SHA-256 `F35177E6…2425`), [Teacher Authoring](../../screen-types/teacher-authoring.md) (TA), [D1 canonical contract](../../../refactors/student-user-flow-route/implementation-plans/d1/plan.md) §4.4 Pending freeze |
| Planning baseline | `main` and `origin/main` at `9c379b7c666e57e32ea020c9154d88f3248c319b` (PR #110 merge, UI-4) |
| Branch | `feat/structure-topic-dnd-reorder` |
| Execution mode | `NORMAL`: one surface and one ordering contract; the DB change reuses the established RPC and trusted-flag pattern |
| Preliminary / final size | `Large`: amends a D1 security/lifecycle rule (pending freeze), adds a migration and a permission-sensitive RPC, amends an `Accepted` surface spec, may add a package, and needs data-dependent browser QA with drag gestures |
| Current authority | Branch created and plan accepted (2026-10-01). The Owner said "chưa implement", so implementation has not started. Implementation, package install, commit, push, PR, and merge each still need a separate explicit Owner instruction. The R2 package choice is approved; installing them is part of implementation |

## Binding Spec

### Outcome and acceptance

The work is complete only when all of the following hold:

1. **A1 — Pending topics can be reordered.** An actor with `canManageStructure` can move a `pending` topic, and can move any topic past a `pending` one, using the up/down controls and drag-and-drop. The topic stays `pending`, its submission stays open, and approve/reject keep working afterwards.
2. **A2 — Every other pending freeze is unchanged.** On a `pending` topic, rename, content, status, preview-marker, delete (other than the existing cancel-then-delete path), and chapter hide still fail with `TOPIC_PENDING_FROZEN`, exactly as today.
3. **A3 — Order changes only through trusted RPCs.** The reorder exception allows a change to `order_index` (and `updated_at`) only. It is reachable only from the move RPCs, after their existing authorization. Any other column change on a pending topic still raises `TOPIC_PENDING_FROZEN`, even when the reorder exception is active.
4. **A4 — Drag-and-drop moves a topic to any position.** Within the selected chapter's topic list, a Teacher with `canManageStructure` can drag a topic to any position in one action, with mouse and touch. The server persists exactly the dropped order, and the unique active-order invariant holds.
5. **A5 — Stale drops fail safely.** If the anchor topic was removed or moved to another chapter, or the order has changed underneath, the move is rejected. The list returns to confirmed server order with a retry-safe message, and no partial order is persisted.
6. **A6 — Dragging is never required.** The up/down controls remain the keyboard and single-pointer path (TA §12, TA line 238 "do not require drag gestures", WCAG 2.5.7). Controls disabled only because of a pending neighbour or a pending topic are enabled. `Bài học kế bên đang chờ duyệt` and the pending-topic move reason disappear.
7. **A7 — Accessible feedback.** A confirmed move announces the new position through the surface's single polite live region, and focus lands on a meaningful control of the moved topic. A failed move shows the existing top-of-list error with `Thử lại`. Reduced motion removes drag translation animation except the pointer-following overlay itself.
8. **A8 — Permissions unchanged.** Read-only viewers, `previewer` actors, and actors without `canManageStructure` see no drag handle and cannot reorder. The RPCs reject them (`COURSE_EDIT_FORBIDDEN`) as `move_topic_order` does today.
9. **A9 — Contracts are updated and routed.**
   - The Structure surface spec is revised: remove drag-and-drop and the new package from its non-goals, replace the swap-only limitation text, and update pending-move/motion rules per R4.
   - The Owner re-freezes the revised spec after live review, with a new hash in `index.md`.
   - D1 §4.4 records the reorder exception.
10. **A10 — Evidence.**
    - Integration, action, and component tests pass.
    - Existing pending-freeze integration tests still pass unchanged.
    - Browser evidence covers drag with mouse and touch at 1440 and 375px, keyboard-only reorder, and a pending-topic scenario.
    - Anything not observed is reported as pending.

### Scope

- A new migration that:
  - relaxes the pending check in `move_topic_order`;
  - adds a column-limited trusted-order exception to `d1_guard_topic_lifecycle_mutation`;
  - adds one move-to-position RPC.
- A Server Action and Zod schema for the new RPC, plus error mapping for its new error codes.
- Topic-list drag-and-drop inside `ChapterWorkbench` and its move handling in `CourseStructureWorkspace`.
- Removal of the pending-based disabled move states.
- A revision of the Structure surface spec, an amendment to D1 §4.4, and updates to `progress.md` and `index.md`.
- Updates to affected tests and smoke E2E.

### Non-goals

- Chapter drag-and-drop, unless R1 selects it.
- Moving a topic to another chapter.
- Any other pending-topic policy.
- Changes to review, approval, lifecycle, or preview-quota rules.
- RLS or grant changes; `authenticated` keeps no direct `UPDATE` on `topics`.
- Changes to `components/ui/*` shared primitives.
- Changes to Topic Builder, Overview, or portfolio.
- The Topic Builder back link.
- UI-5.
- `supabase/seed.sql`, remote DB, and production.

### Necessary execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| The pending exception is limited to `order_index` and `updated_at`, and it is enabled only inside the move RPCs after authorization and chapter/course validity checks. It uses a transaction-local setting, not a session setting | A generic bypass would let a security-definer path change pending content or status. That breaks A2/A3 and the D1 review guarantee |
| New RPC reuses `move_topic_order`'s lock order (chapter row `FOR UPDATE` → course advisory lock → topic rows) and authority predicate `d1_is_active_course_author` | Deadlocks with approve/reject and the guard trigger, or a widened or narrowed reorder authority (D1 D37) |
| The server validates the drop against current server state and rejects stale input instead of guessing | Silent wrong order under concurrent edits (A5) |
| Order never diverges from confirmed server order after a failure: any optimistic placement is rolled back on error | The shown order differs from persisted order |
| Up/down controls remain available and legal wherever drag is available | Keyboard, switch, and touch-without-drag users lose reordering (TA, WCAG 2.5.7) |
| Existing migrations are not edited; the change is a new migration applied locally only | Published history drift; remote mutation without approval |
| The spec revision and the D1 amendment go through the Owner gate before the spec status returns to `Accepted` | An `Accepted` contract changes without its owner |

### Owner decisions (accepted 2026-10-01)

| ID | Decision |
| --- | --- |
| R1 | **Drag-and-drop covers topics in the selected chapter only.** For chapters, a drag conflicts with the search filter (moves are hidden while filtering) and with URL selection. Chapter drag-and-drop stays a possible later follow-up |
| R2 | **Library: `@dnd-kit/react` + `@dnd-kit/helpers`.** These are the current dnd-kit packages. Owner correction: the originally recommended `@dnd-kit/core`/`sortable`/`utilities` are legacy.<br>Verified with `npm view` on 2026-10-01:<br>• `@dnd-kit/react` `0.5.0` (modified 2026-09-12), peer `react`/`react-dom` `^18 \|\| ^19`; the repo has `19.2.3`;<br>• `@dnd-kit/helpers` `0.5.0`;<br>• legacy `@dnd-kit/core` `6.3.1`, last modified 2024-12-05.<br>Native HTML5 drag-and-drop was rejected (weak touch, no keyboard model) |
| R3 | **A pending topic can move, and other topics can move past it.** Order is structure, not reviewed content: `approve_topic_review` does not read `order_index` or `updated_at` |
| R4 | **After a drop, the row stays at the drop position with a pending state and rolls back on failure.** This changes spec §6.2 ("moved row keeps its position until the server confirms") for drag only; button moves keep the current rule |

## Repository facts and conflicts

- **`move_topic_order` swap behaviour.** Latest version: `supabase/migrations/20260919100000_d1_topic_authority_split.sql:88`.
  - It swaps with the adjacent active topic.
  - It raises `TOPIC_PENDING_FROZEN` when either the target or the neighbour is `pending`.
  - Authorization is `d1_is_active_course_author` (D37).
  - Lock order: chapter `FOR UPDATE`, then `pg_advisory_xact_lock(hashtext(course_id))`, then topic rows `FOR UPDATE`.
  - It uses a temporary `max + 1` order to satisfy `topics_chapter_id_order_index_active_unique_idx`.
- **The pending freeze is also enforced by trigger.** Latest version: `d1_guard_topic_lifecycle_mutation` in `20260915110000_d1_content_mutation_safety.sql:49`.
  - It fires `before update or delete` on `topics`.
  - It raises `TOPIC_PENDING_FROZEN` for any update of a pending row unless `voca.d1_trusted_topic_lifecycle = 'on'`.
  - It is bypassed for `auth.uid() is null` or `service_role`.
  - Removing only the RPC check is therefore not enough, and reusing `voca.d1_trusted_topic_lifecycle` would open every column.
- **`authenticated` cannot update `topics` directly.** `revoke update on table public.topics from public, anon, authenticated` (`20260924110000_d2_preview_quota_lifecycle.sql:24`). Order changes only happen inside security-definer RPCs.
- **Approval does not depend on order.** `approve_topic_review` (`20260915130000_d1_correction_security_rescue.sql:151`) re-checks status, readiness, and permission, but not `order_index` or `updated_at`.
- **Preview quota triggers do not fire on order changes.** They fire only on `is_preview, removed_at, chapter_id, course_id` (`20260924110000…:449`).
- **Conflict — D1 contract.** D1 plan §4.4 says "Pending freeze mọi normal content/structure mutation". The Owner decision of 2026-10-01 amends this for topic order only, so the amendment must be written into D1 §4.4 (A9).
- **Conflict — Structure spec.**
  - §10 lists "No drag-and-drop … or new package" as a non-goal.
  - §8 says "No movement animates a row across positions".
  - §3.3 line 120 documents the swap-only limitation.
  - All three change, which needs a spec revision and an Owner re-freeze (A9).
- **Current UI and tests.**
  - `ChapterWorkbench.tsx` disables moves with `PENDING_TOPIC_REASON` and `PENDING_NEIGHBOR_REASON` (lines ~98–103, ~698–712). The guards `topic.status === "pending"` sit in `handleMoveTopic` (~244).
  - The component test at `__tests__/components/course-structure-workspace.test.tsx:336` asserts the neighbour-disabled behaviour.
- **Fixture.** No drag-and-drop package is installed today. The D3 large-course fixture (`scripts/e2e/structure-large-course-fixture.mjs`) has a busy chapter with statuses `published, draft, pending, published, draft, pending, draft, published`.
- **Existing tests.** `__tests__/integration/course-structure-ordering-rpc.test.ts` covers move success, no-op, removed topics, and authorization. It has no pending-move case yet. Pending-freeze regressions live in:
  - `topic-group-content-boundary.test.ts`;
  - `topic-review-lifecycle.test.ts`;
  - `course-preview-quota.test.ts`.

## Bounded implementation hypotheses

The implementation may replace any of these if the Spec and guardrails still hold.

- **Migration file.** `supabase/migrations/<timestamp>_structure_topic_pending_reorder.sql`.
- **New setting `voca.d1_trusted_topic_order`.**
  - The move RPCs set it with `set_config(..., true)`.
  - The guard allows a pending update when the setting is `'on'` and `to_jsonb(new) - 'order_index' - 'updated_at' = to_jsonb(old) - 'order_index' - 'updated_at'`.
  - Every other branch of the guard stays byte-equivalent.
- **`move_topic_order`.** Recreated without the two pending checks, and it sets the setting before its updates. Signature, return shape, and grants are unchanged.
- **New RPC `move_topic_to_position(p_topic_id uuid, p_before_topic_id uuid)`.** It places the topic immediately before the anchor; `null` means last in the chapter.
  - **Errors:** it raises `TOPIC_ORDER_STALE` when the anchor is not an active topic in the same chapter.
  - **No-op:** it returns `noop` when the topic is already in place.
  - **Reordering:** it shifts only the affected range, using the temporary-offset technique to keep the unique index valid.
  - **Result:** `{status, course_id, chapter_id, topic_id, previous_order_index, new_order_index}`.
  - **Grants:** same as `move_topic_order`.
  - **Alternative:** an index-based contract with an expected-order check is acceptable if it gives the same stale safety.
- **Server Action.** `moveTopicToPosition` in `app/actions/topic.ts` with a `topicMoveToPositionSchema` in `lib/schemas/topic.ts`. `mapTopicOrderingRpcError` gains `TOPIC_ORDER_STALE` ("Thứ tự bài học vừa thay đổi. Danh sách đã được tải lại.").
- **UI.**
  - A `DragDropProvider` (`@dnd-kit/react`) wraps the topic `<ul>` in `ChapterWorkbench`.
  - Each row uses `useSortable` from `@dnd-kit/react/sortable`.
  - Optimistic order uses `move` from `@dnd-kit/helpers`; the confirmed server order is restored on failure.
  - A visible drag handle (44×44 on touch) sits in the order column, only when `canMove`.
  - The keyboard sensor is disabled; the up/down buttons remain the keyboard path, to avoid two keyboard models.
  - Exact package entry points and APIs are verified against the installed `0.5.x` docs at CP2.
  - `CourseStructureWorkspace` gains `handleDropTopic`, which reuses `OrderingPendingState` and `moveError`/retry.

## Dependency graph

```txt
R1–R4 Owner decisions (hard)
→ CP1 migration + guard exception + RPCs + D1 §4.4 amendment (hard: UI needs the server contract)
→ CP1 Server Action + schema + action tests
→ CP2 UI (buttons un-gated, drag-and-drop) + spec revision candidate + component tests + smoke update (hard: needs CP1 locally applied)
→ CP3 browser QA + Owner live review → spec re-freeze + index/progress (hard: re-freeze needs a running candidate)
```

The two CP1 halves can be one prompt. CP2 cannot start before the CP1 migration is applied to the local and E2E databases.

## Checkpoints

### CP1 — Domain policy and position RPC

- **Steps:**
  - write the migration;
  - `npx supabase db reset` locally;
  - add integration cases;
  - add the action and schema with action tests;
  - amend D1 §4.4 with the exception and the Owner decision date.
- **Integration cases:**
  - a pending topic moves up and down and stays `pending`, with its submission still open;
  - a topic moves past a pending neighbour;
  - approving after a move still publishes the topic;
  - the position RPC handles first, middle, and last positions, a no-op, a stale anchor, an anchor in another chapter, a removed topic, and a removed chapter;
  - the position RPC rejects student, previewer, and non-member callers;
  - the unique invariant holds after every case.
- **Acceptance:**
  - A1–A3, A5 and A8 hold at the RPC layer;
  - existing pending-freeze integration tests pass unchanged.
- **Review:**
  - a self-review of the RPC boundaries per `supabase-safe-migration` (SECURITY DEFINER need, `search_path`, return shape, invalid state, unauthorized caller, retry);
  - a review of the trigger effect and of unaffected rows.

### CP2 — Runnable UI candidate

- **Steps:**
  - install `@dnd-kit/react` and `@dnd-kit/helpers` at an exact `0.5.x` version (no `^` range, because the API is pre-1.0);
  - remove the pending-based move gating;
  - add the drag handle and drop handling;
  - write the spec revision candidate `STRUCTURE-SURFACE-CANDIDATE-2` (status `Candidate`, not `Accepted`);
  - update the component tests (replace the neighbour-disabled test with pending-movable cases, plus drop success, failure, rollback, and stale cases);
  - update `e2e/smoke/course-structure` if its move assertions change.
- **Acceptance:** A4, A6, A7, and A8 in component tests and on a local run.

### CP3 — Browser QA, Owner live review, re-freeze

- **Browser QA with `playwright-cli`** on the local stack and the D3 fixture:
  - mouse drag at 1440px and touch drag at 375px;
  - keyboard-only reorder through the buttons;
  - a pending topic dragged, and a draft topic dragged across a pending topic;
  - a read-only viewer sees no handle;
  - a failed drop rolls back;
  - reduced motion;
  - no horizontal overflow at 320px.
- **Owner live review:** iterate within R1–R4. A change beyond them stops for an Owner decision.
- **Re-freeze:**
  - set the spec to `Accepted`, then record its new pre-publication hash in the spec and in `index.md`;
  - record the evidence in `progress.md`.

## Verification

| Layer | Command / method | Covers |
| --- | --- | --- |
| DB | `npx supabase db reset`; `npm run test:integration` (ordering, topic-review-lifecycle, topic-group-content-boundary, course-preview-quota, topic-authorship-boundary) | A1–A3, A5, A8, regression of the pending freeze |
| Action | `npx vitest run __tests__/actions/course-structure.test.ts` | Schema validation, error mapping, revalidation |
| Component | `npx vitest run __tests__/components/course-structure-workspace.test.tsx` and the full `npx vitest run __tests__` | A4 (drop handler), A6–A8 |
| Static | `npx tsc --noEmit`, ESLint on the feature folder, `git diff --check` | — |
| E2E | `npm run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` and `e2e/smoke/topic-create-navigation` (E2E DB must have the new migration) | Route regression |
| Browser | `playwright-cli` matrix in CP3 | A4, A6, A7 with real pointer and touch input |

Some things cannot be proven by the agent:

- Real mobile-device touch feel. Emulated touch in the browser counts as evidence, but a real device check stays pending unless the Owner performs it.
- True concurrent two-user drops. Stale safety is proven with sequential RPC calls that simulate a concurrent change.

### QA fixture readiness

- **QA type:** data-dependent browser QA with pending topics.
- **Canonical fixture source:** `scripts/e2e/structure-large-course-fixture.mjs` (D3).
- **Existing covered states:** a pending topic with non-pending neighbours on both sides; draft/published topics separated by a pending one; a previewer account for read-only; a removed chapter.
- **Missing states:** none required.
- **Outcome:** existing canonical fixture is sufficient.
- **Reset/setup:** the D3 prepare script, as used in UI-4 CP3. Re-prepare after QA, because the drags change the order.
- **Browser QA may begin when:** CP2 component tests pass and the migration is applied to the E2E DB.

## Risks, stop, and rollback

| Risk | Impact | Mitigation | Exposed at |
| --- | --- | --- | --- |
| The guard exception is broader than order | Pending content could change and bypass review | JSONB column-diff check; setting enabled only in move RPCs; existing freeze tests plus a new case where an order move leaves every other column byte-equal | CP1 |
| Lock-order mismatch in the new RPC | Deadlock with approve/reject | Copy `move_topic_order` order exactly; review against `d1_lock_topic_lifecycle` order notes | CP1 |
| Unique-index collisions during a range shift | Migration or RPC failure | Temporary offset above `max(order_index)`, then settle; test first-to-last and last-to-first moves | CP1 |
| DnD in jsdom is hard to drive | Weak component evidence | Test the drop handler and rollback state directly; prove the gesture in browser QA | CP2/CP3 |
| New package size / SSR | Bundle growth, hydration issues | Import only in the client workbench; check `next build` in CI | CP2 |
| `@dnd-kit/react` is pre-1.0 (`0.5.0`) | A future minor version can break the API | Pin the exact version; keep dnd-kit usage inside `ChapterWorkbench`; up/down buttons keep reordering working even if drag breaks | CP2 |
| Spec change grows beyond R1–R4 | Unaccepted design drift | Stop for an Owner decision | CP3 |

- **Stop conditions:**
  - the installed `@dnd-kit/react` cannot meet A4/A6/A7 (for example touch drag or disabling the keyboard sensor) without other packages;
  - any need to change RLS, grants, review, or another pending policy;
  - evidence that order is part of the reviewed content;
  - a failing pending-freeze regression test.
- **Rollback:**
  - reverting the branch restores the UI;
  - the migration is additive for the RPC; for the trigger and `move_topic_order`, a follow-up migration can restore the previous definitions (bodies are in `20260915110000` and `20260919100000`);
  - nothing is applied remotely before merge and the production gate.

## State

```txt
Current Spec revision: Accepted revision 2 (2026-10-01; R2 amended to @dnd-kit/react + @dnd-kit/helpers)
Current Checkpoint: CP2 complete (local commit); CP3 not started
Status: In implementation
Completed evidence (CP1, 2026-10-01):
  - migration 20261001100000_structure_topic_pending_reorder.sql applied with `npx supabase db reset` (root local DB only);
  - new __tests__/integration/topic-pending-reorder.test.ts: 10 passed; full `npm run test:integration`: 20 files / 224 tests passed, existing pending-freeze tests unchanged;
  - action + schema tests: __tests__/actions/course-structure.test.ts and __tests__/schemas/course-structure.test.ts passed;
  - `npx tsc --noEmit` clean; ESLint clean on changed files;
  - A3 negative branch (order flag on, another column changed) verified by direct SQL in a rolled-back transaction: title change, status change and delete still raise TOPIC_PENDING_FROZEN; the order-only update passes. Not part of an automated test (PostgREST cannot reach it).
  - D1 plan §4.4 amended with the order exception.
Accepted bounded deviations: none. Hypothesis followed as written (anchor-based move_topic_to_position; flag voca.d1_trusted_topic_order reset to 'off' after the updates).
Completed evidence (CP2, 2026-10-01):
  - packages installed at exact versions: @dnd-kit/react 0.5.0 and @dnd-kit/helpers 0.5.0 (package.json, no ^); no other package added;
  - ChapterWorkbench: pending gating removed from the move buttons; drag handle + DragDropProvider; optimistic drop with rollback to the confirmed snapshot and a server reload on failure; retry of a drop is non-optimistic;
  - CourseStructureWorkspace: handleDropTopic calls moveTopicToPosition; types.ts: TopicDropRequest and a discriminated OrderingPendingState;
  - spec revision candidate written as STRUCTURE-SURFACE-CANDIDATE-2 (status Candidate; not frozen, no hash, index.md unchanged);
  - `npx vitest run __tests__/components/course-structure-workspace.test.tsx`: 39 passed; full `npx vitest run __tests__`: 71 files / 634 tests passed (Supabase integration tests are excluded from this command; they ran in CP1 and the migration is unchanged);
  - `npx tsc --noEmit` clean; ESLint clean on the feature folder, the component test, app/actions/topic.ts and lib/schemas/topic.ts;
  - `npm run test:e2e` for course-structure.smoke and topic-create-navigation.smoke: 2 passed (the isolated E2E DB was reset, so migration 20261001100000 is applied there); the smoke specs needed no change because they only use the Lên/Xuống buttons.
Accepted bounded deviations (CP2):
  - the default `Accessibility` plugin is removed, which needs `import { Accessibility, Feedback } from "@dnd-kit/dom"`. @dnd-kit/dom is a transitive dependency of @dnd-kit/react (not declared in package.json). Reason: the plugin adds English keyboard instructions, a second live region, and forces role/tabindex, all against spec §7 (one polite live region) and A6 (keyboard = buttons). Fallback if the Owner objects: declare @dnd-kit/dom at 0.5.0, or keep the plugin and translate its strings;
  - package-lock.json also carries unrelated npm 11.6.2 churn (two @emnapi entries under @rolldown/binding-wasm32-wasi removed, some "peer": true flags removed) next to the dnd-kit entries;
  - the component test mocks DragDropProvider and `move` (jsdom has no layout), so real pointer/touch gestures are NOT yet observed; they belong to CP3.
Open blockers or Owner decisions: none
Next action: CP3 browser QA with playwright-cli on the D3 fixture, then Owner live review; the spec stays Candidate until the Owner accepts
Current authority: local commits per checkpoint; migration applied to the local DB and local E2E DB only; no push, PR, merge, remote DB change, seed.sql change, or chapter drag-and-drop
```
