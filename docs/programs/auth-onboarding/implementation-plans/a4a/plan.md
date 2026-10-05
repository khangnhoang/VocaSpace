# A4a detail plan — Private profile fields (AUTH-019)

Revision: r2, 2026-10-05 (Owner approved decisions 1–4 in §1.4 on 2026-10-05; Codex plan review r1 FAIL, 4 Required — missed admin-dashboard reader, soft-deleted rows under service-role reads, per-column denial checks, rollback re-exposure — fixed in r2; r2 PASS, 0 Critical/0 Required, its Optional on HEAD error codes applied; Owner-approved 2026-10-05, frozen). Master plan: [plan.md](../../plan.md) (Decision 13, §5 A4a, §7 gates). Problem: [AUTH-019](../../problems.md).

Branch `fix/auth-profile-privacy` from `main` `cbd87e9`, carrying the A4b planning commit (cherry-picked as `51bb3ff`, so AUTH-019 and Decision 12 exist on this branch; A4b drops it as already applied when it rebases). Size: medium, security-sensitive — one migration that narrows `SELECT` on `profiles`, seven app call sites, integration and action tests, then an Owner-granted `db push` after the app deploy.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: nobody can read another user's email, phone, date of birth or gender from `profiles` through the public API, signed out or signed in, while every page that shows profile data keeps working: a user still sees their own full profile, admins still see the user list with emails and phones, and a course team still sees its members' emails (decision 1). This makes the A4b privacy copy true and unblocks A4b (Decision 12).

| ID | Observable result |
| --- | --- |
| AC1 | With the anon key and no session, for each of `email`, `phone`, `dob`, `gender`: selecting it (and `*`) is refused with a permission error, and so is filtering on it (`select=id&<col>=not.is.null`, the 2026-10-05 exposure path) — a refusal, not an empty result; `select=id,username,full_name,avatar_url` still returns active rows |
| AC2 | Signed in as a non-admin, selecting or filtering on each of `email`, `phone`, `dob`, `gender` (and selecting `*`) from `profiles` is refused for every row, including the caller's own; the public columns (decision 2) still return |
| AC3 | `/profile` still loads and shows the signed-in user's own email, phone, dob and gender, and saving the form and the one-time username (A3) still work |
| AC4 | The header still shows the signed-in user's avatar, name and role-based menu items |
| AC5 | The admin user list (`getAllUsers`) still shows every active user's email and phone, and the admin dashboard (`getAdminDashboardData`) still shows the recent enrollments with the learner's email; a non-admin calling either is still refused |
| AC6 | Course team views keep members' emails (decision 1): the collaborator management dialog and member list (`getCourseCollaboratorOverview`, `getCourseCollaboratorMembers`) for an allowed actor, and review notes author/remover identities (`review-notes.ts`) for a reader that RLS allows; a caller that fails the existing actor check still gets the existing error and no emails |
| AC6b | Soft-deleted profiles (`removed_at` set) stay hidden exactly as today: absent from the user list, absent from collaborator lists (the `!inner` join drops them), shown as a missing author/remover on review notes and as a missing learner on dashboard enrollments, with no email fetched for them |
| AC7 | Every SQL function that reads `p.email` (collaborator invitations, `get_topic_workflow_state`, review/lifecycle RPCs) is `security definer` and keeps working unchanged; storage and table policies that read `profiles.id`/`role`/`removed_at` keep evaluating for anon and authenticated callers |
| AC8 | (Production, after rollout.) `has_column_privilege` is false for `anon` and `authenticated` on each of `email`, `phone`, `dob`, `gender` and true on each public column; a signed-out HEAD count-only read with each private-column filter (as on 2026-10-05) returns a permission error, not a count; `/profile`, the header, the admin list and dashboard, and the public course pages work |

### 1.2 Scope and non-goals

- In scope:
  - a new migration: `revoke select on table public.profiles from public, anon, authenticated;` then `grant select (<public columns>) on table public.profiles to anon, authenticated;` (the D2 `topics` pattern, migration `20260924110000`);
  - `app/actions/profile.ts` `getUserProfile`: read the caller's own private fields with the service-role client, scoped to `user.id` after `auth.getUser()` and filtered `removed_at is null` (a soft-deleted caller keeps today's error);
  - `components/ui/header.tsx`: select the public columns it uses instead of `*`;
  - `app/actions/user.ts` `getAllUsers`: read with the service-role client after `requireAdmin()`, filtered `removed_at is null`;
  - `app/actions/admin-dashboard.ts` `getAdminDashboardData`: keep the recent-enrollments read on the user client without `email` in the `profiles:user_id` embed, then, after its admin check, fetch emails with the service-role client for exactly the returned non-null learner ids, filtered `removed_at is null`;
  - `app/actions/course-collaborator.ts` overview and members: after the existing actor check, read member profiles (with email) with the service-role client, scoped to that `course_id` and keeping the inner-join filter `profiles.removed_at is null`;
  - `app/actions/review-notes.ts`: keep the RLS-filtered note read on the user client without `email` in the embeds, then fetch emails with the service-role client for exactly the returned non-null author/remover ids, filtered `removed_at is null`;
  - integration tests for AC1, AC2, AC7 and the AC3/AC5 data paths; action tests for the changed call sites.
