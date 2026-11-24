# Problems, risks and follow-ups — Infrastructure and reliability

Charter: [README.md](./README.md). Progress: [progress.md](./progress.md). Transferred evidence below remains historical at its stated date; no probes were rerun.

## Open

<a id="action-queue-001"></a>

### ACTION-QUEUE-001: the topic builder Settings tab can spin forever after quick tab switches

- Status: Accepted (2026-10-24, Owner: skip the spec on CI, replace it with new tests in the redesign; found the same day while fixing the smoke failures on `main` `8932c6a7`).
- Problem: in Next 16.2.6 `dispatchAction` (`next/dist/client/components/app-router-instance.js`) a navigate or restore drops the pending action but does not move `actionQueue.last`, so the next server action is chained to a dead node and never runs. `TopicBuilderTabs` writes tab changes with native `history.replaceState(null, …)` (D6, `4903edd2`), which dispatches a restore; when it lands while a tab's server action is pending, the Settings tab's `getTopicById` is never sent and its spinner stays. Reaches real users on the production build.
- Evidence: reproduced on a local production build without the dashboard: open a topic, switch quickly Từ vựng → Bài tập → Cài đặt; stuck in one run of two (intermittent). It is the cause of `issue-deep-links:26` failing on the production build (passed on CI run 40094283510). Upstream fixes it from 16.3.0 (`if (actionQueue.last === actionQueue.pending) actionQueue.last = newAction`); 16.2.12 still has the bug. A Node repro on the real `dispatchAction` loses the server action on 16.2.6 and runs it on 16.3.8 and 16.4.3. A browser repro that holds the exercise tab's second server action fails 3/3 on a 16.2.6 production build and passes 3/3 on 16.3.8; `issue-deep-links` passes 0/3 on 16.2.6 and 3/3 on 16.3.8. The 16.3.8 dev failure at `issue-deep-links:144` is a test race (the click lands before hydration after dev hard-loads `/structure?issue_unavailable=1`), not a regression. The same bug also fails `dashboard-return-freshness:26` at line 82 on the production build: after saving a flashcard, the "Quay lại tổng quan" link sends the overview RSC request but the navigation never commits (CI run 40103591726; 1 of 3 local repeats).
- Direction: `issue-deep-links` and `dashboard-return-freshness` are skipped on CI (`process.env.CI`) and still run locally; the topic builder redesign (TFEAT-004 in the [teacher-workflow future features](../teacher-workflow/future-features.md)) replaces it with new tests. The Next upgrade follows the dependency update policy (BFEAT-001). TFEAT4 on `feat/topic-builder-redesign` updates `next` to 16.3.8 (Owner 2026-10-28) and runs every router operation of the topic builder (`?tab=` writes, refreshes after a save, in-page link navigation) one at a time, each only after the previous one has committed and no server action is pending: on 16.3.8 a pending refresh still overrides a later navigation or URL write, and a refresh sent right after a restore makes Next reload the whole page. It removes both CI skips and adds the `topic-builder-tabs` smoke; this entry resolves when that PR passes CI and merges.
- Exit condition: the redesign ships with its own tests, or Next is upgraded to 16.3.0 or later.
- Origin: student-user-flow-route:ACTION-QUEUE-001; [original delivery contract](../student-user-flow-route/plan.md).

<a id="e2e-dev-001"></a>

### E2E-DEV-001: `dashboard-return-freshness` fails under `next dev` only

- Status: Accepted (2026-10-24, Owner: record, do not fix; it passes on the production build used by CI).
- Problem: under `next dev` an HMR refresh rebuilds the request from the router's `renderedSearch`, which the restore reducer took from the old history entry (still `?from=dashboard…`) after `TopicBuilderTabs`' native `replaceState`; the page hard-navigates back to the old deep link and the spec fails at line 26.
- Evidence: local dev smoke runs on 2026-10-24 fail at `dashboard-return-freshness:26`; the same spec passes on a local production build and on CI run 40094283510. Next 16.4.3's restore reducer is unchanged here.
- Direction: none in the app for now; a full local dev smoke run lists this as a known failure.
- Exit condition: the spec passes under `next dev`, for example after a Next upgrade, or the smoke suite runs only against the production build.
- Origin: student-user-flow-route:E2E-DEV-001; [original delivery contract](../student-user-flow-route/plan.md).

