# TFEAT4 detail plan — Topic Builder redesign

Revision: r3, 2026-10-28 (r1 Codex findings applied: ACTION-QUEUE-001 test replacement, QA fixture readiness, lifecycle action with a dirty editor; r2 finding applied: production E2E build against the isolated runtime). Codex CLI `gpt-6.1-sol` / `high` plan review PASS at round 3. Owner approved r3 on 2026-10-28; no implementation, commit or push granted yet. Source: [TFEAT-004](../../../teacher-workflow/future-features.md). Master plan: [plan.md](../../plan.md), Decision 46. Branch: `feat/topic-builder-redesign` from `origin/main` `ae2145d`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `/teacher/courses/[id]/topics/[topicId]` becomes a modern two-pane authoring workbench. Teachers browse content on the left and edit it inline on the right with a live learner preview, instead of stacked cards and nested dialogs. Memory check gets its own tab. Bulk add (flashcard paste and Aiken exercise import) is gone. Server behavior, permissions, lifecycle and readiness are unchanged.

| ID | Observable result |
| --- | --- |
| AC1 | A teacher opening the route sees one header with the topic title, lifecycle status (`Bản nháp` / `Đang chờ duyệt` / `Đã xuất bản`), responsible author, the legal lifecycle action (`Gửi duyệt`, review, withdraw) and a back link to the containing chapter in Structure, then four tabs in this order: `Từ vựng`, `Memory check`, `Bài tập`, `Cài đặt`. Tabs use the accepted icon + label + bottom-indicator grammar and roving keyboard focus. |
| AC2 | `?tab=memory-check` opens the Memory check tab. `?tab=flashcards`, `?tab=exercises`, `?tab=settings` and a missing or unknown tab behave as today. Dashboard issue deep links (`from=dashboard`, `issue`, `target`) still land on the same tab, show the same guidance and clear on success or dismissal. |
| AC3 | `Từ vựng` (≥ `lg`): a searchable card list (word, part of speech, meaning, missing-field marker) beside an inline editor with the same fields, required markers and validation as today. Selecting a card loads it; `+ Thêm thẻ` opens an empty editor. `Lưu`, `Lưu & thêm tiếp` (keeps the editor open and empty, focus on the word field), `Ctrl/Cmd+S` saves. A live preview shows the card front and back as the learner sees it and updates on every keystroke. |
| AC4 | `Memory check`: same workbench for memory-check questions (content, options, one correct option, explanation) with the same add/edit/delete rules as today, including today's rule that deleting the last question removes the whole memory check. A live preview shows the question as a learner sees it, without grading. |
| AC5 | `Bài tập`: the left pane is an outline of exercise → question group → question with Part labels and a marker for each readiness problem the dashboard already names. Selecting a node edits it inline: exercise title (Part stays read-only after creation), group passage/audio/image through the existing media field, or a question with its options and explanation. `+ Thêm bài tập` opens a composer in the right pane: choose a TOEIC Part (cards that state which context each Part needs), then fill context and questions; it is saved atomically through `createExercise` exactly as today. The preview renders the selected group or question with its context. |
| AC6 | Unsaved changes are never lost silently. Switching item, tab or route, closing the mobile sheet, `Esc`, or a lifecycle action (`Gửi duyệt`, withdraw, approve, reject, delete topic) with a dirty editor asks `Lưu` / `Bỏ thay đổi` / `Tiếp tục sửa` first; the lifecycle action runs only after a successful save or an explicit discard, and `Tiếp tục sửa`, a failed save or a cancelled published-impact dialog keeps the editor and does not run it. A page reload or close triggers the browser's leave prompt. A failed save keeps every typed value, shows the error inline next to the field or at the top of the editor and offers retry; no success state is shown. |
| AC7 | Published topics keep the TFEAT1 behavior: deleting content, or saving a question that removes an option or changes the correct answer, opens the same impact dialog first; other edits save directly. Pending topics and read-only roles show content and preview with editing controls absent or disabled and the reason stated once. |
| AC8 | No `Thêm hàng loạt` button, `Nhập hàng loạt` mode or Aiken help remains in the UI. `createBulkCards`, its schema and type, `bulkExerciseSchema`, `lib/utils/aiken-parser.ts` and their tests are deleted. The RPC `d1_bulk_create_cards` and `scripts/content/apply-free-toeic-vocab-course.mjs` stay unchanged. |
| AC9 | At 375 px every authoring action works: the list fills the screen, and the editor and preview open as a full-screen sheet with a back control. The `Vui lòng dùng máy tính` notice is gone. Edit and delete controls do not depend on hover. No page-level horizontal scroll at 320 px or 200% zoom. |
| AC10 | Accessibility floor holds: every field has a visible label tied to its input and error; dialogs and the sheet trap and return focus; list items are buttons or links with full names; text contrast ≥ 4.5:1; focus is visible; touch targets ≥ 44 × 44 px on primary actions; `prefers-reduced-motion` removes movement and keeps meaning. |
| AC11 | `Cài đặt` keeps topic rename, preview markers and topic delete with the current confirmations, restyled into the new shell, with the delete zone separated. |
| AC12 | ACTION-QUEUE-001 is closed by the redesign: switching tabs quickly (`Từ vựng` → `Memory check` → `Bài tập` → `Cài đặt`) on the production build never leaves a tab spinning or a save unsent, a dashboard deep link keeps its tab and guidance until success or dismissal, and after a save `Quay lại tổng quan` commits the Overview navigation. New smoke tests prove this on the production build and run on CI; `issue-deep-links` and `dashboard-return-freshness` lose their CI skip or are replaced by those tests. No Next upgrade. |

