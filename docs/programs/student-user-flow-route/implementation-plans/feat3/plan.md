# FEAT3 detail plan — Learning days, streak and recent study

Revision: r3, 2026-10-19. Codex CLI `gpt-6.1-sol` / `high` plan review PASS at round 5 (r1, r2 and r4 findings applied; G6 bounded reads added after an Owner question). Owner approval: 2026-10-19, implementation by one `sonnet-high-implementor` session with local commits. Product decisions: Owner-confirmed 2026-10-19 (§1.4). Source: [FEAT-003](../../future-features.md). Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: from now on, every learning action a learner takes is recorded on the server, per minute, with its course and topic. From those records the learner sees a daily streak and recent study in four places:
- on `/learn`: an overall streak, the last 7 days and an estimated study time this week;
- on `/courses/[course-slug]` and `/learn/[course-slug]`: that course's streak and its 3 most recently studied topics;
- in the topic workspace: that course's streak.

Nothing is derived from older data. The streak starts counting once the feature ships.

| ID | Observable result |
| --- | --- |
| AC1 | A **learning action** is exactly one of: submitting an answer to an exercise question; submitting an answer to a memory-check question; rating a flashcard, either in the topic workspace or in the `/learn` review sheet. Each one, once the learner's own answer or rating row is saved, records activity for the acting learner, the minute it happened, and the topic and course the question or card belongs to. A review-sheet rating is attributed to the card's own topic and course. Opening a page, the topic-progress sync, the LF9 memory-gate triggers, Preview and any backfill record nothing. A rejected action (not enrolled, locked gate, invalid input) records nothing. |
| AC2 | A **learning day** is a calendar date in `Asia/Ho_Chi_Minh` on which the learner has at least one learning action. The overall streak counts all courses; a course streak counts only actions attributed to that course. |
| AC3 | The **streak** is the number of consecutive learning days ending today, or ending yesterday when today has no action yet; otherwise it is 0. A learner who studied yesterday but not yet today still sees yesterday's streak, with a short prompt to study today to keep it. |
| AC4 | **Study time** is an estimate built from activity minutes. Each minute with an action counts as one minute, and the gap between two activity minutes no more than 5 minutes apart also counts. The figure is labelled as an estimate (for example `khoảng 1 giờ 20 phút`). It is shown only on `/learn`, for the current week (Monday 00:00 to now, `Asia/Ho_Chi_Minh`). |
| AC5 | `/learn` shows, in the right column with `Ôn tập hôm nay` and `Nhịp ghi nhớ`, one card with the overall streak, a 7-day strip (today and the 6 days before, each marked studied or not) and this week's study time. A learner with no activity sees a zero state that invites them to start, not an error. |
| AC6 | `/courses/[course-slug]`, for a signed-in learner enrolled in the course, shows the course streak and up to 3 topics of that course ordered by most recent activity minute; topics tied on the same minute keep a fixed order (their order in the course), accepted by the Owner as up-to-one-minute imprecision. Each topic shows its title, a relative day (`Hôm nay`, `Hôm qua`, `N ngày trước`) and a link into the workspace. A topic that is no longer visible to the learner is skipped. Anonymous and non-enrolled visitors see no change. `/learn/[course-slug]` shows the same block in or next to its progress card. |
| AC7 | The topic workspace header shows the course streak. It updates after a learning action in the same session without a reload, at least when the action starts a new learning day. |
| AC8 | Only the learner can read their own activity. No other learner, teacher, author or admin screen or API path can read it. Learners cannot insert, change or delete activity rows directly; rows come only from the learning-action paths in AC1. Deleting the user deletes their activity. |
| AC9 | `/privacy` states, in the same PR, that VocaSpace records the times of learning actions (per minute, with course and topic) to show the streak, recent study and study time, and that this data is visible only to the learner. The wording needs Owner approval before merge. |
| AC10 | Failure to read the summary never blocks a page. The block shows a quiet unavailable state, and progress, learning and review keep working. A failure to record activity never fails or rolls back the learning action itself. |

### 1.2 Scope and non-goals

