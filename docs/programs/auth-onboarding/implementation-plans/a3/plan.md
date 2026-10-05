# A3 detail plan — Profile save with blank fields and one-time username

Revision: r2, 2026-10-05 (plan review r1: read-failure and zero-row handling, gender message, fixture marker wording; r2: AC9 kept apart from the AC4 race message; review r3 PASS). r1, 2026-10-05. Owner approval: approved 2026-10-05 with defaults 1–4. Master plan: [plan.md](../../plan.md) (outcome 3, Decision 3, §5 A3). Cut from [source r8](../../sources/d7-combined-plan-r8.md) H8, §5.3, C3, §9 (b)(c) and G7; deviations from the source are listed in §2.

Branch `feat/auth-a3-profile-username` from `main` `24ffd44`. Size: medium — no migration, no hosted configuration and no auth file; one Server Action, one schema and one form. The race between two saves needs a real-database test.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a signed-in user whose profile has no username (the state of every new Google user after A4, and of admin-created users without metadata) can save `/profile` with username, date of birth and gender left blank, and can set a username there exactly once. A user who already has a username keeps it: the field stays locked and the profile action never changes it.

| ID | Observable result |
| --- | --- |
| AC1 | A user with a null username who enters only a valid username (and a valid full name) saves: the username is written and blank `dob`/`gender` are stored as null |
| AC2 | A user with a null username who leaves the username blank and edits full name, date of birth or gender saves those fields; the username stays null; a blank `dob` or `gender` is stored as null with no SQL error |
| AC3 | A user with a null username who enters a username another profile already uses sees "Tên người dùng (Username) đã tồn tại!" and no field of their profile changes |
| AC4 | Two saves for the same user that both read the username as null and set different usernames: exactly one conditional update writes; the other writes nothing (no field changes) and shows "Username đã được thiết lập, vui lòng tải lại trang."; the database keeps the winner's username |
| AC5 | A save that reads an already-set username (including one set a moment earlier by another request) ignores the submitted username, still saves the other fields and reports success |
| AC6 | A user who has a username sees the field locked as today; a crafted call to `updateUserProfile` with a different username leaves the username unchanged and still saves the other fields |
| AC7 | On `/profile`, the username field is editable only while the stored username is empty; after a successful first set and the existing data refresh, the field shows the new username locked |
| AC8 | Invalid input is rejected by the server before any database read or write: full name under 2 characters and a non-blank username under 3 characters keep their existing Vietnamese messages; a gender outside `male`/`female`/`other` gets "Giới tính không hợp lệ." (today it has no custom message) |
| AC9 | If the current-username read fails or returns no visible row, or the ordinary (non-set) update returns no row, the user sees "Lỗi hệ thống khi cập nhật hồ sơ." and no success is reported; a requested first username is never silently dropped; a zero-row conditional first set keeps the AC4 reload message |

### 1.2 Scope and non-goals

- In scope:
  - `profileSchema`: a blank or whitespace-only `username`, `dob` or `gender` parses to null; an invalid gender gets a Vietnamese message;
  - `updateUserProfile`: reads the caller's current username, then either sets it through one update conditioned on `username is null`, or updates the other fields without `username`;
  - `EditProfileForm`: the username input is registered and editable while `initialData.username` is empty, with one short helper line that it can be set once; locked display unchanged when set;
  - schema, action, component and integration tests for AC1–AC9.
- Non-goals (master §5 A3 and §9):
  - blocking username changes through the Data API directly (G7 limitation; needs a migration, against Decision 3);
  - the register/profile gender enum mismatch (default 1, AUTH-016);
  - any migration, RLS or grant change;
  - username format rules beyond today's `min(3)`, or case-insensitive uniqueness;
  - phone, email or avatar editing; redesign of `/profile`;
  - Google OAuth (A4).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The first username set is one `UPDATE` of all profile fields plus `username`, filtered by `id = auth user id` and `username is null`, and the action reads the written-row count | Two concurrent first sets could both write (last write wins), or a partial write could save other fields while the username is rejected, breaking AC3/AC4 and the one-time rule (source G7) |
