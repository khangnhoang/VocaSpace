# TFEAT1 detail plan — Edit published topics in place

Revision: r3, 2026-10-18. Codex CLI `gpt-6.1-sol` / `high` plan review PASS at round 3 (r1 and r2 findings applied). Product decisions: Owner-confirmed 2026-10-18 (four answers below). Source: [TFEAT-001](../../../teacher-workflow/future-features.md). Master plan: [plan.md](../../plan.md); Decision 39 replaces the W11 interim rule. The Owner approved this plan on 2026-10-18 for implementation by one `sonnet-high-implementor` session with local commits.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: an author edits a published topic's content without sending it back to draft; learners see the change at once. Only changes that can remove content or change grading show a warning first, in an app dialog.

| ID | Observable result |
| --- | --- |
| AC1 | A topic-group member as `d1_topic_group_member` defines it today (original creator, responsible author or active contributor with a valid course membership, whatever the course role) who creates, edits, soft-deletes or restores a card, exercise, question group, question, option or memory-check question, or renames the topic, on a `published` topic, succeeds and the topic stays `published`. No content RPC returns `TOPIC_PUBLISHED_CONFIRM_REQUIRED` or writes `status='draft'`. |
| AC2 | Learners and the public Preview read the edited content on their next load, with no review or approval step. |
| AC3 | Unchanged boundaries: `pending` stays frozen (`TOPIC_PENDING_FROZEN`); outsiders and collaborators outside the topic group (including a read-only previewer), anon and removed topics are still refused; direct Data API writes to a published topic's content tables are still refused (RLS and `TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY`). Topic delete (`d1_delete_topic`), restore, review, reject and admin moderation keep their current lifecycle behavior. |
| AC4 | Replacing or clearing question-group media on a published topic cleans up the old storage object exactly as on a draft topic: best-effort, within the existing Storage DELETE rule (the uploader or an admin) and reference guard, so another author's object stays in place while the content update still succeeds; a failed group save still cleans up its own new upload. Pending and removed topics still refuse the delete. |
| AC5 | On a published topic, deleting content (card, exercise, question group, question, memory-check question or the whole memory check, and hiding the topic) and a question save that removes an option or changes which option is correct first open an app dialog that says what learners lose or how grading changes. Cancel changes nothing; confirm performs the action. Every other edit, including adding content and renaming, saves directly with no dialog. Draft topics never show this warning. `window.confirm` is no longer used for this. |
| AC6 | Copy no longer says edits return the topic to draft (`TopicWorkflowPanel` next-action text and server fallback messages). |
| AC7 | Learner state follows the existing D4/L1/LF9 rules with no new recompute: stored answers are not re-graded; completion checks read the live correct option at the next progress sync; `is_topic_completed` stays sticky; a new card relocks the memory check until rated Good/Easy (LF9 AC2); a new memory-check question or exercise question is required again for its stage flag. The AC5 dialog for a correct-answer change states that learners who chose the old answer must answer again. |

### 1.2 Scope and non-goals

- In scope: the DB content-mutation boundary and the published media-delete rule; server actions and their Zod/params for the published flag; the authoring client callers; one shared warning dialog; copy; focused integration/action/component tests and one authoring e2e smoke; master-plan Decision 39, unit row, progress State; TFEAT-001 status; a new future feature for change history.
- Non-goals: change history/audit log (Owner: later, new future-feature entry, no new user data now so no `/privacy` change); candidate revisions (W11 future direction stays); re-grading stored answers; notifying learners; TFEAT-002/003; topic delete/restore/review/moderation lifecycle; hosted migration, commit, push, PR, merge or deploy without separate grants.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The published allowance exists only inside the trusted content RPCs, after their existing membership/pending/removed checks; a direct Data API write to published content stays refused. | Any member could write published rows directly, bypassing RPC validation and the last-question/memory-check guards. |
| G2. Keep every content RPC signature and its `p_confirm_published` parameter (accepted and ignored for content edits); `d1_delete_topic` keeps its confirmation. | A dropped or changed signature breaks the deployed app between migration and deploy, or PostgREST resolves the wrong overload. |
| G3. Apply the migration before deploying the new app; roll back the app before the migration. | The new app calls without confirmation against the old DB and every published edit fails with `TOPIC_PUBLISHED_CONFIRM_REQUIRED`. |
| G4. The warning is client UX only; the server does not need the confirmation for content edits. The dialog runs before the server call and a cancel makes no request. | A cancelled dialog still mutates content, or the dialog appears after the write. |
| G5. Media delete on published topics keeps the reference check (only unreferenced objects of that topic) and the group-member check. | Editing media could delete objects still used by live content or by other topics. |

### 1.4 Owner decisions that bind this unit (2026-10-18)