### 1.2 Scope and non-goals

- In scope: the topic builder route files under `app/(teacher)/teacher/courses/[id]/topics/[topicId]/`; feature-local new components and hooks there; `lib/course-authoring/routes.ts` (`memory-check` tab value) and any issue-context typing that consumes `TOPIC_BUILDER_TABS`; bulk-removal deletions listed in AC8 with their tests; `docs/adr/question-group-media-upload.md` Aiken lines; affected unit, component and e2e tests, the new `topic-builder-tabs` smoke and `topic-builder-matrix` fixture, and the CI skips in `issue-deep-links` and `dashboard-return-freshness`; ACTION-QUEUE-001 in `problems.md` at delivery; the plan, Decision 46, Units row and TFEAT-004 status.
- Non-goals: any server action signature, Zod action schema, RPC, migration, RLS, Storage policy or readiness rule; adding a group or question to an existing exercise, or changing a saved exercise's Part (needs new server contracts; recorded as a future feature if the Owner wants it); autosave; reordering cards or exercises; course Overview or Structure surfaces; shared `components/ui/*` primitives; new npm packages or fonts; `FlashcardPreviewSheet.tsx` and `AddFlashcardDialog.tsx` outside this route (left as they are; see §2).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Call only the existing actions (`getCardsByTopicId`, `createCard`, `updateCard`, `deleteCard`, `getMemoryCheckByTopicId`, `addMemoryCheckQuestion`, `getExercisesByTopicId`, `createExercise`, `updateExerciseBasic`, `updateQuestionGroup`, `updateQuestion`, `deleteExercise`, `deleteQuestion`, `deleteQuestionGroupMedia`, topic/review actions) with today's payloads; validate with the existing form schemas. | A UI redesign silently changes write contracts or permissions. |
| G2. Keep `readOnly = !workflow.canEdit \|\| status === "pending"` and the TFEAT1 published-impact rules as the single gates for editing and warnings. | Editing a frozen topic, or skipping a learner-impact warning. |
| G3. Keep every refresh path that updates the server DTO (`router.refresh()` after a confirmed mutation) and the dashboard issue return feedback. | Stale lifecycle, readiness or `Gửi duyệt` state after edits. |
| G4. The editor owns one dirty-state source per open item; the unsaved guard reads it. Do not keep parallel booleans for open/editing/dirty. | Lost input or a guard that fires on clean forms. |
| G5. Preview is client-only, read from the form values; it never calls learner grading or progress actions (`QuestionResponse` is not reused). | Preview writes learner answers or progress. |
| G6. Do not edit `components/ui/*`; customize at usage sites or in feature-local components. | Regressions on every other screen. |
| G7. Deleting bulk code keeps `d1_bulk_create_cards` and the seed script. | The TOEIC vocab seed script breaks. |
| G8. No Next router navigate or restore (including native `history.replaceState`, which Next turns into a restore) may be dispatched while a server action of this page is pending; tab changes either avoid touching history during a pending action or defer the URL write until it settles. | ACTION-QUEUE-001: Next 16.2.6 drops the next server action, so a tab spins forever or a save never runs. |