- In scope:
  - the activity storage, its write hook and the read path;
  - the four surfaces in AC5-AC7;
  - the `/privacy` update;
  - tests;
  - master-plan Decision 42 and the unit row; progress State (including the FEAT12 merge refresh); FEAT-003 status.
- Non-goals:
  - browser-timezone days (deferred by the Owner until the international format);
  - client heartbeat, page-view or visibility tracking;
  - streak freeze, repair, goals, reminders, notifications or badges;
  - per-course study time;
  - a streak badge in the global header;
  - any teacher, author or admin view, ranking or analytics of learner activity;
  - backfilling past activity from `updated_at` or FSRS dates;
  - FEAT-002 `lastAccessTopic` (the recent-topics list does not change `Tiếp tục học`);
  - hosted migration or deploy without separate grants.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Activity is recorded in the database, in the same transaction as the saved answer or rating row, and only when `auth.uid()` is that row's learner (so migrations, backfills and service-role writes record nothing). It is never recorded by a separate client call. `lf2_submit_card_review` is `security invoker`, so the rating path cannot call a helper that learners may not execute. The write therefore runs from a `SECURITY DEFINER` trigger on the saved row, or from an equivalent that is proven by a test with an `authenticated` caller. | The client can fake or drop activity; the rating path silently records nothing (AC1); or a recorded action disagrees with what was saved. |
| G2. One row per learner, topic and minute, written with `on conflict do nothing` (no counter). The activity write sits in its own `exception when others or query_canceled` block around only that write, as the existing progress-sync containment does (`lf2_learning_action_rpcs.sql:119`, `:197`), so the learning action still commits and returns its normal result. | Retries create duplicates, or a broken or cancelled activity write breaks learning (AC10). |
| G3. The day boundary and the week start are computed in SQL with `Asia/Ho_Chi_Minh` from the database clock. Every reader uses the same function, not separate TypeScript date math. | The streak changes by surface or by server clock. The card-review path uses the Node clock today (`review.ts:155`), which can differ on the UTC day boundary. |
| G4. RLS allows a learner to select only their own rows. There is no insert, update or delete policy for `authenticated` or `anon`. Any `SECURITY DEFINER` function sets `search_path = ''`, checks `auth.uid()`, and is either not executable by learners (write helper) or returns only the caller's own summary (read). | Activity leaks to others, or learners write arbitrary days (AC8). |
| G6. Each summary read costs work bounded by what it shows, not by the size of the learner's history: recent topics use one indexed newest-row lookup per topic of the course; the streak checks days backwards with indexed lookups and stops at the first empty day; the 7-day strip and week time read only their window. | A learner with a long history makes every `/learn`, course page and workspace load slower over time. |
| G5. The public course page reads the summary only for a signed-in, enrolled learner, and keeps the existing cached public payload unchanged for everyone else. | Learner data enters a shared cache, or anonymous visitors pay for an extra query. |

### 1.4 Owner decisions that bind this unit (2026-10-19)

- Placement: `/learn` (overall), `/courses/[course-slug]` and `/learn/[course-slug]` (course streak and 3 recent topics), and the topic workspace (course streak).
- Streak on the course pages and in the workspace is the course's own streak, not the overall one.
- A learning day needs at least one learning action. Review-sheet ratings count and are attributed to the card's course.
- Study time is estimated from learning actions, with no client tracking.
- Per-minute storage stays (clarity over write volume); same-minute ties in recent topics are accepted with a fixed order.
- Days use fixed `Asia/Ho_Chi_Minh`. Browser timezone comes later, with the international format.

## 2. Repository facts

Baseline: `fd5b429`, checked 2026-10-19.

