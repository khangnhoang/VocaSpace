# Problems, risks and follow-ups — English localization

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ENLOC-001: Auth email language approach

- Status: Open (2026-11-21). The Owner's choice of approach and a local-trial grant are needed to open U6, together with the other conditions in its plan row; the entry closes only on U6's evidence (exit condition below), which includes an approved exception when one flag change does not control the emails.
- Problem: Supabase Auth sends one template per email type, and the hosted templates change independently of the app's English flag. Sending each user their own language requires storing the locale on the auth user, for example in `user_metadata`. Recovery sends only the email address, and legacy, admin-created and later-switched accounts may have no locale or a stale one. The simpler alternative is one bilingual email.
- Evidence: `supabase/config.toml` lines 247–253 set Vietnamese subjects. `supabase/templates/confirmation.html` and `recovery.html` hold Vietnamese bodies. Recovery is called with only the email at `app/actions/auth.ts` line 175 and `app/actions/user.ts` line 105.
- Direction: U6 presents the options. (a) A bilingual email, Vietnamese first. (b) A per-user language from auth metadata. Option (b) stores the locale on the user, which conflicts with the plan's section 7 exclusion and the `AGENTS.md` user-data rule, so it needs the Owner to revise that scope. It also needs a defined language for resend and recovery emails on accounts without metadata or with stale metadata.
- Exit condition: The Owner records the choice, and U6's local trial shows the subject, body and links with the flag off, on and off again. It also shows either that one flag change controls the emails, or, if that trial fails, an Owner-approved exception to decision 5 with the order, the check between the two changes and a separate rollback for each (plan section 5, step 8). U6's detail plan follows it.

### ENLOC-003: Topic page render writes learner progress

- Status: Open (2026-11-24). Unrelated to U3; exists on base `25655281`; not fixed.
- Problem: `getLearningWorkspace` calls `syncTopicProgress` during the server render of a topic page, so a Link prefetch of a topic page can mark a content-less topic completed without the learner opening it.
- Evidence: U3 CP2 snapshot run on the isolated stack: after an unreset run, `b2-qa-not-started-foundation` showed topics `711`, `811` and `911` completed by prefetch from the overview on the candidate and on base (recorded in the U3 CP2 evidence in progress.md).
- Direction: Decide separately whether render may write progress or whether the sync moves to an explicit action; size and owner are decided later.
- Exit condition: A topic page render, including a prefetch, leaves `user_topic_progress` unchanged, or the Owner accepts the behavior.

### ENLOC-004: Workspace remounts on a language switch after rating cards

- Status: Open (2026-11-24). Owner decision 2026-11-24: not fixed in U3.
- Problem: with the flag on, a learner who rates cards in the session, answers a question and then switches Vietnamese or English sees `router.refresh()` read new progress. The page key `workspaceKey` includes `unseenCardIds`, `unratedCardIds` and `dueCardIds`, so it changes and `LearningWorkspace` remounts. The shown answer outcome and explanation disappear (the saved data is not lost).
- Evidence: the key in `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx`; U3 Codex implementation review round 1, finding 1.
- Why not fixed in U3: the simple fix (drop the three lists from the key) conflicts with the accepted LF3 AC6 and LF4 AC5 key tests, which G6 forbids changing; the alternative (carry the outcome across the remount) is a design change.
- Direction: keep the workspace identity across a refresh that only reflects the session's own ratings while keeping the remount for real card changes. The fix is part of step A (plan r5); the Owner decides only if it conflicts with the LF3 AC6 and LF4 AC5 behavior (exit condition).
- Exit condition: fixed before English is enabled for users (the step A gate, U8): after rating cards, answering a question and switching language, the answer outcome and explanation stay shown, while a real change to the card set still behaves as the accepted LF3 AC6 and LF4 AC5 tests require. If the fix cannot meet both, the Owner decides at that point (Owner decision 2026-11-24 chose the fix for step A).

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- ENLOC-002 — Resolved 2026-11-22: the Owner-chosen `/privacy` cookie wording (display language as an example of remembered interface state) shipped with the locale cookie in U1 (PR 193, `d2172fe8`).