| G2. The non-set branch never sends `username` in the update payload | A crafted request could change an existing username through the action (AC6) |
| G2b. Both branches act only after a successful read that returns the caller's visible row, and report success only when the update returned exactly one row | A failed read treated as "already set" would drop a requested first username while other fields save; a hidden (`removed_at`) or missing row would report success with nothing written (SELECT policy hides removed profiles, migration `20260609114505` lines 1499/1503) |
| G3. Identity comes only from `supabase.auth.getUser()`; the action uses only parsed data and keeps the existing `{ error }` / `{ success: true }` result shape with no raw Supabase message | Another user's row could be targeted, or internals could leak; the form's toast handling would break |
| G4. Blank-to-null normalization lives in the schema the server parses, not only in the form | A crafted payload with `dob: ""` would still reach the `date` column and fail, so AC2 would hold only for the UI |
| G5. Any later rollback or fix keeps null-username profile saving working (master §5 A3 rollback rule) | Once Google has been enabled, new Google users could not save their profile |

### 1.4 Owner decisions that bind this unit

Master Decision 3 (no migration for the profile part; username can be set once while empty) binds this unit. Defaults below, Owner-approved 2026-10-05:

1. (Owner-confirmed 2026-10-05.) Gender enum mismatch stays out of A3 and is tracked as AUTH-016 (master §9 non-goal). Consequence: a user who registered through the app with "nam"/"nữ" still cannot save `/profile` until AUTH-016 is fixed; this does not affect null-username users (Google, admin-created). Alternative: fold a minimal mapping into A3 (widens scope and touches stored data semantics).
2. Username rule when set from `/profile` equals the register rule: `min(3)`, saved exactly as typed; only a blank or whitespace-only value counts as "no username". No trim of non-blank values, no new format rule.
3. Copy: helper line "Bạn chỉ đặt được username một lần." under the editable field; race message "Username đã được thiết lập, vui lòng tải lại trang."; invalid gender "Giới tính không hợp lệ."; duplicate and system-error messages unchanged.
4. No production fixture: production verification of a null-username save is the A4 enable gate (master §5 A4), not an A3 rollout step.

## 2. Repository facts

Baseline: `24ffd44`, checked 2026-10-05. Source r8 §3 (baseline `ab92e21`) still holds for the profile part, except where noted.

- `lib/schemas/profile.ts`: `username` is `z.string().min(3).optional().nullable()` and `gender` is `z.enum(["male","female","other"]).optional().nullable()`, so both reject `""`; `dob` is `z.string().optional().nullable()` and accepts `""` — justifies AC1/AC2, G4.
- `edit-profile-form.tsx`: `defaultValues.username = initialData?.username || ""` but the username input is not registered (`readOnly disabled`, shows "Chưa thiết lập"), so a null-username user always submits `username: ""` and is rejected by `min(3)`: today such a user cannot save at all — justifies the unit (master §5 A3).
- `updateUserProfile` (`app/actions/profile.ts`) writes `full_name`, `username`, `dob`, `gender`, `updated_at` in one update filtered only by `id`, and maps `23505` to "Tên người dùng (Username) đã tồn tại!" — justifies G1, G2, AC3, AC6.
- `profiles.dob` is `date`, `profiles.gender` is `text`, `profiles_username_key` is UNIQUE (many nulls allowed); `authenticated` has column `UPDATE` on `username` and policy "Profiles - Owner Update" (`auth.uid() = id`) (migrations `20260609114505`, `20260915130000`) — justifies G7 limitation as a non-goal and the conditional update under RLS.
- `signUpUser` stores `gender` from `registerSchema` (`"nam" | "nữ" | "other"`) into `user_metadata`, and `handle_new_user` copies it to `profiles.gender`; `profileSchema` accepts only `male`/`female`/`other` — exposes the conflict recorded as AUTH-016 (default 1).
- A2b already changed `app/actions/profile.ts` (`updateUserPassword`), so the master's order note "A3 rebases on A2b" is satisfied by branching from `24ffd44`.
- Fixture convention: QA and test users created through the Admin API carry `app_metadata: { d7_server_created: true }`, as `__tests__/integration/auth-password-setup-markers.test.ts` does. The source spike (§3, hook spike) showed the hook does not run for the Admin API, so the marker is convention, not a requirement.
- Deviation from source H8: the action keeps returning `{ success: true }` without the saved profile; the form already refetches through `onRefreshData`, which re-renders it with the new `initialData`.
- Seed learner `student@gmail.com` has username `local_student` and null gender — fixture (c).

