# LF5 detail plan — Topic completion screen, resume landing, e2e build directory and LF4 closeout

Revision: r8, 2026-10-12 (Codex plan review r1 and r2 findings addressed; Owner Q6 applied to AC7; Owner Q7–Q9 from the manual QA round applied to AC3 and AC8; Owner Q10 to Q13 applied to AC3; Q13 supersedes Q11 and the layout part of Q12). Owner approval: approved 2026-10-12. Master plan: [plan.md](../../plan.md) (Decision 29).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges, opening a topic takes the learner straight to the first stage they still have to finish. A finished topic opens on one shared completion screen. That screen confirms the topic, shows chapter and course progress, offers the next topic (or due review first), and lets the learner pick a stage to review. The redundant memory-check end box and its `Hoàn thành memory check` button are gone. The e2e runner can build and serve the app while the Owner's `next dev` keeps running. The program docs record the LF4 merge.

| ID | Observable result |
| --- | --- |
| AC1 | Landing on a topic that is not completed (`progress.isTopicCompleted` false) opens the first unfinished stage in stage-thread order: <ul><li>**Từ vựng**, when the topic has active cards and either a card is unseen or `progress.isFlashcardCompleted` is false. The queue start, toasts and finished screen are LF4's (unseen-first queue, or the finished screen with the `Ôn ngay N thẻ` offer);</li><li>otherwise **Memory check**, when the topic has one and it is not passed;</li><li>otherwise **Bài tập**, when the topic has exercises with at least one question not yet counted as done.</li></ul> If none applies, the current initial-stage rule (`LearningWorkspace.tsx:183`) is kept as the fallback. |
| AC2 | Landing on a completed topic (`isTopicCompleted` true): <ul><li>if a card is unseen (a card added after completion), it opens Từ vựng as in AC1 with the LF4 unseen toast;</li><li>otherwise it opens the completion screen (AC3).</li></ul> Due cards (LF4 definition: FSRS-due, or latest rating not `Ổn`/`Dễ`) do not bypass the completion screen. They change its primary action (AC3, Owner Q2). |
| AC3 | The completion screen replaces the stage content and follows the accepted [Learning Experience](../../../../ui-design-system-and-review/screen-types/learning-experience.md) Completion and §3 rules. It shows: <ul><li>a confirmation that names the completed topic (`chủ đề` vocabulary, LE §3.1);</li><li>course progress as `completed / eligible topics` with a labelled progressbar. The value is computed from the workspace syllabus, which already holds only published, non-removed topics, so it is the same truth as `buildLearnCourseProgressProjection`;</li><li>the current chapter's local topic progress (`n/m chủ đề`), kept as a separate scale from the course value (LE §3);</li><li>the actions below.</li></ul> Actions: <ul><li>one primary action. With N > 0 due cards it is a filled full-width two-line button, a small 12px line `Có N thẻ đến hạn` over a larger `Ôn ngay` with the accessible name `Có N thẻ đến hạn, Ôn ngay` (Owner Q10 and Q13; both lines start at the same x inside one left-aligned block that the button centres, with no opacity so the small line keeps its contrast), which starts the LF4 due queue. The next-topic action then becomes a full-width subordinate outline button of at least 44px under it. Every input mode shows the same stacked composition with one action per row (Owner Q13, superseding the text-only and side-by-side treatment of Q11 and Q12). Otherwise it is the next-topic action;</li><li>the next-topic action links to the next topic. It is one line labelled `Chủ đề tiếp theo`, with slightly larger text, no chevron and no second line; the next executable unit (LE §3.1) is named by the `Tiếp theo: …` hint above the actions (Owner Q8). On the last topic of the course it is `Về tổng quan khóa học`;</li><li>a `Xem lại` group that lists only the stages this topic has: Từ vựng, Memory check and Bài tập (AC5).</li></ul> While the completion screen shows, the footer keeps its destinations (`Bài sau`, or `Về tổng quan khóa học` on the last topic) but renders them as subordinate, so the screen has exactly one primary action in both the due-first and the no-due branch. Elsewhere the footer is unchanged. The stage thread keeps each stage's own done and locked state as today (`LearningWorkspace.tsx:560-587`). Sticky completion does not mark a stage done: a completed topic whose `isFlashcardCompleted` is false (a later `Lại`) still shows Từ vựng as not done. |
| AC4 | When a learner write in the session reports `topicProgress.newlyCompleted` (the last flashcard rating, the memory-check pass, or the last exercise answer), the workspace shows the completion screen in place of the stage. The workspace holds this as a pending completion until the completion screen first appears. <ul><li>Flashcard rating: the screen appears when the card queue ends, in place of the finished flashcard screen.</li><li>Exercise answer: the feedback stays visible, and the action that acknowledges it opens the completion screen in place. That covers `Câu tiếp theo` and also the last-question `endAction` (`LearningWorkspace.tsx:717`, `QuestionResponse.tsx:220`), which today links to the next topic or the course overview. So the learner never leaves the topic before seeing the screen, whether the completing answer is the last question in order or an earlier missed one.</li><li>Memory-check pass: the AC7 rule applies.</li></ul> The topic-completion toast (`TOPIC_COMPLETED_MESSAGE`) is no longer shown, because the screen carries the result (Owner Q3). The LF4 rule stays: the memory-check toast is shown only when the same result did not newly complete the topic. A write that fails to sync progress still surfaces `progressError` as today. |
| AC5 | `Xem lại` targets: <ul><li>**Từ vựng** starts a full review queue of every active card (LF4 `Ôn lại từ vựng`);</li><li>**Memory check** opens a read-only review of the passed memory check (AC6);</li><li>**Bài tập** opens the exercise stage as it already renders answered questions.</li></ul> While the topic is completed and a stage other than the completion screen is shown, the workspace offers one subordinate action that returns to the completion screen without a reload. |
| AC6 | When the memory check is currently passed (`isMemoryCheckPassed` true, which means every active memory question is currently answered correctly), the memory stage no longer renders the box `Bạn đã trả lời đúng hết memory check` (`MemoryCheckStage.tsx:131-156`). It renders a read-only list of the memory-check questions, in order. Each question shows its options with the learner's stored answer from `answers` marked as correct, plus that question's explanation when it has one. Nothing is written, and the passed state does not change. When the topic has exercises, the review keeps a way to open them. The list is complete both after a reload (AC9 loader) and right after passing in the same session, without a reload (AC9 session path). When the memory check is not currently passed (for example a teacher added a question or changed an answer after the topic completed), `Xem lại Memory check` opens the ordinary answerable memory stage with today's rules, including the LF3 cards-seen lock and `cards_locked` recovery. No option is marked and no explanation is shown for a question that is not currently answered correctly. |
| AC7 | After the final correct memory-check answer (the pass): <ul><li>when the topic has exercise questions that are not yet answered correctly, the feedback keeps its `Mở bài tập` button, which opens the exercise stage (Owner Q4);</li><li>otherwise, whether the topic has no exercises or every exercise question is already answered correctly (Owner Q6), there is no `Mở bài tập` or `Hoàn thành memory check` button. The workspace moves on by itself after the feedback: to the completion screen when the topic newly completed, and otherwise to the first unfinished stage by the AC1 rule (for example Từ vựng when a card still needs `Ổn`/`Dễ`).</li></ul> |
| AC8 | Motion follows the accepted Product Language earned-completion rule. <ul><li>When the completion screen first appears for a pending completion (AC4), a composed sequence of about 1.2–1.5 s tells the truthful changes in order (Owner Q7 accepts this deviation from the 600–900 ms cap of the Product Language, for this screen only): <ul><li>course progress moves from its previous value to the new one, with a fixed fill duration of about 1 s whatever the size of the change; the newly gained segment is highlighted with a brighter tint while it fills, and the highlight then fades so the bar settles to its normal fill colour;</li><li>the chapter bar fills the same way, slightly after the course bar;</li><li>the next hint appears after the bars.</li></ul> The easing stays the accepted Product Language token. The two bars share one height and keep separate labels and scales. Result text and actions render immediately, and nothing blocks input or focus. Under `prefers-reduced-motion: reduce` the final state shows at once.</li><li>Landing on an already completed topic, and any later entry to the screen in the same session (for example after `Xem lại`), shows the settled screen with no sequence.</li></ul> No confetti library is added. |
| AC9 | The learner gets a memory-question explanation only for a question whose stored answer is currently correct. <ul><li>Loader: `explanation` is returned for memory questions present in the loader's `answers` map (`app/actions/learning-workspace.ts:360-367`) and omitted for every other question, as today (`:394`). The client schema accepts an optional, nullable explanation for memory questions only.</li><li>Session: the workspace keeps the `explanation` that `submitQuestionAnswer` returns for a correct memory answer, keyed by question id. It merges this with the loader values, and drops the entry when a later answer to the same question is incorrect.</li></ul> Exercise questions and the Preview are unchanged. |
| AC10 | `npm run test:e2e` (Playwright `webServer` on port 3100) starts and passes the selected specs while a `next dev` from the same checkout is already running on port 3000. The e2e server builds into its own directory (`.next-e2e`), selected by an environment variable that `next.config.ts` reads. `npm run dev`, `npm run build` and CI keep `.next`. `.next-e2e/` is git-ignored, and `tsc --noEmit` behaves the same with either directory present. |
| AC11 | The program docs record the LF4 merge (PR 148, `95c4902`, CI run `38216918625` green, no hosted step) and the Owner QA fixes as milestones. State describes LF5. Decision 29 and the LF5 unit row exist in the master plan. `npm run docs:check` passes. |
| AC12 | No database object, migration, RPC or policy changes. The LF1, LF3 and LF4 rules and D4 completion keep their behaviour apart from the landing stage, the completion screen and the toast above: the flashcard-done rule, the cards-seen gate, the LF2 memory gate, sticky completion, FSRS scheduling, the unseen-first queue, the due offer and `cards_locked` recovery. The public Preview (`PublicCoursePreviewExperience.tsx`), which shares `FlashcardStage`, is unchanged. |