- Edit in place: the topic stays published and changes are live. This replaces the W11 interim rule "editing published content needs a warning and explicit confirmation and demotes the topic to draft"; W11's candidate-revision direction stays a future option (Decision 39).
- Who may edit: everyone with authoring rights today (the current `d1_topic_group_member` rule: topic group of creator, responsible author and contributors, independent of course role); no new restriction and no widening.
- Warning: an app dialog only for deleting content or changing a correct answer; other edits save directly.
- History: later, as its own future feature; not in this unit.
- 2026-10-18: memory check opening the exercises by itself after a pass is the intended LF9 behavior (context for the matrix e2e fix; not changed here).

## 2. Repository facts

Baseline: `051ec81`, checked 2026-10-18.

- `public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published)` (latest `20260916140000_d1_topic_group_content_boundary.sql:189-246`) locks course then topic, refuses missing/removed/non-member/pending, raises `TOPIC_PUBLISHED_CONFIRM_REQUIRED` on published unless confirmed, then sets `status='draft'` and returns `'draft'`. EXECUTE is service_role only.
- Its callers (latest definitions): `d1_update_topic`, `d1_create_card`, `d1_bulk_create_cards`, `d1_update_card`, `d1_delete_card`, `d1_restore_topic_content`, `d1_update_exercise_basic`, `d1_delete_question_group`, `d1_delete_question` (`20260915110000`), `d1_update_question_group` (`20260917100000:370-423`), both overloads of `create_exercise_with_content`, `soft_delete_exercise_cascade`, `sync_question_with_options` (`20260916140000`), `d3_add_memory_check_question` (`20261002100000:391+`, returns `topic_status`). The 2-arg overloads call it with `false`.
- Row triggers on cards, exercises, question_groups, questions and question_options call `d1_lock_topic_for_mutation` (latest `20260916140000:7-52`), which raises `TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY` on published for non-service callers. Today it passes only because prepare demoted the topic first in the same transaction.
- Child-table RLS helpers `can_modify_*` require `t.status = 'draft'` (`20260916140000:99-187`, check at :111); authenticated direct UPDATE on topics has no permitting policy.
- The inner workers also call these helpers explicitly, so they refuse published even inside SECURITY DEFINER: `d1_create_exercise_with_content_unchecked` (`20260919130000_d1_inner_create_authority.sql:70`), `d1_soft_delete_exercise_cascade_unchecked` (renamed from `20260915100000:1265`) and `d1_sync_question_with_options_unchecked` (renamed from `20260611150129_harden_question_option_order_index.sql:163`).
- `d1_topic_group_member` (latest `20260919100000_d1_topic_authority_split.sql:20-45`) checks creator/responsible/contributor plus a course membership row, not the course role; `topic-group-content-boundary.test.ts:332/374` shows a previewer creator editing.
- Server Action `deleteQuestionGroupMedia` refuses non-draft topics before calling Storage (`app/actions/exercise.ts:304`); `ExerciseTab.tsx:193` and :395-397 use it to clean up uploads after a failed group save; `__tests__/actions/question-group-media.test.ts:242` locks that refusal.
- `d1_question_group_media_delete_allowed` (latest `20260923160456_q7_trusted_legacy_media_delete_guard.sql:2+`, status check at :40) refuses non-draft topics; storage upload policies already allow any non-pending status.
- `d1_delete_topic` (latest `20260924110000:903-967`) checks the confirmation itself and does not call prepare; `moderate_platform_content` demote has no confirmation. Both are out of scope.
- App: `lib/course-authoring/topic-workflow.ts` `confirmPublishedTopicMutation` (`window.confirm`) has 16 call sites across `ChapterWorkbench`, `SettingsTab`, `TopicWorkflowPanel`, `AddFlashcardDialog`, `BulkAddFlashcardDialog`, `FlashcardTab`, `AddExerciseDialog`, `ExerciseTab`, `MemoryCheckSection`. Card/topic actions carry `confirmPublished` in Zod schemas (`lib/schemas/card.ts`, `lib/schemas/topic.ts`); exercise actions take a positional boolean. `components/ui/confirm-dialog.tsx` `ConfirmDialog` is the existing destructive dialog.
- Learner side: `user_question_answers.is_correct` is a write-time snapshot (`20261008130544_l1_learner_integrity.sql:85-104`); `d4_topic_completion_state` reads the live `question_options.is_correct` (`20261010090000:18-98`); `is_topic_completed` is sticky (`20261016173554:226`); adding content is documented in D4 plan lines 286-287. No server-side cache tags on learner reads.
- Tests asserting the current demotion: integration `topic-review-lifecycle.test.ts` (:791, :901, :957, :1035 and others), `topic-group-content-boundary.test.ts:494`, `memory-check-stage.test.ts:244/262`; component `course-structure-workspace.test.tsx:519` (cancel published rename), `topic-settings-navigation.test.tsx`; action tests pass `p_confirm_published`.

## 3. Bounded implementation hypotheses