### 1.4 Owner decisions that bind this unit

Decision 46 (2026-10-28), answered by the Owner in this session:

1. Two-pane workbench (list + inline editor) replaces add/edit dialogs for content; confirmation dialogs stay for destructive and published-impact actions.
2. Memory check moves to its own tab between `Từ vựng` and `Bài tập`.
3. Full authoring on mobile; the editor opens as a full-screen sheet below `lg`.
4. Explicit save (`Lưu`, `Lưu & thêm tiếp`, `Ctrl/Cmd+S`) with an unsaved-changes prompt; no autosave.
5. Remove bulk add: UI and dead code; keep the RPC and seed script.
6. Add a live client-side learner preview in the editor.
7. Design latitude: for this route only, the Owner lifts the Teacher Authoring motion timings (§13) and lets the design go beyond the common screen-type details for a more modern, expressive feel. Still binding: the WCAG 2.2 AA floor and reduced-motion equivalence, Product Language semantic colors for state (success, warning, error, current), the Button contract, no new packages, no changes to shared primitives. The Owner's review of the running screen accepts the final look.
8. Codex review of this plan before approval.

## 2. Repository facts

Baseline: `ae2145d`, checked 2026-10-28.

- `TopicBuilderTabs.tsx` renders three Radix tabs (`flashcards`, `exercises`, `settings`) as bordered pill-like buttons; `MemoryCheckSection` renders inside `exercises` above `ExerciseTab` (`TopicBuilderTabs.tsx` `TabsContent value="exercises"`). — AC1, AC2, Decision 46.2.
- `TOPIC_BUILDER_TABS` in `lib/course-authoring/routes.ts:3` feeds `getTopicBuilderTab`, the issue-context Zod enum (`lib/course-authoring/issue-context.ts:140`) and every issue rule's `tab: "exercises"`. — AC2; adding a value widens the enum but no issue rule targets it.
- `FlashcardTab.tsx` shows a 4-column card grid, hover-only edit/delete (`opacity-0 group-hover:opacity-100`, hidden below `md`), and opens `AddFlashcardDialog` for add/edit and `BulkAddFlashcardDialog` for bulk. — AC3, AC8, AC9.
- `ExerciseTab.tsx` (1279 lines) keeps about 25 `useState` values for separate edit dialogs, hover-only controls, and reloads the whole list with a spinner; `AddExerciseDialog.tsx` (1100 lines) is a 95vh dialog with RHF + `useFieldArray` three levels deep and a `Nhập thủ công / Nhập hàng loạt` toggle (`:609-621`) whose bulk branch calls `parseAikenToGroups` (`:403`). — AC5, AC8.
- There is no server action to add a group or question to an existing exercise; `createExercise` (`app/actions/exercise.ts:490`) writes a whole exercise atomically through `create_exercise_with_content`. — AC5 composer shape and the non-goal.
- `updateQuestion` replaces the option set through `sync_question_with_options` and requires ≥ 2 options and one correct. — AC5, AC7.
- Bulk dependencies: `BulkAddFlashcardDialog` is used only by `FlashcardTab`; `createBulkCards` (`app/actions/card.ts:202`) only by that dialog and tests (`__tests__/actions/card.test.ts`, a mock in `__tests__/components/published-topic-authoring.test.tsx`); `bulkExerciseSchema` has no consumer; `aiken-parser.ts` is used by `AddExerciseDialog`, `__tests__/utils/aiken-parser.test.ts` and bulk cases in `__tests__/integration/exercise-authoring-rpc.test.ts`; `d1_bulk_create_cards` is also called by `scripts/content/apply-free-toeic-vocab-course.mjs:196`. — AC8, G7.
- `AddFlashcardDialog.tsx` (course-level `_components`) is also imported by `FlashcardPreviewSheet.tsx`, which no route imports. — Non-goal: both stay; the orphan is reported, not deleted here.
- `TopicWorkflow` DTO carries the topic title, `courseId`, `chapterId`, status, roles and readiness flags, but not course or chapter titles. — Header hypothesis in §3.
- Learner components `FlashcardStage`, `QuestionResponse` and `ExerciseContext` live in `app/(client)/learn/[course-slug]/[topic-slug]/_components/`; `QuestionResponse` is wired to grading callbacks. — G5, preview hypothesis.
- Tests that pin current UI: `e2e/smoke/exercise-authoring.smoke.spec.ts` (button `Add TOEIC exercise`, dialog labels, `Save exercise`), `flashcard-delete.smoke.spec.ts` (`.group` card, `Xóa thẻ từ vựng`), `published-topic-live-edit.smoke.spec.ts` (`Sửa thẻ từ vựng` dialog), `topic-create-navigation.smoke.spec.ts` and `e2e/support/structure-ui.ts:30` (heading `Topic Builder`, back link), `__tests__/components/published-topic-authoring.test.tsx`, `add-exercise-dialog.test.tsx`, `topic-settings-navigation.test.tsx`, `topic-workflow-panel.test.tsx`, plus source-string tests in `course-workspace-routes.test.tsx` and `course-authoring-trust.test.tsx`. — Checkpoint verification.
- [ACTION-QUEUE-001](../../problems.md) (Accepted 2026-10-24): `TopicBuilderTabs` writes tabs with native `history.replaceState(null, …)`, which Next 16.2.6 dispatches as a restore that drops a pending server action; the Owner decided to skip `issue-deep-links` and `dashboard-return-freshness` on CI (`test.skip(!!process.env.CI, …)`) and replace them with new tests in this redesign; its exit condition is "the redesign ships with its own tests, or Next is upgraded to 16.3.0 or later". E2E-DEV-001 (Accepted, not to fix) is a `next dev`-only failure of `dashboard-return-freshness`. CI runs smoke on a production build (`NEXT_DIST_DIR=.next-e2e`, `E2E_WEB_SERVER=start`, `playwright.config.ts:6-7`, `.github/workflows/ci.yml:282`). — AC12, G8.
- E2E fixtures are per-spec seed modules in `scripts/e2e/` built on `createBaseTopicAuthoringFixture` (`scripts/e2e/support/course-authoring-base-fixture.mjs:69`); `exercise-authoring-fixture.mjs` gives a draft topic owned by the seeded teacher and `learning-workspace-matrix-fixture.mjs` gives published topics. No fixture gives a pending topic or a collaborator outside the topic group. — QA fixture readiness.
- Installed: `react-hook-form`, `zod`, `@dnd-kit/*`, `tw-animate-css`, `lucide-react`, `sonner`. — Decision 46.7 needs no new package.