### 1.2 Scope and non-goals

- In scope:
  - a pure landing-stage function and its use as the workspace's initial stage;
  - the completion screen (new workspace view) with course and chapter progress, due-first primary action, next-topic action, `Xem lại` and the return action;
  - the read-only memory-check review that replaces the passed box;
  - the memory-check explanation for currently correct answers in the loader;
  - removing the topic-completion toast and the no-exercise `Hoàn thành memory check` button;
  - the e2e build directory;
  - LF4 closeout docs;
  - updating tests that assume the old initial stage, the box or the toast;
  - QA fix (Owner decision 2026-10-12, found in Owner QA, pre-existing): `submitCardReview` limits its `user_flashcards` embed to the caller (`.eq("user_flashcards.user_id", user.id)` plus an own-row check), because an active admin can read every learner's rows and every rating by an enrolled admin failed with `Lỗi đồng bộ tiến độ học!`. No SQL change: `lf2_submit_card_review` already writes only the `auth.uid()` row.
- Non-goals:
  - the dashboard Today Runway and the course overview (LE §2.3–2.4);
  - the footer `Bài trước` / `Bài sau` navigation, apart from rendering it subordinate while the completion screen shows (AC3);
  - any change to how completion, flashcard-done, memory-pass or exercise-done is computed;
  - an exercise retry or practice mode, and a memory-check practice mode;
  - a confetti dependency;
  - `PERF-ACTION-001`, the topic reorder lock order, `AUTH-022`/`AUTH-023`, `QUALITY-001`.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The landing stage and the completion screen use only server truth already in the workspace data: `progress`, `isMemoryCheckPassed`, `answers`, `unseenCardIds`, `dueCardIds` and `syllabus` completion. In-session transitions use only write results (`topicProgress`, the memory pass). No client-only completion. | The screen claims a completion the server has not recorded, or misses a sticky completion. |
