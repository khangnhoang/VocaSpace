# Problems, risks and follow-ups — English localization

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ENLOC-001: Auth email language approach

- Status: Open (2026-11-21). 2026-11-26: the Owner chose option (c) below, granted the local trial and set the release order in master plan decision 8 (hosted templates before the flag), so no decision 5 exception is planned; the entry closes only on U6's evidence (exit condition below).
- Problem: Supabase Auth sends one template per email type, and the hosted templates change independently of the app's English flag. Sending each user a stored language of their own (option b) requires storing the locale on the auth user, for example in `user_metadata`. Recovery sends only the email address, and legacy, admin-created and later-switched accounts may have no locale or a stale one. The simpler alternative is one bilingual email.
- Evidence: `supabase/config.toml` lines 247–253 set Vietnamese subjects. `supabase/templates/confirmation.html` and `recovery.html` hold Vietnamese bodies. Recovery is called with only the email at `app/actions/auth.ts` line 175 and `app/actions/user.ts` line 105.
- Direction: U6 presents the options. (a) A bilingual email, Vietnamese first. (b) A per-user language from auth metadata. Option (b) stores the locale on the user, which conflicts with the plan's section 7 exclusion and the `AGENTS.md` user-data rule, so it needs the Owner to revise that scope. It also needs a defined language for resend and recovery emails on accounts without metadata or with stale metadata. (c) Chosen 2026-11-26: the email follows the interface language active at the request; the app passes a fixed `redirect_to` marker only for English and the templates branch on `.RedirectTo`, so no locale may be persisted on the user (U6 verifies this in AC6) and the flag-off path sends no marker. A probe on the local stack on 2026-11-26 rendered subject and body in English for `recover` and signup `resend` with the marker, in Vietnamese without it, and, for `recover`, in Vietnamese for a `redirect_to` outside the allowlist; details in the [U6 detail plan](./implementation-plans/u6-auth-emails/plan.md) section 2.
- Exit condition: The Owner records the choice, and U6's local trial shows the subject, body and links with the flag off, on and off again. It also shows either that one flag change controls the emails, or, if that trial fails, an Owner-approved exception to decision 5 with the order, the check between the two changes and a separate rollback for each (plan section 5, step 8). U6's detail plan follows it.

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

- ENLOC-002 — Resolved 2026-11-22: the Owner-chosen `/privacy` cookie wording (display language as an example of remembered interface state) shipped with the locale cookie in U1 (PR 193, `d2172fe8`).
- ENLOC-004 — Resolved 2026-11-25: after rating cards, answering and switching language the workspace keeps the shown outcome and explanation, while a real card-set change still rebuilds as the unchanged LF3 AC6 and LF4 AC5 tests require ([fix plan](./implementation-plans/enloc-004-workspace-language-switch/plan.md) r1, PR 200, `fffaaded`). <a id="enloc-004-workspace-remounts-on-a-language-switch-after-rating-cards"></a>