- Non-goals:
  - row-level changes to the "Profiles - Public Active Select" policy (rows stay visible; only columns narrow);
  - the `avatars` bucket being public (the A4b copy discloses it);
  - users editing `profiles.email` through the `grant update (email, …)` from migration `20260915130000` (recorded as AUTH-020, decision 4);
  - AUTH-016, AUTH-017, AUTH-018 and other post-A4 problems;
  - `teacher_profiles` (public teacher bio by design).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Deploy order: the app change is merged and its production deploy is READY **before** the Owner runs `db push`; the migration is never pushed first | The deployed old app reads `profiles` with `*` and private columns on the user client; after the revoke, the header and `/profile` fail for every signed-in user |
| G2. Every service-role read runs only after an explicit check in the same action (signed-in user, `requireAdmin()`, the course actor check, or RLS-filtered note ids) and is scoped to exactly the ids or course from that check, and every service-role read of `profiles` filters `removed_at is null` (the row filter the RLS policy applies today) | A service-role read without a prior check would leak private fields more widely than the current bug; without the `removed_at` filter, soft-deleted users would reappear in lists or get their email attached |
| G3. Grant the same public column set to `anon` and `authenticated`, and keep `id`, `role` and `removed_at` in it | RLS and storage policies on other tables run subqueries on `profiles.id`/`role`/`removed_at` as the caller; without SELECT on them, anon course browsing and uploads fail with `permission denied` instead of their normal result |
| G4. No change to `security definer` functions, triggers (`handle_new_user`), the Before User Created hook or `auth` schema objects | Re-opens A1 hard rules or breaks provisioning |
| G5. Hosted `db push` and the production checks are the Owner's or need an explicit grant; production checks record counts only | Program authority; personal data in the repo |

### 1.4 Owner decisions that bind this unit

The Owner approved all four on 2026-10-05.

1. **Course teams keep seeing members' emails.** Collaborators are invited by email, and the D1 workflow RPCs already return emails to the team. The A4b privacy copy changes accordingly (A4b r3.2, included in this candidate; the Owner approved the sentence with this decision): "Email, số điện thoại, ngày sinh và giới tính chỉ bạn và quản trị viên VocaSpace xem được; riêng email còn hiển thị cho các giáo viên cùng biên soạn một khoá học với bạn." Rejected alternative: hide emails from teams too (changes the D1 dialogs and several `security definer` RPCs).
2. **Public columns:** `id`, `username`, `full_name`, `avatar_url`, `role`, `created_at`, `updated_at`, `removed_at`, for both `anon` and `authenticated` (G3). `role` stays public because policies and the admin dashboard read it; teachers are public on course pages anyway.
3. **Program placement:** a new unit A4a in this program (master Decision 13), ordered A4 → A4a → A4b, with this plan at `implementation-plans/a4a/plan.md`.
4. **Adjacent finding:** a signed-in user can change their own `profiles.email` through the REST API (column `UPDATE` grant), so the email a team or admin sees may not be the sign-in email. Recorded as AUTH-020 for the post-A4 batch; not fixed here.

## 2. Repository facts

Baseline: `cbd87e9`, checked 2026-10-05.

- Migration `20260609114505`: policy "Profiles - Public Active Select" `FOR SELECT USING (removed_at IS NULL)` for every role, and `GRANT ALL ON TABLE profiles TO anon, authenticated`; later `20260915130000` replaced `UPDATE` with a column grant (`email, phone, username, full_name, avatar_url, dob, gender, updated_at, removed_at`) and `20260915150000` revoked `DELETE`. No migration narrows `SELECT` — justifies AC1/AC2.
- Reproduced 2026-10-05: local signed-out REST read returned emails; production signed-out count-only read matched 8 rows on `email`/`phone` not null (AUTH-019).
- Column-grant pattern: `20260924110000_d2_preview_quota_lifecycle.sql` revokes `SELECT` on `topics` from `public, anon, authenticated` and grants a column list — reused (G3 order).
- App readers of `profiles` on the user client: `getUserProfile` (`profile.ts:36`, own row, `email, phone, …, dob, gender`); `header.tsx:43` (own row, `*`); `getAllUsers` (`user.ts:51`, all rows, `*`, after `requireAdmin`); `course-collaborator.ts:165` and `:220` (`profiles!inner(id, email, full_name, avatar_url)` after an actor check); `review-notes.ts:185-186` (`author`/`removed_by` embeds with `email`, authorization by RLS `d1_can_read_topic_review_notes`); `admin-dashboard.ts:52` (recent enrollments embed `profiles:user_id (full_name, email, avatar_url)`, after an admin check). Other readers select only `role` or `username` (`admin-dashboard.ts:25,47`, `course.ts`, `course-collaborator.ts:70`, `profile.ts:79`) or use the service-role client (`auth.ts:86`, `user.ts` writes).
- `profile.ts` username-once update filters on `id` and `username` and returns `id`: both stay granted, so the conditional `UPDATE … RETURNING` keeps working (A3).
- SQL readers of private columns: `send_course_collaborator_invitation`, `get_topic_workflow_state` (several redefinitions up to `20261002100000`), `reject_topic_review`, `d1_delete_topic`/lifecycle RPCs, `get_my_pending_course_collaborator_invitations` — all `security definer`; storage and table policies read only `profiles.id`/`role` (e.g. `20260611143005`, `20260611162000`). No views on `profiles`.
- Public course pages read teachers through `get_public_course_catalog`/`get_public_course_detail` (`security definer`, `full_name`, `avatar_url`) — unaffected.
- `createServiceRoleClient` is the existing server-only service client (`app/actions/auth.ts`); `user.ts` uses `getAdminClient()` for admin writes.

