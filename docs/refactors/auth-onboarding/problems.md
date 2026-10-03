# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

### AUTH-002: Google buttons do not mean OAuth is implemented

- Status: Open. Moved from the [student-user-flow-route](../student-user-flow-route/problems.md) program on 2026-10-02 with the same ID. Handled by A4.
- Problem: `/login` and `/register` show Google buttons with no handler.
- Direction: the Owner chose real Google OAuth (Decision 1). A1 hides the buttons; A4 shows them again with the working flow (Decision 8).
- Resolved when: A4 merges and Google sign-in works in production.

### AUTH-004: `createUserByAdmin` creates users with a known default password

- Status: Open (follow-up, outside the 4 PRs). (`AUTH-003` is already used by the student-user-flow-route program.)
- Problem: `app/actions/user.ts` creates users with a fixed password and `email_confirm: true`.
  - Anyone who knows the default password can sign in to the account.
  - Once Google is enabled, that account is auto-linked to the email owner's Google identity.
- Mitigation in this program: audit these users under gate G3 before every Google enable (plan §4, source §8.2 step 7).
- Later fix: random password plus an email invitation to set a password.

### AUTH-005: Retire the D7 combined source plan once no plan references it

- Status: Open (docs housekeeping).
- Problem: [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the reviewed source the per-PR plans are cut from. The master plan and the A1 plan cite its sections (spikes, guardrail rationale, attacker acceptance), and A2/A4 still need its G8 and Google content.
- Direction: keep it until the A4 detail plan is cut; then delete it or mark it historical, updating every reference in the same change.
- Resolved when: no program document links to it, or it is explicitly marked historical.

### AUTH-006: G8 limits after A1

- Status: Open (accepted A1 limits, source §8.3).
- Problem:
  - profile data entered by someone who pre-registered an email through the app stays on the victim's profile (the Owner fixes it via the dashboard);
  - while `d7_password_set` is unset, a mailbox owner can also set a password once through a magic link from the direct Auth API;
  - if `updateUser` succeeds but the service-role flag write fails, `setPasswordAfterConfirmation` only logs the error code and still redirects to `/` (the password is already changed, so an error screen would mislead). Until the flag is written, the same `otp` session can set the password again; only the mailbox owner holds that session. Covered by a unit test; a retry or alert is not worth widening A1.
- Resolved when: a later plan removes or explicitly accepts these limits.

### AUTH-007: The Auth API can change a password with any valid session

- Status: Open (follow-up after A2).
- Problem: any valid access token, including the original `otp` session, can change the password directly through `PUT /auth/v1/user`; concurrent set-password requests from one verified session are last-write-wins (A1 §2.5 replay-guard scope).
- Candidate fix: turn on "Secure password change" after A2, evaluated in its own plan.

### AUTH-008: Email enumeration protection is app-level only

- Status: Open (accepted).
- Problem: G5 neutral results cover the app's actions and screens, not the direct Supabase Auth API.

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: `signUpUser` uploads the avatar before the user is created, so a sign-up that never completes leaves the file in the `avatars` bucket.

### AUTH-010: `issue-deep-links` smoke E2E is flaky

- Status: Open (found during A1 CP4, not caused by A1).
- Evidence 2026-10-03: after the Topic Builder settings tab click the URL still keeps `from=dashboard`. On the pre-A1 commit `9bfd0c6` it failed 1 of 3 runs; on A1 it passed 1 of 5 runs. A1 does not touch the Topic Builder tabs.
- Direction: a separate fix of the tab URL update in `TopicBuilderTabs.tsx` or of the spec's wait; track together with E2E-001.

### AUTH-011: `next dev` blocks dev resources for `127.0.0.1`

- Status: Resolved 2026-10-03 — the Owner approved adding `allowedDevOrigins: ["127.0.0.1"]` to `next.config.ts` as its own commit on the A1 branch.
- Problem: `npm run dev` logs "Blocked cross-origin request to Next.js dev resource" for host `127.0.0.1`, and pages opened on `http://127.0.0.1:3000` did not respond to clicks during A1 QA. Auth links use `site_url = http://127.0.0.1:3000`, so local browser QA of the mail flow ran on `next build` + `next start` instead.
- Current workaround: run auth browser QA on `next build` + `next start -H 127.0.0.1` (used for A1).
- `allowedDevOrigins: ["127.0.0.1"]` was not adopted at first because vercel/next.js#98604 (2026-09-13) reports that this option alone causes a hydration mismatch on almost every full reload of `next dev` (16.2.6, this repo's version) and can swallow a first form click. A maintainer could not reproduce it on macOS and closed it as not actionable.
- Local A/B check 2026-10-03 (Windows, Next 16.2.6 webpack dev, Playwright script, a fresh browser context per load with no extensions, 20 loads per page; the first click is "Sign in" on an empty `/login` form right after `load`, counted OK when the validation message appears):

  | `allowedDevOrigins` | Host | `/login` hydration errors | `/register` hydration errors | `/login` first click handled |
  |---|---|---|---|---|
  | no | `localhost` | 0/20 | 0/20 | 20/20 |
  | no | `127.0.0.1` | 0/20 (HMR WebSocket rejected on every load) | 0/20 (same) | 0/20 |
  | yes | `localhost` | 0/20 | 0/20 | 20/20 |
  | yes | `127.0.0.1` | 0/20 | 0/20 | 20/20 |

  An extra headed run in installed Chrome on `127.0.0.1` with the option gave 0/10 hydration errors on both pages and 10/10 first clicks. The #98604 mismatch did not reproduce here.
- Fix: `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`, so auth QA can use `next dev` on the `site_url` host. If a hydration mismatch like #98604 appears later, re-run the A/B check above in a clean profile before reverting.

### AUTH-012: Auth screens have no accepted design yet

- Status: Deferred 2026-10-03 by the Owner to a separate login/register UI/UX redesign PR.
- Problem: A1's new check-email and set-password cards use a neutral white header, while `/login` and `/register` keep the older Blue 400 header. The login form is also small and visually dated. There is no accepted screen-type design for public/auth screens (the "Client/Marketing" type named in `docs/ui-design-system-and-review/plan.md`), so neither header can claim to be the target.
- A1 kept only cheap, behavior-level fixes: login floating labels now pass clicks to their inputs (`pointer-events-none`, matching `/register`).
- Direction: design Client/Marketing (homepage, login, register, check-email, set-password) first, then align all auth cards in one redesign PR.