| G2. A memory-check explanation is sent only for a question whose stored answer is currently correct (AC9). The rule lives in the loader next to the existing `answers` derivation. | A learner reads the answer before answering, which the D3 contract forbids. |
| G3. The completion-screen course and chapter values come from the same syllabus completion that the sidebar uses (`completedTopicIds`, `LearningWorkspace.tsx:294`), including the current topic's in-session completion. | The screen and the sidebar disagree after an in-session completion. |
| G4. The implementor's local integration and browser runs use the isolated runtime (API 45441, DB 45442). Root 45321/45322 and hosted are never reset or written. The implementor never copies the repository to run e2e. Before CP2 lands, browser runs wait for Main, who stops and restarts the Owner's dev server. After CP2 they run beside it. | A run resets or writes the Owner's database, or leaves a large untracked copy in the tree (LF4). |
| G5. Each CP runs only the tests it names. The broad run happens once in CP5. | Implementor time goes to unrelated suites. |

### 1.4 Owner decisions that bind this unit

- Decision 29 (master plan, 2026-10-12) opens LF5 as one PR from `main`. It bundles the e2e build directory and the LF4 closeout with the completion work, because the e2e change lets the Owner keep `next dev` running during LF5 QA.
- Q1 (2026-10-12): an unfinished topic opens its first unfinished stage in stage-thread order. When Từ vựng only has seen cards that are not yet `Ổn`/`Dễ`, it opens the finished screen with the `Ôn ngay` offer, not the review queue.
- Q2 (2026-10-12): a completed topic with due cards still opens the completion screen. `Ôn ngay N thẻ` is then the primary action, and the next topic is subordinate.
- Q3 (2026-10-12): the completion screen follows the accepted LE design:
  - topic confirmation, course progress with a progressbar, chapter progress;
  - the next topic, or the course overview on the last topic;
  - `Xem lại` with the topic's stages;
  - the composed sequence on a new completion only;
  - no topic-completion toast.