## 3. Bounded implementation hypotheses

- Layout: a feature-local `AuthoringWorkbench` (list pane, editor pane, preview pane; sheet below `lg`) shared by the three content tabs, plus `useUnsavedGuard` (in-app prompt + `beforeunload`). May change shape if AC3–AC6 and G4 hold.
- Visual direction (to be finalized in CP2 with the `frontend-design` two-pass critique and Owner review): canvas `#F8FAFC`, a calm white work surface, the list as a dense rail with Route Blue selection (`#EFF6FF` + left marker), the editor with large inline-label fields, and the preview on an inset surface styled like the learner card. Signature: the editor ↔ preview pair, where the preview reacts to each keystroke (card flip on toggle, option highlight for the correct answer). Motion budget (Decision 46.7): pane and sheet slide, list item enter/leave, save confirmation tick, preview flip; all disabled under reduced motion. Each may change if the Owner review rejects it.
- Tab counts: show an item count on each content tab only if it comes from data already loaded on the page (for example the DTO or `getCourseStats`-style reads the page already makes); otherwise omit counts rather than add a fetch per tab.
- Header path: keep the topic title as `h1` and the existing back link; show course and chapter titles only if `page.tsx` can read them through existing server reads (`getChaptersByCourseId` or the course read the Structure page uses) without a new action. Otherwise ship without them.
- Preview: new teacher-local presentational components; reuse `ExerciseContext` for passage/media only if its props accept unsaved values and `storage://` references resolve the same way as in `ExerciseTab` today; unsaved uploads preview from a local object URL.
- Exercise editing: split `ExerciseTab` and `AddExerciseDialog` into an outline, node editors and a composer that reuse the existing RHF resolver and `QuestionGroupMediaField`. File split and names may change while G1 and AC5 hold.
- G8 mechanism: load each tab's list once from `page.tsx` (server props) or keep tabs mounted so switching does not start a server action, and write `?tab=` only when no action of the page is pending. Either may change if AC12 holds on the production build.
- Readiness markers in the outline reuse the dashboard issue codes already computed by `lib/course-readiness.ts` or the existing client checks; no new rule.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | This plan, Decision 46, Units row, TFEAT-004 status. | `npm run docs:check`; Codex plan review PASS. |
| CP1 | Bulk add removed (AC8) and Memory check moved to its own tab with the `memory-check` value (AC2), on the current UI. | `npx tsc --noEmit`; `npm run lint`; `npm run test:run` for `card.test.ts`, `published-topic-authoring.test.tsx`, `add-exercise-dialog.test.tsx`, `course-workspace-routes.test.tsx` (route helpers and issue context); `npm run test:integration -- __tests__/integration/exercise-authoring-rpc.test.ts` on the isolated runtime; `rg -n "Aiken\|hàng loạt\|createBulkCards\|bulkExerciseSchema"` returns only ADR history if kept. |
| CP2 | New shell: header, lifecycle area, tab grammar, workbench layout and sheet, unsaved guard including lifecycle actions; Settings restyled; G8 tab mechanism; `topic-builder-matrix` fixture (AC1, AC6 mechanics, AC11, AC12 mechanism). | Component tests for tab routing/deep links, the guard and a dirty editor before `Gửi duyệt`; `topic-workflow-panel` and `topic-settings-navigation` tests; new smoke `topic-builder-tabs` (fast tab switch while an action is held, deep-link guidance kept, Overview return after a save) passing on the production build, built the way CI does (`.github/workflows/ci.yml` "Build application for E2E"): start the isolated runtime (API 45441), source `.e2e-runtime/supabase.env`, run `NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY NEXT_DIST_DIR=.next-e2e npm run build` (the public values are inlined at build time), then `E2E_WEB_SERVER=start npm run test:e2e -- <spec>`; `issue-deep-links` and `dashboard-return-freshness` pass on that build with the CI skip removed, or are deleted with their assertions moved into the new spec; browser check at 1440 / 768 / 375 px. A `next dev` failure that matches E2E-DEV-001 is reported, not fixed. |
| CP3 | `Từ vựng` workbench with inline editor, `Lưu & thêm tiếp`, shortcut, search and live preview (AC3, AC7 for cards, AC9). | Component tests: create, edit, failed save keeps input, dirty-switch prompt, published delete dialog, read-only; e2e `flashcard-delete` and `published-topic-live-edit` updated to the new selectors and passing. |
| CP4 | `Memory check` workbench and preview (AC4, AC7). | Component tests: add, edit, last-question delete removes the memory check, option validation; manual check against `/learn` memory-check stage. |
| CP5 | `Bài tập` outline, node editors, Part composer, preview (AC5, AC7). | Component tests for each node editor, composer Part rules (1–7), media field, correct-answer change dialog on a published topic; e2e `exercise-authoring` updated and passing; `issue-deep-links` passes. |
| CP6 | Polish, motion, reduced motion, accessibility and responsive audit; final self-review; Owner review of the running screen. | `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run test:e2e:smoke` on the production build made as in CP2 (AC12 evidence comes only from that build); browser matrix from the `topic-builder-matrix` fixture: draft / pending / published × can edit / cannot edit (by `workflow.canEdit`) × 1440 / 768 / 375 / 320 px and 200% zoom, keyboard-only journey, measured contrast; Codex implementation review PASS. |

