# Problems, risks and follow-ups — Infrastructure and reliability

Charter: [README.md](./README.md). Progress: [progress.md](./progress.md). Transferred evidence below remains historical at its stated date; no probes were rerun.

## Open

<a id="action-queue-001"></a>

### ACTION-QUEUE-001: the topic builder Settings tab can spin forever after quick tab switches

- Status: Accepted (2026-10-24, Owner: skip the spec on CI, replace it with new tests in the redesign; found the same day while fixing the smoke failures on `main` `8932c6a7`).
- Problem: in Next 16.2.6 `dispatchAction` (`next/dist/client/components/app-router-instance.js`) a navigate or restore drops the pending action but does not move `actionQueue.last`, so the next server action is chained to a dead node and never runs. `TopicBuilderTabs` writes tab changes with native `history.replaceState(null, …)` (D6, `4903edd2`), which dispatches a restore; when it lands while a tab's server action is pending, the Settings tab's `getTopicById` is never sent and its spinner stays. Reaches real users on the production build.
- Evidence: reproduced on a local production build without the dashboard: open a topic, switch quickly Từ vựng → Bài tập → Cài đặt; stuck in one run of two (intermittent). It is the cause of `issue-deep-links:26` failing on the production build (passed on CI run 40094283510). Upstream fixes it from 16.3.0 (`if (actionQueue.last === actionQueue.pending) actionQueue.last = newAction`); 16.2.12 still has the bug. A Node repro on the real `dispatchAction` loses the server action on 16.2.6 and runs it on 16.3.8 and 16.4.3. A browser repro that holds the exercise tab's second server action fails 3/3 on a 16.2.6 production build and passes 3/3 on 16.3.8; `issue-deep-links` passes 0/3 on 16.2.6 and 3/3 on 16.3.8. The 16.3.8 dev failure at `issue-deep-links:144` is a test race (the click lands before hydration after dev hard-loads `/structure?issue_unavailable=1`), not a regression. The same bug also fails `dashboard-return-freshness:26` at line 82 on the production build: after saving a flashcard, the "Quay lại tổng quan" link sends the overview RSC request but the navigation never commits (CI run 40103591726; 1 of 3 local repeats).
- Direction: `issue-deep-links` and `dashboard-return-freshness` are skipped on CI (`process.env.CI`) and still run locally; the topic builder redesign (TFEAT-004 in the [teacher-workflow future features](../teacher-workflow/future-features.md)) replaces it with new tests. The Next upgrade follows the dependency update policy (BFEAT-001).
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

## Resolved

One line each.