- No table records learning history. `user_topic_progress`, `user_question_answers` and `user_flashcards` keep one row per learner and item and overwrite it (`lf2_learning_action_rpcs.sql:95-107`, `:181-186`). There is no streak, session, time or timezone column anywhere in `supabase/migrations` or `types/database.ts`. This justifies the new storage and the no-backfill rule.
- `docs/ui-design-system-and-review/future-features.md:39-41` forbids deriving a streak from topic completion, flashcard review dates or other proxy signals. Future streak work owns the history model, day/timezone boundary, qualifying activity and privacy. This justifies AC1-AC3, AC8 and the no-backfill rule.
- Answers go through `public.lf2_submit_question_answer` (latest body `20261011120000_lf3_memory_check_cards_seen_gate.sql:124`, `security definer`). Card ratings go through `public.lf2_submit_card_review` (`20261010150000_lf2_learning_action_rpcs.sql:152`, `security invoker`), called by `app/actions/review.ts:167` from both the workspace and `ReviewSheet` (`hooks/use-card-review-queue.ts:79`). This justifies AC1, G1 and G4 (the two RPCs differ in security mode).
- The card-review timestamps come from the Node clock (`app/actions/review.ts:155`, `:162`); the answer path uses the database `now()`. This justifies G3.
- `cards.topic_id` (`idx_cards_topic_id`, `20260609114505_remote_schema.sql:1143`) and `topics.course_id` link a card to its course. Questions reach their topic through `exercises`. This justifies the AC1 attribution.
- `/learn` renders its right column in `DashboardAside` (`app/(client)/learn/_components/LearnDashboardClient.tsx:389-432`, `ReviewCard` and `MemoryRhythmCard`), loaded by `getLearnDashboard` (`app/actions/learn-dashboard.ts:31`). This justifies AC5.
- `/courses/[course-slug]` renders `PublicCourseDetailView` from the request-cached `getPublicCourseDetail`, which overlays `is_enrolled` for a signed-in user (`app/actions/public-course.ts:111-128`). The enrolled learner's actions are in `PublicCourseEnrollmentCard.tsx:68`. This justifies AC6 and G5.
- `/learn/[course-slug]` renders `EnrolledCourseOverview` with a `ProgressCard` (`EnrolledCourseOverview.tsx:129-212`); the workspace header is `LearningWorkspace.tsx:1278-1332`. This justifies AC6 and AC7.
- `/privacy` lists learning data (`app/(client)/privacy/page.tsx:34`) and says changes to data collection must update the page in the same PR (`:9-10`, AGENTS.md "User-data disclosure"). This justifies AC9.
- Admins can read every learner's `user_flashcards` and `enrollments` (`20261007100000_a5_admin_learning_reads.sql`, cited at `app/actions/review.ts:97`); `user_topic_progress` and `user_question_answers` are own-row only. This justifies AC8 (the new data follows own-row only).

## 3. Bounded implementation hypotheses

- Storage: a table such as `public.user_learning_activity (user_id, course_id, topic_id, activity_minute timestamptz)`, unique on `(user_id, topic_id, activity_minute)`. It has foreign keys with `on delete cascade` to `auth.users`, plus an index for per-user and per-course reads by time. An equivalent shape is allowed if AC1-AC10 hold.
- Write: `SECURITY DEFINER` (`search_path = ''`) triggers `after insert or update of selected_option_id` on `user_question_answers` and `after insert or update of last_rating` on `user_flashcards`, so a statement that touches only other columns (for example `updated_at`) records nothing, while resubmitting the same answer still counts. Each records the minute row when `auth.uid() = new.user_id`, resolves the topic and course from the question or card, and contains its own failure (G2). The trigger functions are not executable directly by learners. Neither RPC changes its security mode. The answer path may instead call the helper from `lf2_submit_question_answer` (`security definer`), as long as both paths keep the same G1/G2 behavior.
- Read shape for G6: an index on `(user_id, activity_minute desc)` for the overall summary, one on `(user_id, course_id, activity_minute desc)` for a course, plus the unique key `(user_id, topic_id, activity_minute)`. Recent topics take the course's visible topics, each with a `lateral … order by activity_minute desc limit 1`, then keep the newest 3. The streak walks back one day at a time with an `exists` per day.
- Read: one own-user RPC, for example `feat3_learning_summary(p_course_id uuid default null)`. It returns the streak, the 7-day flags and this week's estimated minutes (overall), or the streak and the 3 recent topics with their last activity time (course). Topic visibility reuses the existing learner read rules.
- UI:
  - a `/learn` aside card;
  - one shared course block used on the public course page (enrolled only, outside the cached public payload) and the enrolled overview;
  - a compact streak chip in the workspace header that refreshes from the action results or a light refetch after an action;
  - visuals follow `frontend-design` and the existing aside and progress-card tokens.