Each CP is one local commit when the Owner grants commits; push, PR and merge are separate grants. At delivery, ACTION-QUEUE-001 is shrunk to resolved in `problems.md` and TFEAT-004 is marked done, in the same PR.

### QA fixture readiness

- QA type: browser QA of the route across lifecycle and permission states, plus automated smoke.
- Canonical fixture source: `scripts/e2e/support/course-authoring-base-fixture.mjs` with the existing seeded teacher and admin accounts.
- Existing covered states: draft topic edited by its creator (`exercise-authoring-fixture.mjs`); published topics with cards, memory check and exercises (`learning-workspace-matrix-fixture.mjs`).
- Missing states: a pending topic submitted by its author; a course collaborator who is not in the topic group (`workflow.canEdit = false`); a previewer who is in the topic group (can edit per TFEAT1, so not read-only); a topic with a rejection reason; a topic with one memory-check question and a Part 1 exercise with media.
- Required fixture additions: one narrow `scripts/e2e/topic-builder-matrix-fixture.mjs` on the base fixture that seeds those topics and memberships through existing RPCs or admin writes the other fixtures already use, with deterministic IDs and its own cleanup. Expected `canEdit` per state is asserted from `getTopicWorkflow`, not assumed from the role name.
- Reset/setup command: the fixture's prepare function from the spec (`npm run test:e2e -- <spec>`) on the isolated runtime; if Kong returns 502 after a reset, restart `supabase_kong_voca_space_e2e`.
- Fixture checkpoint: CP2.
- Browser QA may begin when: the fixture seeds and cleans up twice in a row with no leftover rows and each state's `canEdit`/status matches the matrix.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Rewriting ~3 000 lines of authoring UI regresses an edge path (media replace, published warnings, issue deep links). | Keep action calls and schemas unchanged (G1–G3); port existing component tests before replacing components; run the four affected e2e smokes per CP. |
| Unsaved guard misfires (blocks clean navigation or misses Next.js client navigation). | One dirty source (G4); tests for clean and dirty switches; manual check of back link, tab switch and browser back. |
| Expressive motion hurts dense editing. | Motion only on pane/sheet/list/preview transitions, never on typing; reduced-motion path; Owner review at CP2 before the content tabs. |
| `memory-check` tab breaks deep links or stored links. | Unknown tabs already fall back; issue rules keep `exercises`; route helper tests. |
| Mobile authoring of TOEIC exercises is cramped. | Sheet with sequential sections; verify at 375 px in CP5; if a step is unusable, stop and ask rather than hide it. |

- Rollout runbook: none beyond normal PR, CI, merge and Vercel deploy; no migration.
- Stop when: a needed change touches a server action, schema, RPC or RLS; the existing tests contradict the Spec; the Owner rejects the CP2 visual direction.
- Rollback: revert the merge commit; no data or schema changes to undo.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