- Q4 (2026-10-12): keep `Mở bài tập` after the final correct memory-check answer when exercises exist. Remove only the no-exercise `Hoàn thành memory check` button and the passed box.
- Q5 (2026-10-12): `Xem lại Memory check` is a read-only list of questions with the correct answer and explanation.
- Q6 (2026-10-12, clarifying Q4 after plan review): when every exercise question is already answered correctly, the memory-check pass moves straight on as on a topic without exercises (to the completion screen when it newly completes the topic); `Mở bài tập` stays only while exercise questions remain.
- Q7 (2026-10-12, Owner manual QA): the completion progress animation was too fast to read. Each bar fill runs a fixed duration whatever the delta (about 1 s for the course bar, the chapter bar following), the gained segment is highlighted and then settles to the normal colour, and the whole sequence takes about 1.2–1.5 s. This is an Owner-accepted deviation from the 600–900 ms cap, for this screen only. Result text and actions stay immediate, nothing blocks input, reduced motion shows the final state at once, and a revisit or return shows the settled state.
- Q8 (2026-10-12, Owner manual QA): the primary next-topic action is one line labelled `Chủ đề tiếp theo` with slightly larger text, no chevron and no second line; the next topic is named in the `Tiếp theo: …` hint. The last topic stays `Về tổng quan khóa học`. The due-first branch is unchanged (`Ôn ngay N thẻ` primary, the next-topic action subordinate with the same label). The two progress bars share one height, and `Về màn hình hoàn thành` uses the same outline button weight as its neighbours (renamed `Đến màn hình hoàn thành` by Q13).
- Q9 (2026-10-12, Owner manual QA): the three `Xem lại …` buttons stay in this PR. A later PR (FEAT-009 in [future-features.md](../../future-features.md)) makes the stage thread clickable and replaces them with one `Xem lại`.
- Q10 (2026-10-12, Owner manual QA, due-first branch): the filled primary is two lines, a small `Có N thẻ đến hạn ôn` over a larger `Ôn ngay`; the accessible name keeps both (`Có N thẻ đến hạn ôn, Ôn ngay`) and it still starts the LF4 due queue. The no-due branch is unchanged (`Chủ đề tiếp theo` stays the single filled primary).
- Q11 (2026-10-12, Owner manual QA, due-first branch): beside the filled primary, `Chủ đề tiếp theo` (or `Về tổng quan khóa học` on the last topic) is a subordinate Route Blue text action (intrinsic width, underline on hover, visible focus) on input that satisfies `(hover: hover) and (pointer: fine)`, and keeps the visible outlined 44px button on touch-primary input, as [button.md](../../../../ui-design-system-and-review/components/button.md) requires. It is gated on input capability, not viewport width, through a `coarse-input` custom variant in `app/globals.css` that reuses the existing `(not (hover: hover)), (not (pointer: fine))` media query. The three `Xem lại …` buttons and `Về màn hình hoàn thành` are unchanged.
- Q12 (2026-10-12, Owner manual QA, due-first branch): layout follows input type together with the treatment through the same `coarse-input` variant. On a fine pointer the intrinsic-width filled primary and the text action sit on one horizontally centred row. On touch/coarse input they stack and the next-topic action keeps its visible outline background at 44px, because a subordinate action on a separate row must have a background and text-only is allowed only side by side. Inside the primary, the two lines start at the same x in a left-aligned block that the button centres; the small line is the smallest Product Language caption token (12/16, the system has no 11px), with slightly lower emphasis, and `Ôn ngay` stays large. The accessible name is unchanged.
- Q13 (2026-10-12, Owner manual QA, due-first branch): supersedes Q11 and the layout part of Q12. The completion actions stay stacked in every input mode, one action per row: the filled full-width primary `Ôn ngay`, and under it the full-width outline subordinate `Chủ đề tiếp theo` (`Về tổng quan khóa học` on the last topic). There is no fine-pointer text-only treatment and no side-by-side row, so the `coarse-input` variant and its test were removed. The two-line primary says `Có N thẻ đến hạn` over `Ôn ngay` (the word `ôn` once), the accessible name is `Có N thẻ đến hạn, Ôn ngay`, and Q12's text alignment (both lines at the same x in a block the button centres, 12px small line) stays. The return action `Về màn hình hoàn thành` is renamed `Đến màn hình hoàn thành`.

