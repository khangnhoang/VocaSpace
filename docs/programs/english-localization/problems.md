# Problems, risks and follow-ups — English localization

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ENLOC-003: Topic page render writes learner progress

- Status: Open (2026-11-24). Unrelated to U3; exists on base `25655281`; not fixed.
- Problem: `getLearningWorkspace` calls `syncTopicProgress` during the server render of a topic page, so a Link prefetch of a topic page can mark a content-less topic completed without the learner opening it.
- Evidence: U3 CP2 snapshot run on the isolated stack: after an unreset run, `b2-qa-not-started-foundation` showed topics `711`, `811` and `911` completed by prefetch from the overview on the candidate and on base (recorded in the U3 CP2 evidence in progress.md).
- Direction: Decide separately whether render may write progress or whether the sync moves to an explicit action; size and owner are decided later.
- Exit condition: A topic page render, including a prefetch, leaves `user_topic_progress` unchanged, or the Owner accepts the behavior.

### ENLOC-005: Admin sidebar toggle label is hard-coded English

- Status: Open (2026-11-26). Unrelated to U8 step A; exists on base `a1b0163b` since `d4ee57d9`; not fixed.
- Problem: the shadcn sidebar toggle renders "Toggle Sidebar" (screen-reader text, `aria-label` and `title`) in English on the Vietnamese admin interface, and it is not in any catalog.
- Evidence: `components/ui/sidebar.tsx` lines 274, 286 and 289; U8 CP3 Preview fetch of `/admin` as admin with the `en` cookie returned `lang="vi"` with this string among the Vietnamese labels.
- Direction: translate it with the admin area in step B (U10), or earlier if the Owner wants the Vietnamese admin fixed; size and owner are decided later.
- Exit condition: the toggle label follows the admin interface language in both locales.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- ENLOC-001 — Resolved 2026-11-26: auth emails follow the interface language through the fixed `redirect_to` marker (option c, U6 PR 203); the hosted templates were installed before the English flag and the release confirmed Vietnamese emails with the flag off and both languages with it on (U8 runbook steps 3 and 5, PR 204, `ea26c35d`). <a id="enloc-001-auth-email-language-approach"></a>
- ENLOC-002 — Resolved 2026-11-22: the Owner-chosen `/privacy` cookie wording (display language as an example of remembered interface state) shipped with the locale cookie in U1 (PR 193, `d2172fe8`).
- ENLOC-004 — Resolved 2026-11-25: after rating cards, answering and switching language the workspace keeps the shown outcome and explanation, while a real card-set change still rebuilds as the unchanged LF3 AC6 and LF4 AC5 tests require ([fix plan](./implementation-plans/enloc-004-workspace-language-switch/plan.md) r1, PR 200, `fffaaded`). <a id="enloc-004-workspace-remounts-on-a-language-switch-after-rating-cards"></a>