## 3. Bounded implementation hypotheses

- H1. PostgREST refuses a request that names a non-granted column (including `*` expansion) with `42501 permission denied`, rather than silently dropping the column; integration tests assert the refusal.
- H2. Embedded `profiles!inner(...)` joins on the user client work with the public columns only; the service-role reads in AC6 return the same shape the dialogs use today, so no component change is needed.
- H3. Existing integration helpers may read `profiles` private columns with a user client; if any fails after the revoke, the helper switches to the service client (test-only), not the grant.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Migration plus app call sites meet AC1–AC7 locally | **Integration (local DB, `ALLOW_DB_INTEGRATION_TESTS=true`):** for anon and for a signed-in student, each of `email`/`phone`/`dob`/`gender` refused both as a selected column and as a filter (`<col>=not.is.null`) using GET requests so the body carries the code, asserting `42501`, not zero rows (a HEAD response has no body, so the SDK error code is undefined); `*` refused; public columns allowed; the student's own row behaves the same; an anon course-catalog RPC call and an anon read of a table whose policy checks `profiles.role` still succeed; a teacher upload policy check still passes for a teacher (AC7); the username-once conditional update still works (re-run `profile-username-once`). **Action tests:** `getUserProfile` returns the caller's private fields via the service client scoped to `user.id` and returns the existing error when signed out; `getAllUsers` and `getAdminDashboardData` refuse a non-admin before any service read; every service-role `profiles` read carries `removed_at is null`, and a soft-deleted member/author/learner gets no email (AC6b); collaborator overview/members do no service read when the actor check fails; review notes fetch emails only for returned ids. **Commands:** `npx supabase db reset`, `npm run test:integration`, `npm run test:run`, `npx tsc --noEmit`, eslint on changed files, `git diff --check`, `npm run build` |
| CP2 | Full local check and browser QA | `npm run docs:check`; smoke E2E (failures must equal the E2E-001 baseline plus AUTH-010). **Browser QA** at `http://127.0.0.1:3000` with seed users: student — header, `/profile` shows own email/phone, save and username; admin — user management list and the dashboard's recent enrollments show emails; teacher — a course's collaborator dialog shows member emails, a topic's review notes and workflow panel render; signed out — home and course pages; no console or server `permission denied` errors |

QA fixture readiness: seed users `student@gmail.com`, `teacher@gmail.com`, `admin@gmail.com` (`supabase/seed.sql`). A course with a second collaborator and a review note may be missing from seed; CP1 checks whether seed has one, and if not, the implementor creates it locally through the app (invite + accept, write a note) before browser QA, with no seed change.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A reader missed in §2 breaks after the revoke | Before CP1 closes, the implementor repeats the reader search including aliased embeds (`<alias>:<fk> (…)`, multi-line selects); full integration suite, build, browser QA across roles; production check after push (R3) |
| Migration pushed before the app deploy | G1 runbook order |
| Service-role reads widen access | G2; action tests for the refused paths |
| Policies on other tables fail for anon | G3; AC7 integration cases |

Owner rollout (after review):

- R1: merge; wait for the production deploy to be READY; signed in, the header and `/profile` work (old grants still in place).
- R2: Owner grants and runs `npx supabase db push` (or grants the agent to run it) for the A4a migration only; confirm with `migration list`.
- R3: production checks (AC8): `has_column_privilege` for `anon` and `authenticated` on all eight public and four private columns (needs a hosted read grant; booleans only); signed-out HEAD count-only reads with each private-column filter return a permission HTTP status (401/403), not a count; `/profile`, header, admin user list and dashboard, and a public course page work. Record booleans and pass/fail only. Close AUTH-019 only when every denied and allowed path passes.
- Then A4b continues (Decision 12).

Rollback: the default is a forward fix — keep the restrictive grants and fix the broken reader in a hotfix PR. Re-granting `SELECT` on the private columns re-exposes every user's email, phone, dob and gender to anyone, so it needs its own explicit Owner approval at that time; if done, AUTH-019 is reopened and A4b stays blocked. The app change alone is safe under the old grants, so R1 can sit indefinitely before R2.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