## 2. Repository facts

Baseline: `95c4902` (LF4 merge), checked 2026-10-12.

- **Initial stage.** `LearningWorkspace.tsx:183-190` picks it from data presence only: flashcards, then the memory check, then exercises. It ignores which stages are finished, so a finished topic opens on Từ vựng. This justifies AC1 and AC2.
- **Completion signals.**
  - `progress` carries `isFlashcardCompleted`, `isExerciseCompleted` and the sticky `isTopicCompleted` (`lib/schemas/learning-workspace.ts:34-45`).
  - `isTopicCompleted` turns on in the session through `announceTopicProgress` (`topic-progress-feedback.ts:16-26`). That function also fires `TOPIC_COMPLETED_MESSAGE` on `newlyCompleted`.
  - No completion view exists. Today the only completion cues are the toast, a header badge and the footer `Bài sau` primary (`LearningWorkspace.tsx:1013-1023`).
  - This justifies AC3 and AC4.
- **Syllabus.** The syllabus is filtered to published, non-removed topics (`app/actions/learning-workspace.ts:200-215`, `:449-450`) and carries `isCompleted` per topic. `completedTopicIds` merges in the current topic's session state (`LearningWorkspace.tsx:294-303`). `buildLearnCourseProgressProjection` (`lib/learn-dashboard.ts:97`) uses the same eligibility. This justifies AC3 and G3.
- **Passed memory-check box.**
  - `MemoryCheckStage.tsx:131-156` renders the box `Bạn đã trả lời đúng hết memory check` with `Chủ đề này không có bài tập.` or `Làm bài tập`.
  - The feedback button reads `Hoàn thành memory check` when the memory check passed and there are no exercises, and `Mở bài tập` when there are (`MemoryCheckStage.tsx:309-319`).
  - This justifies AC6 and AC7.
- **Memory-check explanations.**
  - The loader omits `explanation` from every question DTO, and the memory-check schema omits it (`app/actions/learning-workspace.ts:292`, `:394`, `lib/schemas/learning-workspace.ts:93-96`).
  - `answers` holds only questions whose stored answer is currently correct: exercise questions in `toQuestionDto` (`:281-289`) and memory questions through `correctlyAnsweredMemoryQuestionIds` (`:360-367`, `lib/memory-check.ts:147-159`). `isMemoryCheckPassed` requires every active memory question to be in that set, so it can turn false after a teacher edit while `isTopicCompleted` stays true.
  - In the session, `MemoryCheckStage` keeps the explanation from `submitQuestionAnswer` only in the transient feedback attempt, which `advance` clears (`MemoryCheckStage.tsx:201-214`). A review right after the pass therefore needs the workspace to keep it (AC9 session path).
  - This justifies AC9 and G2.
- **Preview.** `PublicCoursePreviewExperience.tsx:28` imports `FlashcardStage` but not the workspace or `MemoryCheckStage`. This justifies AC12.
- **E2E server.**
  - Playwright's `webServer` runs `npm run dev:app` (`next dev --webpack`) on port 3100 (`playwright.config.ts:27-31`).
  - `next.config.ts` sets no `distDir`, so both servers use `.next`.
  - Next 16 keeps one dev lock per build directory (`.next/dev/lock`). A second `next dev` from the same checkout fails with "Another next dev server is already running", as seen in LF4.
  - `tsconfig.json` includes `.next/types` and `.next/dev/types`. `next-env.d.ts` is git-ignored.
  - This justifies AC10.