### TEST-FLAKE-001: the portfolio delete test can fail under a full parallel unit run

- Status: Accepted (2026-11-01, recorded during TFEAT4; not investigated).
- Problem: `keeps delete confirmation on error and refreshes after a co…` in `__tests__/components/teacher-course-portfolio.test.tsx` fails intermittently in a local `npm run test:run`.
- Evidence: failed once on 2026-11-01 in a full run; the file then passed 3/3 alone and the next full run passed 2148/2148. CI uses `test:ci` (`--no-file-parallelism`). The cause is not established.
- Direction: find the timing dependency if it recurs, or if it appears on CI.
- Exit condition: the test passes reliably under a full parallel run.

### E2E-LOCAL-001: `topic-builder-sheet-layout:58` times out in local multi-spec smoke runs

- Status: Fixed locally, awaiting delivery (2026-11-22, INFRA-U2 CP1). Cause from code evidence, not reproduced on the base: the portfolio list goes dense at 5 or more collaborating courses and drops the per-card trash button, and earlier smoke files had given the shared `teacher@gmail.com` that many courses. The portfolio specs now use their own teacher with one course per worker; three full local smoke runs with two workers and one with one worker passed this spec.
- Problem: `opening a dialog on the course portfolio does not shift the page` waits 60 s for the button "Đưa vào thùng rác" and fails with a test timeout.
- Evidence: a local `npm run test:e2e:smoke` on 2026-11-22 ended 85 passed and 1 failed here (a hydration-mismatch warning appeared in the log); the same spec alone then passed 2 of 2. A local run of the second CI shard's file list failed here again (37 passed, 1 failed). All four CI shard runs of `9b343dcd` (PR 194) passed it. The first failure's trace and screenshot were kept outside the repo; the cause is not established.
- Direction: reproduce with the preceding spec files of the failing local runs, then look at the portfolio fixture and the hydration warning.
- Exit condition: a local full smoke run passes this spec.

### E2E-DEV-002: `d2/public-course-preview:39` once missed its 5 s URL assertion in a full local run under `next dev`

- Status: Open (2026-11-23, found at the English localization U2 Final; not related to localization by the evidence below).
- Problem: in the spec "guest and enrolled Preview recovers automatically after denominator growth", `expect(page).toHaveURL(…/preview/…)` at line 53 times out after 5 s: the click on the preview link at 320 px was received, but the URL was still the course page when the assertion gave up.
- Evidence: a full local `npm run test:e2e` (default `next dev` server) on `9e33fe89` ended 96 passed, 1 failed. The trace shows the click hit the link and the client navigation started. The preview route's RSC request took 4738 ms, the course page document took 4194 ms and Fast Refresh logged rebuilds ("done in 2443 ms"). The screenshot taken at failure shows the preview page fully rendered with the dev "Rendering…" indicator. The browser console has 6 messages (React DevTools, HMR, Fast Refresh) and no error or hydration warning. The spec then passed 3 of 3 on each of two solo `next dev` reruns. On a production build (`E2E_WEB_SERVER=start`, `--repeat-each=10`, 3 tests per repeat) it passed 30 of 30 on the U2 candidate and 30 of 30 on the base `20fadd25` (built with placeholder PayOS values, since that worktree has no `.env.local`); the target test took about 11 s each time. No `next dev` repeats were run on the base, so a dev-mode difference between base and candidate is not excluded. The first failure's trace and screenshot are kept outside the repo, in the Claude session scratchpad folder `e2e-fail1` (`C:\Users\khang\AppData\Local\Temp\claude\473f8a4a78caa7db\e1fa7da2-232a-4f46-b641-7b197150080f\scratchpad\e2e-fail1`).
- Direction: the most likely cause is a cold on-demand compile of the preview route under a 16-minute run, which exceeds the default 5 s expectation; unconfirmed. If it recurs, repeat the spec under `next dev` on the base and on the candidate before changing anything.
- Exit condition: the spec passes in repeated full local `next dev` runs, or its dev-mode runs are replaced by the production build.

### E2E-DEV-003: five learn smoke tests missed 5 s expectations in one local `next dev` run