- `/privacy`: one sentence added to the learning-data item and one to the visibility section. The proposed wording is in the PR for Owner approval.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Activity storage, the write hook on both learning paths, the own-user summary RPC, generated types | Rebuild and integration tests run only on the isolated runtime (`E2E_SUPABASE_WORKDIR=.e2e-runtime`, API port 45441, `ALLOW_DB_INTEGRATION_TESTS=true`), as the existing LF2 suite requires. Never reset the root DB. Before Owner QA, the root DB receives the new migration with a non-reset local apply (`npx supabase migration up`). Integration tests: each AC1 action records one minute row with the right course and topic; a rejected action, Preview, the LF9 gate triggers and the progress sync record none; several actions in the same minute leave one minute row; the rating path records with an `authenticated` caller, and the learner cannot call the trigger function or write the table directly; a direct update of only `updated_at` on an answer or card row records nothing; another user, a teacher and an admin read nothing; a direct insert by a learner is denied; streak today, yesterday and broken, plus the `Asia/Ho_Chi_Minh` midnight edge; the study-time gap rule; recent topics skip hidden ones; `explain` on a learner with a long synthetic history checks each summary part, overall and per course, and shows that the rows each one reads are bounded by its window or streak length, not just that the plan node is an index scan (G6); a forced activity-write failure, both an ordinary error and `query_canceled` (`57014`), on both the answer and the rating path, still saves the learning row and returns the normal result. `npm run test:integration` on the touched suites. |
| CP2 | Surfaces in AC5-AC7, AC10 states, `/privacy` sentence, docs (Decision 42, unit row, State, FEAT-003 status) | Component and action tests: the `/learn` card (zero, active, yesterday-only, unavailable); the course block (enrolled only, anonymous unchanged, 3 topics, relative days); the workspace chip refreshes after a first action of the day. `npx tsc --noEmit --incremental false`; lint on changed paths; `npm run docs:check`; `git diff --check`; Owner manual QA on local. |

Final cumulative check: the full unit and component suite, plus the integration suites touched by CP1, run on the branch before the PR.

### QA fixture readiness

- QA type: one enrolled learner on the local root DB answers questions and rates cards in two courses, including from the review sheet, across today. A "yesterday" streak needs rows on a previous `Asia/Ho_Chi_Minh` date.
- Source: the local root DB learner used in FEAT12 QA. Previous-day rows are inserted as the database owner into the new table only, for QA, and are recorded in the report. No reset of the root or hosted database.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The activity write slows down or breaks the learning RPCs | G2; a single insert with `on conflict do nothing` on an indexed unique key; a failure test in CP1. |
| The streak differs between surfaces, or around midnight | G3: one SQL function owns days and the week; a midnight-edge test. |
| Learner data leaks through the cached public course page | G5; a test that the anonymous payload is unchanged. |
| Privacy wording ships unapproved | AC9; merge is blocked until the Owner approves the wording. |
| Gate, sync or backfill writes inflate streaks | AC1 and its negative tests. |

- Rollout runbook:
  1. Owner plan approval.
  2. Implementation with local commits as granted.
  3. Codex implementation review.
  4. Owner QA on local.
  5. Push, PR and CI, each separately granted.
  6. Merge.
  7. Hosted migration, separately granted, before or with the deploy. The UI must tolerate the RPC being missing until then (AC10).
- Stop when: recording an action needs a client-sent event; the course of a card or question cannot be resolved for a learning action; or the RPC changes would alter grading, completion or the gates.
- Rollback: first apply a migration that removes the activity write (drops the triggers, or the helper call), so collection stops. Then revert the app commits, including the `/privacy` sentence; never revert the disclosure while collection is still on. The table and its history stay in place; dropping it deletes learner history and needs Owner approval.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