## 3. Bounded implementation hypotheses

- Blank-to-null via a small shared preprocess/transform in `lib/schemas/profile.ts`. If `zodResolver` input/output types no longer fit `useForm<ProfileFormValues>`, use `z.input`/`z.output` generics or split a form schema from the action schema; record the split as a deviation. Must keep G4 and AC8.
- `updateUserProfile` reads `username` with `.select("username").eq("id", user.id).single()`, then for the set branch `.update({...fields, username}).eq("id", user.id).is("username", null).select("id")`; 0 rows → race message. The ordinary branch also uses `.select("id")` and treats 0 rows as the system error (G2b). Any equivalent that keeps G1–G3 is acceptable.
- Form: register `username` only when `initialData.username` is empty; keep the locked display otherwise. Field-level error under the input like `full_name`.
- Tests: `__tests__/schemas/profile.test.ts` (new), `__tests__/actions/profile.test.ts` (extend), `__tests__/components/edit-profile-form.test.tsx` (new), `__tests__/integration/profile-username-once.test.ts` (new). The integration file mocks only `@/utils/supabase/server` to hand each concurrent call its own real session client, with a barrier after the username read so both calls read null before either updates; the update itself runs on the real database.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Schema normalization and the two-branch action meet AC1–AC6, AC8 and AC9 against a real database | Schema tests (blank/whitespace → null for the three fields; invalid inputs keep their messages); action unit tests (set branch filters `username is null`; non-set branch payload has no `username`; 0 rows → race message with nothing else written; `23505` → duplicate message; read error or missing row → system error with no update; ordinary update returning 0 rows → system error; signed out and invalid input make no DB call); integration on local Supabase (`npx supabase db reset`, `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- profile-username-once`): first set, second set ignored while other fields save, duplicate leaves the row unchanged, barrier race has exactly one winner and the loser's row is unchanged, late request after set takes the non-set branch, blank `dob`/`gender` stored as null, a profile with `removed_at` set gets the system error and stays unchanged; for the race, the final row matches every field of the winning request |
| CP2 | `/profile` form meets AC7 and the full unit is checked | Component tests (null username: field editable, saving only a username submits it; saving with the username blank succeeds; set username: field locked and its value not editable; server error shows the toast and keeps input). Full checks: `npm run test:run`, `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run docs:check`. Local browser QA at `http://127.0.0.1:3000` with fixtures (b) and (c): save blank profile, set username once, field locks after refresh, reload keeps it; seeded student sees the locked field and saves full name |

QA fixture readiness (manual QA is data-dependent):

- Canonical fixture: `supabase/seed.sql` after `npx supabase db reset`. Covers (c) a user with a username (`student@gmail.com`).
- Missing state: (b) a confirmed user with null username, null dob and null gender. Created during QA with the Admin API (`email_confirm: true`, no username metadata, `app_metadata: { d7_server_created: true }`) and a test password, not committed; integration tests create and delete their own users.
- Outcome: the canonical fixture requires one narrow, uncommitted QA-time addition (b); no `seed.sql` change.
- Browser QA may begin when CP1 and the CP2 component tests pass.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Schema preprocess changes `zodResolver` typing and the form submits a wrong shape | Hypothesis allows a form/action schema split; `tsc` plus component tests on the submitted payload |
| A crafted request changes an existing username through the action | G2; action unit test and integration test (AC6) |
| Two first sets race | G1; real-database barrier test (AC4) |
| App-registered users with "nam"/"nữ" still cannot save `/profile` | Pre-existing, outside A3 (default 1); tracked as AUTH-016 |
| Username still changeable through the Data API | Accepted G7 limitation (master §9); unchanged by A3 |

- Rollout runbook: none hosted. After merge, the Owner (or the agent with permission) confirms the production deployment is READY and an existing account can still save `/profile` without changing anything. The null-username production check belongs to the A4 enable gate.
- Stop when: the conditional update cannot report the written-row count under RLS; the form cannot submit a null-username save without changing a shared primitive; or any fix would need a migration (Decision 3).
- Rollback: revert the PR before Google is ever enabled (no data migration, no hosted change). After Google has been enabled, follow G5: fix forward or revert only the faulty part.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