- Status: Open (2026-11-23, found while rechecking the English localization U2 corrections `41b796a2`, `e0fc98f2` and `6e74e5b5`; cause unconfirmed, and a relation to the localization change is not excluded because the base was never run under `next dev`).
- Problem: running the eight learn-related smoke specs (`enrolled-course-overview`, `learning-fast-rating`, `learning-memory-cards-gate`, `learning-topic-completion`, `learning-workspace-matrix`, `learning-workspace`, `review-session-recovery`, `review-session`) under the default `next dev` server ended 32 passed, 5 failed, 6 did not run (43 tests, 14.3 min). Four failures are `expect(page).toHaveURL(/\/$/)` after login, which stayed on `/login` for 5 s (`learning-fast-rating:75`, `learning-topic-completion:617` at 1280px, `learning-workspace-matrix:170` and `:285`). The fifth is `learning-memory-cards-gate:274`, whose message "Bài học vừa có thêm 1 thẻ mới…" was not visible within 5 s.
- Evidence: the same eight specs on a production build (`E2E_WEB_SERVER=start`, candidate `6e74e5b5`, flag off, isolated stack) passed 43 of 43 in 8.8 min. The failure snapshot of a login case shows the Vietnamese login page and no error text. The same class of dev-server timing as E2E-DEV-002 is a possible but unconfirmed explanation; the base `20fadd25` was not run under `next dev`, so the failures are not shown to be unrelated to the candidate, and a dev-mode difference between base and candidate is not excluded. The run output is kept outside the repo in the Claude session scratchpad (`r4-e2e.txt`, under `C:\Users\khang\AppData\Local\Temp\claude\473f8a4a78caa7db\e1fa7da2-232a-4f46-b641-7b197150080f\scratchpad`).
- Direction: run the same eight specs under `next dev` on the base `20fadd25` and on the candidate before classifying the cause (a failure on both points to the dev server, one on the candidate alone points to the change); consider replacing the dev-mode runs with the production build, as E2E-DEV-002 proposes.
- Exit condition: the eight specs pass in repeated local `next dev` runs, or dev-mode runs are replaced by the production build.

### E2E-BASE-001: five smoke specs fail on a production build of main `60da8312`

- Status: Open (2026-11-24, found at the English localization U9 Final). Unrelated to U9: the same failures occur on the base; not fixed.
- Problem: in a full local `npm run test:e2e` (default `next dev` server) on the U9 candidate `c5debe12`, 92 passed and 5 failed: `account-menu` (first test), `auth-return-path:36` (60 s timeout), `issue-deep-links:27`, `enrolled-course-overview:21` and `review-session-recovery:20`, all expectation timeouts.
- Evidence: the same five spec files on a production build (`E2E_WEB_SERVER=start`, after a database reset of the isolated stack) gave 6 failures on the candidate (`account-menu` twice, `issue-deep-links`, `enrolled-course-overview`, `review-session-recovery` twice; `auth-return-path` passed) and the identical 6 failures on a production build of base `60da8312`. So, unlike E2E-DEV-002 and E2E-DEV-003, these do not pass on a production build. The first `next dev` log is kept in the U9 implementor session scratchpad; the full suite was not run on a production build.
- Direction: rerun the five specs on a production build of current main with traces, and check whether they share a cause (fixture data, session or timing) before changing specs or infrastructure.
- Exit condition: the five specs pass on a production build of main in repeated runs, or each failure has a recorded cause and fix.

### TEST-FIXTURE-001: `memory-check-learner-gate.test.ts` leaves `user_flashcards` rows on the main local stack

- Status: Open (2026-11-24, found at English localization U3 Owner QA round 1). Unrelated to localization; not fixed.
- Problem: the integration test `__tests__/integration/memory-check-learner-gate.test.ts` left 20 `user_flashcards` rows for `student@gmail.com` on `d3-gate-*` courses where the student is not enrolled, on the main stack (API 45321). They inflate the `/learn` due-card count (see [LEARN-DUE-001](../student-user-flow-route/problems.md#learn-due-001-the-learn-due-card-count-includes-cards-the-learner-can-no-longer-read)).
- Evidence: Owner QA on the flag-on dev server showed 20 cards due that the review sheet could not present; Main deleted the rows locally with Owner approval for QA.
- Direction: make the test clean up the learner rows it creates (or use its own learner), and check the other integration tests that write `user_flashcards` for the seed student.
- Exit condition: a full integration run on the main stack leaves no `user_flashcards` row for the seed student that the run did not find there.

## Resolved

One line each.
