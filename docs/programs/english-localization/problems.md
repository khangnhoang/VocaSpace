# Problems, risks and follow-ups — English localization

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ENLOC-001: Auth email language approach

- Status: Open (2026-11-21). The Owner's choice of approach and a local-trial grant open U6; the entry stays open until U6's evidence or an approved exception closes it.
- Problem: Supabase Auth sends one template per email type, and the hosted templates change independently of the app's English flag. Sending each user their own language requires storing the locale on the auth user, for example in `user_metadata`. Recovery sends only the email address, and legacy, admin-created and later-switched accounts may have no locale or a stale one. The simpler alternative is one bilingual email.
- Evidence: `supabase/config.toml` lines 247–253 set Vietnamese subjects. `supabase/templates/confirmation.html` and `recovery.html` hold Vietnamese bodies. Recovery is called with only the email at `app/actions/auth.ts` line 175 and `app/actions/user.ts` line 105.
- Direction: U6 presents the options. (a) A bilingual email, Vietnamese first. (b) A per-user language from auth metadata. Option (b) stores the locale on the user, which conflicts with the plan's section 7 exclusion and the `AGENTS.md` user-data rule, so it needs the Owner to revise that scope. It also needs a defined language for resend and recovery emails on accounts without metadata or with stale metadata.
- Exit condition: The Owner records the choice, and U6's local trial shows the subject, body and links with the flag off, on and off again. It also shows either that one flag change controls the emails, or, if that trial fails, an Owner-approved exception to decision 5 with the order, the check between the two changes and a separate rollback for each (plan section 5, step 5). U6's detail plan follows it.

### ENLOC-002: Privacy wording for the locale cookie

- Status: Open (2026-11-21). The Owner chose new wording on 2026-11-21 (U1 plan decision 6); it resolves when the U1 PR ships it.
- Problem: The approved `/privacy` text requires a same-PR update when code changes cookies. Its section 3 says cookies keep the session and remember interface state, with the sidebar as the example. It is unclear whether that covers a language-preference cookie.
- Evidence: `app/(client)/privacy/page.tsx` lines 9–10 and 86–89.
- Direction: The U1 PR that adds the cookie applies U1 plan decision 6 (the new example) and decision 10 (the shared legal date).
- Exit condition: The Owner records that the current wording suffices, or the approved wording ships with the cookie.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