- DB: one additive migration redefines `d1_prepare_topic_content_mutation` so a published topic is allowed without demotion and returns its status, and marks the transaction as a trusted published edit for that topic (for example a transaction-local `set_config` keyed to the topic id) that `d1_lock_topic_for_mutation` accepts for that topic only. Redefine `d1_question_group_media_delete_allowed` to accept `draft` or `published`. Callers that return the prepare status keep their shape. Any equivalent mechanism is allowed if G1/G5 hold and integration tests prove a direct write stays refused.
- The three inner workers listed in section 2 replace their draft-only `can_modify_*` check with a check that accepts the trusted published edit for that topic (or `draft`), keeping group membership, pending and removed refusals. The `can_modify_*` helpers used by RLS stay draft-only so direct writes stay refused (G1). Every overload of each wrapper gets a published integration case.
- `deleteQuestionGroupMedia` accepts `draft` or `published` (still refusing removed and pending), keeping uploader, membership and the Storage reference guard.
- App: remove `confirmPublishedTopicMutation`; actions stop taking `confirmPublished` for content edits (keep it for topic delete); RPC payloads keep sending a value only where the DB parameter has no default. Add one shared published-warning dialog (built on `ConfirmDialog`) with an async confirm hook; callers await it before their server call. Detect a correct-answer change by comparing the saved correct option id and the kept option ids against the edit.
- Topic hide/delete flows that already show a dialog put the published warning into that dialog instead of a second prompt.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | DB boundary: live published edits, published media delete, direct writes still refused, rollback file | Isolated runtime rebuild; updated and new integration cases in `topic-review-lifecycle`, `topic-group-content-boundary`, `memory-check-stage`, `topic-authorship-boundary`, `question-group-media-storage` (including a previewer-role creator on a published topic, both overloads of each wrapper, and a second author replacing media they did not upload); rollback run shows the old behavior returns |
| CP2 | App: actions, warning dialog, callers, copy; docs (Decision 39, unit row, State, TFEAT-001, history future feature) | Action and component tests; `npx tsc --noEmit --incremental false`; lint on changed paths; `npm run docs:check`; `git diff --check`; one authoring e2e smoke on the isolated runtime; Owner QA pending |

Planned commands (not yet run): `npm run test:integration -- <files above>` through the isolated runner (API 45441, `ALLOW_DB_INTEGRATION_TESTS=true`); `npm run test:run -- __tests__/actions/card.test.ts __tests__/actions/exercise-authoring-actions.test.ts __tests__/actions/course-structure.test.ts __tests__/actions/question-group-media.test.ts __tests__/components/course-structure-workspace.test.tsx __tests__/components/topic-settings-navigation.test.tsx __tests__/components/topic-workflow-panel.test.tsx` plus new dialog/caller tests; `npm run test:e2e -- <new authoring smoke>`.

### Test intent

- Integration: for each content RPC family, a member edits a published topic and it stays published with the change applied; pending still frozen; outsider refused; a direct client insert/update on a published child row still refused; a learner reads the edited card; changing a correct option leaves the stored snapshot unchanged and the next sync uses the live answer (sticky completion kept); published media delete removes only unreferenced objects; `d1_delete_topic` confirmation unchanged.
- Component: the dialog opens for each AC5 case on a published topic and not for adds/edits or on draft; cancel makes no action call; confirm calls the action once; a question save that keeps the correct option opens nothing.
- E2E smoke: an author edits a card in a published topic, the status badge stays published, and a learner sees the new text.

### QA fixture readiness

- QA type: author and learner on one published topic with cards, an exercise and a memory check.
- Source: reuse the `full` fixture of `scripts/e2e/learning-workspace-matrix-fixture.mjs` (published topic with author, enrolled learner, cards, memory check and exercise at :179 and :359-387); no new fixture.
- QA starts after CP1/CP2 automated checks pass on the isolated runtime.
- Isolated runtime only; never reset the root or hosted database.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The allowance leaks to direct writes or another topic | Allowance is keyed to the prepared topic and set only after the existing checks; integration tests for direct writes and a second topic in one RPC. |
| A content RPC fails on a published topic for a reason the demotion used to hide (RLS, trigger, storage) | Integration case per RPC family on a published topic; media delete covered by AC4. |
| Correct-answer edits change learners' completion without notice | Owner-accepted; the AC5 dialog says so; sticky topic completion unchanged. |
| A new memory-check question locks exercise answering for learners until answered (existing D4/LF2 rule) | Unchanged behavior, stated in Decision 39; no dialog per the Owner's rule. |
| Migration/app order | G3: hosted migration first under a separate grant, then deploy; old app keeps working against the new DB (its `true` flag is ignored). |

- Rollout: Owner plan approval; implementation with local commits as granted; implementation review (Codex) and local verification; separately granted push/PR/CI; separately granted hosted dry-run, apply and read-only postflight; then merge/deploy and Owner QA.
- Rollback: revert the app first, then apply the rollback file restoring the previous definition of every function the migration changes (`d1_prepare_topic_content_mutation`, `d1_lock_topic_for_mutation`, the three inner workers and `d1_question_group_media_delete_allowed`). No data changes to undo.
- Stop if a content path cannot stay published without widening direct-write access, or if a learner-state rule would need to change.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