- **LF4 docs.** At `95c4902`, `progress.md` State still describes LF4 before merge, and the last milestone cites `(this commit)` for `69be4a5`. This justifies AC11.

## 3. Bounded implementation hypotheses

- **Landing stage.** A pure function (for example `resolveLandingStage` next to the workspace, or in `lib/`) takes the counts and flags and returns `flashcard | memory | exercise | complete`. Unit tests cover every AC1 and AC2 branch. The workspace uses it for `initialStage`, and AC7 uses it for the move when no exercise question remains after a memory pass.
- **Completion view.** `LearningStage` (or a separate view state) gains `complete`. A new `TopicCompletionPanel` component renders AC3, receiving:
  - the topic, chapter and course values;
  - the due count;
  - the neighbour link;
  - the stage list;
  - `justCompleted`, to choose between the sequence and the settled screen.

  Motion uses CSS with the accepted durations and easing and a `motion-reduce` override. It may change inside the frontend skills.
- **Toasts.** `announceTopicProgress` stops firing the topic toast. The workspace switches to the completion view on `newlyCompleted`.
- **Memory review.** `MemoryCheckStage` gains the read-only review in place of the passed box.
- **Loader.** The loader attaches `explanation` to memory questions in `answers`. The memory-check schema allows it as optional and nullable.
- **E2E.**
  - `next.config.ts` sets `distDir: process.env.NEXT_DIST_DIR || ".next"`.
  - `playwright.config.ts` passes `NEXT_DIST_DIR=.next-e2e` through `webServer.env`.
  - `.gitignore` adds `/.next-e2e/`.
  - If `tsc` or the Next type generation misbehaves with a second directory, the implementor reports this before choosing another mechanism.
- **Tests to change or add:**
  - `__tests__/components/learning-workspace-presentation.test.tsx` (landing, completion view, `Xem lại`, the return action, no toast);
  - `__tests__/components/memory-check-stage.test.tsx` (review list, no box, no-exercise move, `Mở bài tập` kept);
  - `__tests__/components/topic-completion-ui.test.tsx` (toast removal, single memory toast);
  - `__tests__/actions/learning-workspace.test.ts` (explanation only for currently correct memory answers);
  - the landing-function unit test;
  - `e2e/smoke/learning-memory-cards-gate.smoke.spec.ts` and `e2e/smoke/learning-workspace.smoke.spec.ts` where they assume the old initial stage, box or toast;
  - one new smoke case for the completion screen.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Main prepares the LF5 plan, Decision 29, the unit row, LF4 closeout milestones and LF5 State with the plan. After Codex PASS, Owner approval and an explicit grant, Main commits them on `feat/lf5-topic-completion`. | `npm run docs:check`; reread the LF4 milestones against AC11 |
| CP2 | E2E build directory (AC10) | With the Owner's `next dev` on :3000 running (Main confirms it is up), `npm run test:e2e -- e2e/smoke/learning-workspace.smoke.spec.ts` passes. `git status` shows no `.next-e2e`, and `tsconfig.json` and `next-env.d.ts` have no diff after the e2e run and after a later `npm run dev` (Next 16 rewrites `next-env.d.ts` and may add `include` globs for the active `distDir`; if it does, the implementor reports the diff and the chosen remedy before going on). `tsc --noEmit` gives the same result with and without `.next-e2e` present. `npm run build` still writes `.next`. |
| CP3 | Loader explanation for currently correct memory answers and the schema (AC9 loader path, G2) | action tests: a correct stored answer gets the explanation; a wrong, missing or no-longer-correct answer does not; a passed-then-invalidated memory check returns explanations only for the questions still correct; exercise questions never do. `lf3-memory-check-cards-seen-gate` and the workspace read-boundary suites touched by the loader pass on 45441. |
| CP4 | Landing, completion screen, `Xem lại`, return action, memory review, session explanations, toast and button removal, motion, and the fixture addition (AC1–AC9 session path, AC12) | Unit tests for every landing branch (AC1, AC2), including no cards, no memory check, no exercises, a completed topic with an unseen card and a completed topic with `isFlashcardCompleted` false. Component tests that fail on the baseline. They cover: <ul><li>landing on each first unfinished stage and on the completion screen;</li><li>the completion screen with and without due cards and on the last topic, with exactly one primary action and the subordinate footer;</li><li>per-stage done state on a completed topic whose flashcard step is not done;</li><li>the course and chapter values after an in-session completion (G3);</li><li>`Xem lại` for each stage and the return action;</li><li>the memory review after a reload and right after a multi-question pass in the same session, with no reload and no write;</li><li>`Xem lại Memory check` on a no-longer-passed memory check opens the answerable stage, including the cards-locked case;</li><li>no topic toast and the LF4 memory-toast rule;</li><li>the AC4 switch timing for a completing flashcard rating, a completing exercise answer that is the last question in order (its `endAction` opens the screen and does not navigate) and a completing earlier missed question;</li><li>the AC7 branches: `Mở bài tập` kept while exercise questions remain; auto-move without exercises; auto-move to the completion screen with its sequence when every exercise question is already correct and the pass reports `newlyCompleted`;</li><li>a reduced-motion render with no sequence.</li></ul> Browser smoke at 375 and 1280 px on port 3100 against 45441, beside the Owner's dev server, using the fixture in §4.1: <ul><li>finish the full-flow topic and see the completion screen with the sequence in default motion;</li><li>the same under emulated `prefers-reduced-motion: reduce`, with the final state at once;</li><li>reload and land on the settled screen;</li><li>`Xem lại Memory check` shows the review, and returning to the completion screen does not replay the sequence;</li><li>finish the no-exercise memory topic through the pass and land on the completion screen with no extra button;</li><li>an unfinished topic lands on its first unfinished stage.</li></ul> The touched smoke specs are run too. |
| CP5 | Final verification and self-review | `npm run test:ci`; the integration suites touched in CP3; the touched smoke specs; `tsc --noEmit`; ESLint on changed files; `npm run docs:check`; `git diff --check`. No whole-directory integration run, because there is no database change. |

