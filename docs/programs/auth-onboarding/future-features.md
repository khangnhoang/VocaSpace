# Future features — Auth onboarding program

Owner direction outside the current scope of the program. Problems and risks live in [problems.md](./problems.md); the program plan is [plan.md](./plan.md).

## FEAT-001: "Password changed" notification email

- Status: Deferred (A2b default 4, Owner-approved 2026-10-05).
- Outcome: after any password change (`/profile`, set-password or the direct Auth API) the account email receives a notice, so a user whose session was misused learns about it.
- Why deferred: A2b closes AUTH-007 with the hosted password-change protections and accepted residuals; a notice is extra hardening, not needed for that exit.
- Pointers: [A2b plan](./implementation-plans/a2b/plan.md) §1.4 default 4; AUTH-007 (resolved 2026-10-05) in [progress.md](./progress.md).

## FEAT-002: Global discount codes

- Status: Deferred (Owner direction, 2026-10-05, while deciding the A4b removed-course clause).
- Outcome: a discount code is not tied to one course (`discounts.course_id` is `NOT NULL` today), so support can give a learner one code usable on any course, for example after a bought course is removed.
- Why deferred: the A4b terms only promise support "such as a discount code for another course", which per-course codes can already do; the redesign is a product change outside this program.
- Pointers: [A4b plan](./implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.

## FEAT-003: Removing a course that learners have bought

- Status: Deferred (product question raised 2026-10-05 while writing the A4b terms).
- Outcome: decide whether a teacher may remove a course that has paying learners, and if so whether those learners keep access. Today `deleteCourse` sets `removed_at` and `can_view_course_basic` then hides the course from learners (A4b terms option A describes this behavior).
- Why deferred: the Owner chose to describe current behavior in the terms (option A) instead of changing code in A4b.
- Pointers: [A4b plan](./implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.

## FEAT-004: Move production to `vocaspace.com`

- Status: Completed (2026-10-07; rollout recorded in `c03ebb6` and [progress.md](./progress.md)). This reconciliation uses existing evidence; it is not a fresh production check. The steps below preserve the historical rollout procedure.
- Outcome: production is served at `https://vocaspace.com` (Vercel still hosts it), `www.vocaspace.com` and `vocaspace.vercel.app` redirect to it, and Auth, Google, PayOS and email links all use the new domain.
- Why: the Google consent screen and the home page should show a domain the Owner owns; the Owner owns `vocaspace.com` on Cloudflare (already used for `support@` and `auth.` mail). The app code needs no change: Google sign-in uses `window.location.origin`; the payment flow reads `NEXT_PUBLIC_APP_URL`.
- Owner decisions (2026-10-06): primary domain is the apex `vocaspace.com` (not `www`); PayOS is live and takes real payments; keep the old domain working until the end.

Rules for the agent running this:

- The Owner signs in to every dashboard. Never type or store a secret, key or token. Record only URLs and booleans; no user emails.
- Each hosted change (Vercel domain or environment variable, Cloudflare DNS, Supabase, Google Cloud, PayOS) needs the Owner's grant at the moment of the change. PayOS changes are the most dangerous: read first, stop, and ask before any edit.
- Check the result of each step before the next one. If a step fails, stop and report the exact state; do not skip ahead.
- Cloudflare DNS records for Vercel are DNS-only (grey cloud). Do not touch the MX records or `auth.` records used for mail.

Steps (in this order):

1. Vercel, project Settings, Domains: add `vocaspace.com`; add `www.vocaspace.com` redirecting to it.
2. Cloudflare DNS: add the records Vercel shows, DNS-only. Wait until Vercel marks the domains valid with HTTPS.
3. Check in a private window that `https://vocaspace.com/`, `/privacy` and `/terms` load signed out.
4. PayOS, read only: record the webhook, return and cancel URLs currently configured. Read `app/api/webhook/payos/route.ts` and `app/actions/payment.ts` and confirm that the webhook signature check and the return and cancel URLs do not depend on the domain except through `NEXT_PUBLIC_APP_URL`.
5. Vercel Production environment variable `NEXT_PUBLIC_APP_URL` to `https://vocaspace.com`, then redeploy. Do it when few payments are open: orders started before the change keep the old return URL.
6. PayOS: set the webhook to `https://vocaspace.com/api/webhook/payos` and confirm it is received (PayOS test call, or the first real payment shows the course opened). Do not enable any redirect before this step passes.
7. Supabase Authentication, URL Configuration: Site URL `https://vocaspace.com`; add `https://vocaspace.com/**` to Redirect URLs and keep `https://vocaspace.vercel.app/**` for now.
8. Google Cloud, Branding: home page `https://vocaspace.com`, privacy `https://vocaspace.com/privacy`, terms `https://vocaspace.com/terms`; add `vocaspace.com` to Authorized domains and keep the old one for now. The OAuth client redirect URI stays the Supabase callback.
9. Google Search Console: verify `vocaspace.com` (DNS TXT record in Cloudflare). Whether to apply for brand verification is a later Owner decision.
10. Before any re-enable of Google, repeat the R4 id-set diff from [progress.md](./progress.md) and review new ids.
11. Check on `https://vocaspace.com`: email sign-in, Google sign-in for an existing and a new account, forgot-password (the link in the email opens the new domain), sign-out, a signed-out course page. Record booleans only.
12. Only after steps 6 and 11 pass: Vercel redirects `vocaspace.vercel.app` to `vocaspace.com` with a 301, and the redirect must exclude `/api/*` so a late webhook to the old domain is not lost.
13. After the redirect has worked for a while with no payment problem: remove `https://vocaspace.vercel.app/**` from Supabase Redirect URLs and the old domain from Google Authorized domains.
14. If PayOS or Auth breaks at any step, roll back that step (the old domain still works until step 12) and report.
15. A user-visible policy change is needed only if a Cloudflare proxy (orange cloud) is turned on for the site: then add Cloudflare to the `/privacy` third-party list, with the Owner approving the wording (keep-in-sync rule, A4b G1/G2).
16. Repo docs: change the "Open VocaSpace" link in `README.md`, and record the hosted state and the dated milestones in [progress.md](./progress.md); the A1, A4 and A4b plans and the D7 source stay as the approved history. `npm run docs:check` must stay clean. Commit locally and ask the Owner before any push.

Pointers: [A4 plan](./implementation-plans/a4/plan.md) rollout R1–R7 (hosted settings), [A4b plan](./implementation-plans/a4b/plan.md) §5 rollout, AUTH-004 and gate G7 in [problems.md](./problems.md).

## FEAT-005: Redesign the auth email templates

- Status: Deferred (Owner, 2026-10-07), a separate PR after A5.
- Outcome: the confirmation, recovery and other Supabase Auth emails get a modern VocaSpace design and wording, including a "set your password" wording for accounts an admin creates.
- Why deferred: A5 reuses the existing recovery email for admin-created accounts (A5 plan §1.4 decision 5); the visual redesign is its own change.
- Pointers: [A5 plan](./implementation-plans/a5/plan.md) §1.4 decision 5.
