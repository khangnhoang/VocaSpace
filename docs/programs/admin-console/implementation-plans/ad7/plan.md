# AD7 detail plan — active-admin authorization and safe self-edit

Revision: r1, 2026-10-15. Owner approval: conditional on independent plan review PASS (Owner, 2026-10-15); commit the accepted plan before implementation. Master plan: [plan.md](../../plan.md), Outcome 7, shared invariant 1 and unit AD7. Problem: [ADMIN-004](../../problems.md#admin-004-admin-checks-ignore-removed-admins-and-allow-self-role-change).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: administrator privileges require a currently active admin profile at the authorization boundary, and an admin can edit their own personal details without being able to change their own role. A valid existing JWT does not preserve privileges after the profile is soft-deleted. Ordinary public, learner and course-membership access is not redefined as administrator access.

| ID | Observable result |
| --- | --- |
| AC1 | `public.is_admin()` returns true only for the authenticated caller whose profile has `role = 'admin'` and `removed_at is null`; anonymous callers, missing profiles, non-admins and removed admins receive false. |
| AC2 | A removed admin with a still-valid session and no relevant course membership/enrollment cannot use the admin override to read draft or removed courses, their active chapters, another learner's payment rows, or perform discount staff writes. Active admins and existing ordinary authorized actors retain their supported access. |
| AC3 | A removed admin calling `moderate_platform_content` directly cannot demote, take down or invalidate review of any course/chapter/topic. Denial changes no content, preview marker, review submission or moderation audit. Active-admin moderation preserves D1/D2 behavior and reason requirements. |
| AC4 | A removed admin cannot delete another uploader's course thumbnail or question-group image/audio by relying on global admin privileges. Active admins retain their existing moderation-delete access. Ordinary uploader/author delete rules, published/pending protections and private-media reads remain unchanged. |
| AC5 | `updateUserByAdmin` rejects a request that targets the current admin and supplies a role other than `admin`, before any service-role mutation. Calling the action directly, forging client identity or changing UUID letter case cannot bypass this check; identity comparisons use the canonical parsed UUID. |
| AC6 | An active admin editing themselves can still save `full_name`, `username` and `phone` while keeping role `admin`. The role control is read-only/disabled with a visible explanation; it does not accidentally remove a required submitted value. Actor identity comes from the authenticated server session. |
| AC7 | Active admins retain existing create/edit permissions for other accounts, including role changes. Unauthenticated, non-admin and removed-admin callers are denied by every user-management action before its privileged read/write, account creation, email or Storage side effect. Existing A5 partial-create results and learner-deletion protections remain compatible. |
| AC8 | The edited update boundary validates its target identifier and payload server-side, uses only parsed values, and returns a safe error for forbidden, missing or failed targets rather than a false success or raw SQL/provider details. It never edits email, `removed_at` or any unknown privileged field. |
| AC9 | Real-database denied-path tests prove the SQL and Storage boundaries, action tests prove the self-role/no-side-effect guard, and focused form tests prove safe self-edit. ADMIN-004 is resolved only after its implementation and required verification are complete; production application is a separate recorded step. |

### 1.2 Scope and non-goals

In scope:

- One new focused migration hardens `is_admin`, admin overrides in `can_view_course_basic` and `has_course_content_read_access`, the moderation RPC, and the remaining direct admin override in the thumbnail DELETE policy. Existing policies using `is_admin` inherit the correction.
- The user update action and its reusable input contract where needed, plus a small self-edit restriction in the existing user-management form. Existing page/action gates remain in force.
- Real SQL/Storage/action/form coverage and the program's State/problem closeout.

Non-goals:

- AD4 dashboard, AD5 payments UI, AD6 discounts UI, admin redesign (ADMIN-005), floating sheets, or admin lesson try-out.
- Account lock/unlock UI, login bans, session revocation, a new last-admin invariant, changes to other admins' role-management powers, or a new audit framework.
- Removing ordinary course membership or learner access from a removed profile; this unit removes privileges obtained from the global admin role. Existing independent active-profile gates stay intact.
- Editing auth email/password flows, redesigning profile fields, changing the one-time `/profile` username rule, or broad schema/error cleanup outside the affected update boundary.
- Changing D1 topic-author/reviewer authority, Q7 private media, D2 preview quotas, course listing approval, trusted service-role operation, or GRANT-001's chapter RPC grants.
- Retrofitting globally serialized revocation into every request already authorized/in flight. Checks use current database state at their existing authorization boundary; no immediate cancellation guarantee is claimed.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Correct effective definitions, including the two additional admin overrides above; do not edit published migrations. | Fixing only the three names in ADMIN-004 leaves chapter reads or thumbnail deletion available through the same removed-admin bypass. |
| G2. Preserve function signatures, result shapes, owners, intended execute grants and safe qualified names/`search_path` for `SECURITY DEFINER` functions. No new privilege grants. | A permission fix could expose a definer entry point, break callers or change an unrelated role's capabilities. |
| G3. Modify only the admin branch of compound access rules. Test both `USING` and `WITH CHECK` behavior where an affected policy has both. | A blanket profile filter could silently revoke ordinary course membership or widen writes while fixing admin checks. |
| G4. Keep moderation's course-first advisory locks, D1 lifecycle flags, D2 quota handling and audit transaction intact. | Replacing its body carelessly can reintroduce deadlocks, partial moderation or preview/quota corruption. |
| G5. Keep service-role clients behind authenticated active-admin checks; derive the self-target comparison from server identity and a canonically normalized parsed target UUID. | A forged role/actor ID, differently cased UUID or a UI-only restriction bypasses the fix; service role bypasses RLS. |
| G6. Keep self-edit schema/default/submission behavior coherent; unknown fields stay stripped and email stays immutable. | Disabling the role/email field can make a valid self-edit impossible, or newly accept a privileged write. |
| G7. Use the isolated local runtime (API `45441`, DB `45442`) for local rebuilds, fixtures and integration; never reset root API `45321`. | A test/rebuild could destroy the Owner's persistent development data or apply an unapproved migration there. |
| G8. Run role/state cases through real authenticated clients with privileged readback; service role is only fixture setup/cleanup/readback. | Service-role success or mock-only tests cannot prove that a removed admin is actually denied. |

### 1.4 Owner decisions that bind this unit

- The master plan r2 (Owner-approved 2026-10-13) defines Outcome 7 and requires active-admin checks without changing D1 ownership.
- (2026-10-15) Work sequentially: delete the local AD4 branch and its untracked draft, synchronize `main`, create `fix/admin-user-hardening`, and write the AD7 plan. This grants branch preparation and planning, not implementation or delivery.
- (2026-10-15, explicit choice) For self-edit, lock only the Role field; continue to allow name, username and phone edits as today.
- Proposed scope preservation, subject to approval of this plan: retain current role changes on other accounts; add no account-lock or last-admin mechanism. No material unresolved product decision is needed for that bounded outcome.
- (2026-10-15, later grant) The Owner requests independent `gpt-6.1-sol/high` plan review, same-session correction/rereview until PASS without the default two-round cap, then plan commit and implementation, with local commit authority throughout this task. The current grant satisfies plan acceptance after PASS; it does not grant push, PR, merge, root or hosted mutation.

## 2. Repository facts

Baseline: `0b5027860eebda75bf26a3a6aa13e6a93ed126ff`, checked 2026-10-15 after fetch and fast-forward pull. `HEAD`, `main` and `origin/main` matched; AD1, AD2 and AD3 are in that ancestry. These are source/migration facts, not observations of the current hosted catalog or database.

- [`is_admin`](../../../../../supabase/migrations/20260609114505_remote_schema.sql) (lines 593–601) and `can_view_course_basic` (204–263) inspect role without the profile deletion marker. Their effective definitions justify AC1–AC2.
- The same baseline migration's `has_course_content_read_access` (497–549) contains two role-only admin branches and still backs `Select chapters credential bound` (1533). LF3 replaces the primary Q7 topic-read consumer, but not this chapter policy/helper. This is an additional AC2 boundary.
- [`moderate_platform_content`](../../../../../supabase/migrations/20260924110000_d2_preview_quota_lifecycle.sql) (1176–1336) is the latest moderation definition; its admin predicate at 1201 omits `removed_at`. It returns JSONB and is callable by `authenticated` and `service_role`, with PUBLIC/anon revoked. This justifies AC3 and G2–G4.
- [`Owner or Admin Delete Thumbnails`](../../../../../supabase/migrations/20260611143005_sync_storage_bucket_policies.sql) (49–65) still uses a direct role-only admin override. D1 changes thumbnail INSERT, not this DELETE policy. The effective question-group DELETE policies instead call `is_admin` in [`D1 corrections`](../../../../../supabase/migrations/20260917100000_d1_senior_review_corrections.sql) (337–367). This justifies AC4.
- Historical thumbnail/question-group upload role checks have already been replaced by D1 authoring policies. `has_course_management_access` was replaced by D1 authoring delegation. Do not restore or rewrite obsolete global-admin branches while implementing this unit.
- [`A5 profile column grants`](../../../../../supabase/migrations/20261007110000_a5_profiles_email_owner.sql) allow authenticated UPDATE only on `username, full_name, avatar_url, dob, gender, updated_at`; `role` and `removed_at` cannot be self-restored through that API. A5 email synchronization and trusted provisioning remain unchanged.
- [`user.ts`](../../../../../app/actions/user.ts) already checks session, admin role and active profile before all four user-management actions. Its update path (115–132) uses service role with caller-supplied target/role and no self-role guard; it does not validate the target UUID, confirm a matching target was changed, or sanitize its mutation error. This justifies AC5 and AC7–AC8.
- [`adminUserSchema`](../../../../../lib/schemas/auth.ts) is shared by create/update and requires email, although update does not write it. [`UserFormModal`](../../../../../app/admin/user-management/_components/UserFormModal.tsx) disables email on edit and leaves the three-role selector enabled. This constrains the AC6 compatibility work rather than authorizing email editing.
- At this baseline, a local probe of the installed Zod `z.string().uuid()` accepted an uppercase UUID and returned it unchanged. UUID validation alone therefore does not establish safe string equality with a lowercase authenticated user ID (AC5/G5).
- [`admin-access.ts`](../../../../../lib/auth/admin-access.ts) already owns active-admin identity for page/AD3 checks. [`user.test.ts`](../../../../../__tests__/actions/user.test.ts) has create/delete/list coverage but no update tests. The existing create-form component test does not prove self-edit. These justify targeted update coverage rather than a replacement admin framework.
- Existing [`A5 read/profile integration`](../../../../../__tests__/integration/a5-admin-reads-and-profile-owner.test.ts), [`media Storage integration`](../../../../../__tests__/integration/question-group-media-storage.test.ts), AD2/AD3 suites and the isolated admin-gate fixture provide reusable setup. State at this baseline still calls AD3 pending QA despite the merge commit for PR 157; correcting that claim must not invent production QA/deployment evidence.

## 3. Bounded implementation hypotheses

- Add a migration under `supabase/migrations/` that reuses `is_admin` for the effective direct admin branches and returns a non-null boolean. Exact SQL composition may vary while AC1–AC4, signatures/grants and ordinary access remain true. Preserve the thumbnail owner branch.
- Harden `updateUserByAdmin` in place. A small update schema composed from the existing auth field rules may validate the UUID and writable fields while ignoring legacy email/unknown extra fields. Keep create-user validation, A5 markers and partial-failure semantics unchanged; no general user-edit RPC is presumed necessary.
- Obtain the server-derived admin ID from the existing page gate and pass it to the client only to render the self-edit role restriction. The action independently derives identity again. Exact prop names/component wiring may change while AC5–AC8 hold.
- Reuse `getActiveAdminUserId` where this avoids divergent active-admin semantics without changing established errors or making unrelated actions part of a refactor. The generic topic-moderation action may keep its current session-only precheck: the corrected RPC is the authoritative active-admin gate for every caller.
- Add a focused `ad7-admin-hardening.test.ts` integration suite, extend the existing user action tests, and add edit-form interaction coverage beside the create-form suite. These names are provisional; the real-boundary guarantees and verification layers are binding.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Effective SQL and Storage admin privileges reject removed admins while preserving active-admin and ordinary-author access. | Isolated rebuild; direct helper/RLS/RPC/Storage matrix below, including denied no-mutation assertions. |
| CP2 | The authenticated admin can safely edit themselves without changing role; user management preserves its other supported operations. | Schema/action/form tests plus real-session update coverage; focused lint and TypeScript. Depends on CP1 for integrated removed-admin verification. |
| CP3 | The two changes compose, required manual checks are complete or explicitly pending, and documentation accurately separates local completion from hosted rollout. | Affected regression suites, author self-review and implementation review as required by the lifecycle, manual matrix, docs checks and scope audit. |

These are independently reviewable outcomes within one AD7 delivery, not separate PR requirements. AD1 is the hard program prerequisite and is merged. AD2/AD3 are available regression baselines; AD4–AD6 are not dependencies. No Stage or extra tracking document is needed.

### 4.1 Verification strategy

All checks below are planned for implementation; they have not been run as product evidence by the planning task.

| Layer | Required evidence |
| --- | --- |
| SQL helpers/RLS | Active admin, removed admin with valid JWT, teacher, student, anonymous and missing-profile cases. Positive ordinary owner/member controls. Draft/removed course and active chapter reads; cross-user payments; discounts INSERT and UPDATE, including unchanged denied rows. Use a removed admin with no independent ownership/enrollment for admin-override negatives. |
| Moderation RPC | Each target type is denied for removed/non-admin callers, with content/review/preview/audit readback unchanged. Active-admin positive paths retain valid reason, supported state and existing audit behavior. Existing D1/D2 suites cover the unchanged lifecycle breadth. |
| Storage | Real thumbnail and question-group image/audio delete attempts on another uploader's object: removed admin denied and object still present; active admin allowed. Preserve ordinary owner-delete controls and pending/published author restrictions from existing media coverage. |
| User actions | Direct forged self-demotion to teacher/student denied without a service mutation, including uppercase/mixed-case forms of the same UUID; same-role self-edit succeeds; other-account role editing preserved. Invalid UUID/payload, missing/removed target, auth/profile lookup failure, non-admin/removed admin and provider update failure return safe failures. Unknown `email`, `removed_at`, actor ID and other privileged fields never enter the mutation. Reuse unaffected create/delete/list tests. |
| Real-session update | Exercise the action with the existing Next cookie adapter replaced only by an authenticated Supabase client; verify own role unchanged after denial and own permitted fields persisted after success. Keep a second active admin target for the ordinary cross-account case. |
| Form | Exercise the actual self-edit form: role locked and explained, permitted fields submit, success reloads, safe failure keeps useful input, pending prevents duplicate submission. Other-account role selector and create behavior remain usable. Rendering-only action mocks do not establish server enforcement. |

Commands after implementation, selected from current scripts:

```powershell
npx vitest run __tests__/actions/user.test.ts __tests__/utils/admin-access.test.ts __tests__/components/admin-user-management-create.test.tsx
# Add the actual new update-schema/form test paths to the focused command.
npx tsc --noEmit
# Run ESLint only on changed TS/TSX files.
npm run docs:check
git diff --check
```

For database checks, first prepare/refresh the existing `.e2e-runtime` copy of the migration source using `prepareSupabaseWorkdir`, following the repository setup workflow; do not reset a stale copy or create a third local project. After the target guard confirms the isolated workdir and loopback API/DB ports, use `npx supabase --workdir .e2e-runtime db reset --local`. Obtain that runtime's keys without logging them, set the corresponding `NEXT_PUBLIC_SUPABASE_URL`, anon key, service-role key, `ALLOW_DB_INTEGRATION_TESTS=true` and `E2E_SUPABASE_WORKDIR=.e2e-runtime`, then run:

```powershell
npm run test:integration -- __tests__/integration/ad7-admin-hardening.test.ts __tests__/integration/a5-admin-reads-and-profile-owner.test.ts __tests__/integration/ad2-course-listing-approval.test.ts __tests__/integration/ad3-admin-course-read.test.ts __tests__/integration/question-group-media-storage.test.ts
```

Use the actual AD7 suite path if renamed. Include directly affected topic-review/moderation tests. Because `is_admin` is a shared SQL boundary, final delivery must also pass the repository integration CI, not only the new suite; current integration CI automatically discovers it. Full unit/build checks follow delivery requirements or a demonstrated cross-cutting change, not a docs-only planning checkpoint.

### 4.2 Manual QA and fixture readiness

Fixture outcome: **canonical fixture requires narrow additions**. Reuse seed roles and the isolated fixture's dedicated revocable admin (`scripts/e2e/admin-gate-fixture.mjs`); never revoke the shared seeded admin. Add a dedicated second active admin/target and only the unrelated course/media objects missing from the cases. Reuse existing A5/media fixture helpers and deterministic cleanup. The fixture must restore role/removal changes and remove only its own records/objects, including after a failed check. No new production or root-local fixture data is authorized.

| Actor / starting state | Action | Expected visible result / evidence |
| --- | --- | --- |
| Active admin; own row in `/admin/user-management` | Open edit; use keyboard on Role; change allowed personal fields and save. | Role cannot change and explains why; permitted fields persist and role stays admin. Record saved values without exposing private data. |
| Active admin; another dedicated account | Edit that account's role and save, then restore. | Existing supported role selection works and updated row appears; restore confirmed. |
| Dedicated admin with an open page; fixture then marks profile removed | Attempt a fresh list/update request and navigate to another admin page. | Action denied, no mutation; page follows the existing denied gate. Do not claim cancellation of a request already authorized before removal. |
| Active admin; server rejects an edit | Submit, observe pending and recoverable failure. | No success toast, duplicate submit prevented, form/input recoverable. Restore fixture afterwards. |

The implementation checkpoint prepares and validates fixture additions on the isolated rebuild before browser QA. Keep UI verification to the existing Admin / Business Operations form: keyboard, readable explanation, focused desktop and narrow-width behavior. Use unchanged local patterns/components; no admin design brief or shared primitive change is needed for this bounded restriction. Browser automation, if used, follows `playwright-cli`; the planning task does not run a browser. Each unobserved matrix row remains pending.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A historical definition/policy is mistaken for the effective one. | Reconcile migration order and rebuilt catalog before editing; keep the four helper/RPC boundaries plus thumbnail DELETE in scope. Test actual operations, not SQL-text presence. |
| Tightening the helper accidentally revokes collaborator/owner paths or expands global-admin topic authority. | Preserve non-admin branches and run positive ordinary-member controls plus existing D1/Q7/AD2/AD3 regressions. |
| Replacing the large moderation body loses lock, quota or audit behavior. | Limit its semantic change to the admin gate; inspect the exact function diff and run existing lifecycle coverage. |
| Disabled role/email fields break RHF submission or self-edit identity becomes caller-controlled. | Test the real edit form and direct action separately; immutable server identity owns the enforcement. |
| A privileged update reports success when no target matched. | Require a confirmed matching active target and stable safe failure; real-session readback verifies persistence. |
| A valid JWT or a privileged fixture masks the revoked-admin boundary. | Retain a signed-in dedicated removed admin and send its token through real APIs; service role is never the actor under test. |

Rollout runbook, only after separate implementation/delivery grants:

1. Complete isolated rebuild, required tests/review and manual evidence; obtain plan approval before implementation. Keep ADMIN-004 open while acceptance or rollout remains unverified.
2. Create/push the authorized PR and require CI green. Follow the master plan's migration-before-merge order.
3. With explicit hosted authority, inventory current function definitions, policy definitions and grants read-only; stop on unexplained drift, then apply the new migration once. No data backfill or account-role/removal mutation is expected.
4. Verify migration listing, effective admin predicates, function ownership/signatures/grants and preserved policy branches read-only. Hosted write-based role/media probes require their own approval and rehearsal; definition checks do not prove the full runtime matrix.
5. Merge/deploy only on the corresponding Owner grant; verify deployment and the authorized active-admin UI. Record rollout scope and any unverified hosted behavior in State. Root migration remains separate and is not implied by hosted approval.

Stop when an effective admin-only bypass needs a different semantic owner, an existing role loses intended ordinary access, a binding product/permission decision changes, required real-DB evidence is unavailable, or the next action lacks authority. Report the exact gap; do not weaken tests or broaden permissions.

Rollback: isolated fixtures are restored/cleaned by their owner. For a deployed defect, prefer a focused forward fix; an app-only rollback can keep the hardened SQL. Do not restore removed-admin privileges as a routine rollback, edit published history, or mutate hosted/root without explicit authority. Any necessary emergency SQL correction receives its own reviewed migration.

Privacy/terms: this unit adds no user-data field, read audience or third party; it restricts existing access and preserves self-edit. No legal wording change is planned. Re-evaluate the repository disclosure rule if implementation expands a read path.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