### 4.1 QA fixture readiness

- QA type: browser smoke on the isolated runtime and the Owner's manual QA on the root runtime.
- Canonical fixture source: `scripts/e2e/learning-workspace-matrix-fixture.mjs` (seeded and cleaned by the learning smoke specs), with the seeded student `student@gmail.com`.
- Existing covered states:
  - `d8-matrix-full-flow` has cards, a memory check and exercises, so it covers landing on each stage in turn, a new completion and the review;
  - `d8-matrix-memory-check` covers a memory check with exercises (Q4);
  - the `b2-qa-in-progress` seed includes a completed final topic (last-topic branch);
  - `addFullFlowCard` covers a completed topic that gains an unseen card.
- Missing states: a topic with cards and a memory check but no exercises (AC7 auto-move and the no-exercise completion), and a reproducible completed topic with a due card (Q2 due-first).
- Required fixture additions: one more matrix topic with cards and a memory check and no exercises, appended after the existing topics so their ids keep their values. The due-first state is reached in the spec by rating a card `Lại` after completion, with no new seed rows.
- Reset/setup command: `npm run test:e2e -- <spec>` (resets the isolated runtime 45441 and seeds the matrix in `beforeAll`).
- Fixture checkpoint: CP4, before its browser smoke.
- Browser QA may begin when: CP2 is in place, so that the e2e server runs beside the Owner's `next dev`, and the CP4 fixture addition seeds cleanly. The Owner's manual QA on root uses the Owner's own topics, and Main inserts or hides rows on the Owner's request only, as in LF4.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A learner who wants to redo a stage now lands on the completion screen | `Xem lại` lists every stage of the topic, and the return action brings them back (AC5) |
| The memory review leaks an answer | The explanation and the marked option exist only for currently correct answers (G2), and the AC9 tests cover the negative cases |
| The completion sequence feels slow or blocks | Results and actions render immediately, the sequence stays at about 1.3 s (Owner Q7), and reduced motion removes it (AC8) |
| Existing specs assume the flashcard initial stage, the passed box or the topic toast | Update them in CP4. Each changed assertion must reflect the new spec, not a weaker check |
| `.next-e2e` affects type checking or CI | AC10 verification compares `tsc` results, CI keeps `.next`, and the implementor stops and reports if Next misbehaves |

- Rollout runbook: merge after CI, then the production deploy. There is no migration or hosted step. The Owner runs a short production journey: open an unfinished topic, finish it, reload, review the memory check, go to the next topic.
- Stop when: the landing or completion state needs data the workspace does not already have, a change would touch a database object or a completion or gate rule, or the e2e build directory cannot work without changing CI. In any of these cases, report to the Owner.
- Rollback: revert the PR. No data or schema change.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
