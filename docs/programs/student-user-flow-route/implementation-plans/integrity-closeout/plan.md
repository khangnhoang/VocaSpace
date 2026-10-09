# L1 detail plan — learner integrity and D6 / D1 / D2 closeout

Revision: r1, 2026-10-08. Owner scope: confirmed in this chat. Owner authorizes implementation after independent plan review PASS and a local plan commit. Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: remaining learner-write relation and correctness boundaries are enforced in the database, while D6 and D1/D2 closeout records distinguish executed checks from Owner visual acceptance and unavailable production states.

| ID | Observable result |
| --- | --- |
| AC1 | An enrolled authenticated learner can INSERT, UPDATE and conflict-upsert their own answer/card only when its complete content chain is active and its course and topic are published. Draft, pending, removed, unrelated, unenrolled and other-user targets are denied. Collaborator or admin role alone never grants learner writes. |
| AC2 | Every selected option belongs to the submitted question. Database enforcement derives the saved `is_correct` from that option on each answer write, ignoring a forged caller value. It is the attempt-time snapshot; later authoring does not rewrite historical attempts. D4 continues using its current server-derived completion truth. |
| AC3 | Database constraints enforce topic/chapter/course, exercise/topic/course, question/exercise/course, question/group/exercise and answer/option/question consistency across all rows, including removed rows and privileged writes. Existing null chapter/group semantics and delete behavior are preserved; a missing chapter never authorizes a learner write. |
| AC4 | Historical learner SELECT remains available after unenrollment or content withdrawal. New and existing UPDATE targets must both be eligible. Direct learner progress writes remain denied; only D4's existing authenticated RPC derives progress. No manual completion or FSRS scheduling change is introduced. |
| AC5 | Local rebuild and relevant integration tests prove allowed/denied paths, forged correctness, individually valid cross-graph substitutions, content transitions, parent changes and unchanged D4/Q7/D1/D2 application contracts. A representative PostgREST nested workspace read still resolves its relationships. |
| AC6 | D6 browser checks on the actual Next application cover save/reload persistence, completion/next-batch, focus, fresh touch, 320px and actual 200% browser zoom. Forced load/save transport failures preserve usable error/retry state and do not advance an unsaved rating. Client-only injected failures are labelled; they do not prove DB failure handling. |
| AC7 | D1/D2 hosted migration history, deployed commit ancestry, creator/owner and managed-media inventories, public course routes and available read-only Preview/media checks are recorded. No production fixture, marker change, enrollment, content mutation or deployment is performed. Missing successful production Preview coverage remains explicit if no marker exists. |
| AC8 | Program State records D6 PR 141 and the current unit accurately. Problem entries close only at their actual exit conditions. Owner explicitly retains visual/UX/motion judgment for later; passing automated/browser checks cannot close final STUDENT-004 acceptance by themselves. |

### 1.2 Scope and non-goals

- In scope: a focused new integrity migration, affected local database tests and compatibility adjustments only when necessary; objective D6 browser verification; read-only D1/D2 hosted verification; program plan/progress/problems updates.
- The Owner groups these three outcomes in one work batch. Each keeps its semantic owner and independent evidence/rollback boundary; no new Stage or program is needed.
- Non-goals: D5, D8, D9, FEAT-008, dedicated review route, new publication/revision features, full lint cleanup, payment/auth redesign, FSRS correctness or anti-cheat scheduling, new packages and unrelated shared UI changes.
- Excluded external actions: initial push, PR creation, merge, migration push, hosted mutation and explicit deployment for L1. Earlier delivery grants applied to PR 141; this unit ends at local checkpoints unless separately authorized.
- Preserve the root dev runtime and the Owner's local due cards. Reset/setup applies only to the repository's isolated local test runtime; never reset root or hosted data.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Review the exact plan candidate until PASS, commit that plan, then implement. | Code could precede the Owner-required review gate. |
| G2. Inspect existing data before adding strict constraints; fail closed on invalid/ambiguous historical relations. No automatic historical deletion or repair. | A migration could silently erase attempts or assign them to the wrong content. |
| G3. Preserve existing FK names and one discoverable relation per table pair when replacing a FK with a composite relation. Verify delete behavior and PostgREST embeddings. | Database integrity could break Next workspace reads or change deletion effects. |
| G4. Reuse existing enrollment/content boundaries without exposing privileged helpers as public RPCs. Any new definer helper needs an empty search_path and explicit grants; prefer invoker when possible. | A Data API endpoint could bypass ownership or disclose protected content. |
| G5. Availability is checked for each learner write against current statement-visible content/enrollment state; a committed withdrawal denies subsequent writes. Concurrent FK/parent changes must preserve relations. Do not introduce serializable publication or FSRS semantics. | Security claims could overstate immediate in-flight revocation or require unapproved lifecycle locking. |
| G6. Keep SELECT history independent of new-write eligibility and preserve D4 monotonic completion. | Withdrawal could delete or hide earned history or redefine completion. |
| G7. Local invariant tests and browser fixtures use loopback isolated Supabase only; hosted queries remain read-only and aggregate where possible. | Verification could alter the Owner's data or production state. |

### 1.4 Owner decisions that bind this unit

- 2026-10-08: group learner-integrity work, D6 QA/docs and D1/D2 rollout verification in the same batch.
- 2026-10-08: replace Q7's enrollment-only draft-write allowance with active/published learner-write eligibility, preserving historical reads.
- 2026-10-08: follow the prior loop — new branch, durable plan, independent subagent plan-review corrections until PASS, local plan commit, implementation. The agent performs objective browser checks; Owner judges UI/UX and motion later.

## 2. Repository facts

Baseline: `fd24f0f4d9f023e53c734d7c9ed0b4b5c2f1ca86`, checked 2026-10-08.

- PR 141 merged D6 at this baseline. Its exact-head and subsequent main CI passed; final visual acceptance remains separate. This justifies AC6/AC8 rather than another redesign.
- Q7 policies on answers/cards check self ownership plus target enrollment but deliberately ignore content status. Its integration test permits enrolled draft writes; the new Owner decision supersedes that allowance for AC1.
- D4 removed learner progress INSERT/UPDATE policies and owns `d4_sync_topic_progress`. It ignores client `is_correct` when deriving completion. This narrows the remaining problem and justifies AC2/AC4.
- Existing single-column FKs allow independently valid but unrelated course parents and answer options. Existing action/workspace reads enforce bounded relations but are not universal database guarantees. This justifies AC3/G3.
- Hosted read-only inventory on 2026-10-08 found all local migrations through A5, zero invalid rows across the six relation/correctness queries, no active topic/chapter missing creator/authorship, no duplicate course owner, 16 Storage objects and zero marked Preview topics. These are point-in-time observations, not universal integrity proof or successful Preview QA.
- Vercel production deployment `dpl_FhBS5Vme698SJmPGMJweK4hNqRUs` is READY at the baseline. D1/D2 commits are ancestors; READY alone does not prove functional rollout.
- `npm run test:e2e` prepares/reset its `.e2e-runtime` Supabase on API 55441 / DB 55442 and serves Next on 3100. D6's fixture supports 0/2/51 due cards with bounded restoration. Root Supabase uses 45321/45322 and stays untouched.

## 3. Bounded implementation hypotheses

- Replace relevant existing FKs with composite FKs backed by required unique keys, retaining original constraint names and ON DELETE actions. Equivalent constraints are allowed if AC3/G3 remain true. Validate existing rows before the replacement; retain optional parent semantics.
- Add private active/published target eligibility composed with Q7 enrollment and apply it to answer/card INSERT and both UPDATE predicates. Keep Q7's enrollment helper unchanged for its consumers, and retain SELECT policies. An equivalent existing helper is preferable if it expresses the whole boundary.
- Use a narrowly scoped answer-write trigger to derive correctness from the selected option; prefer SECURITY INVOKER and enforce relation via the constraint. A different database mechanism is allowed if it preserves AC2 and does not add an unvalidated public write API.
- Existing action contracts should remain unchanged; adjust callers/types only if local compatibility evidence proves necessary. Generated database types, if needed, are regenerated via the documented local CLI rather than edited manually.
- Keep migration application/reset isolated. Before a reset, check the resolved workdir and port identity. Existing-data compatibility also needs an upgrade test on a populated pre-migration fixture; reset alone is insufficient.

### QA fixture readiness

- Outcome: canonical fixture requires narrow additions for hostile database relations and browser transport failure/zoom/touch checks; existing D6 0/2/51 states are reused.
- Canonical sources: `supabase/seed.sql`, `scripts/e2e/review-session-fixture.mjs`, existing Q7/D4 and D1/D2 integration fixtures.
- Fixture additions: two individually valid minimal content graphs for cross-parent/option substitutions; no new account family, broad seed rewrite or hosted fixture.
- Setup: existing `npm run test:e2e -- <focused specs>` resets isolated E2E data. Integration uses the same isolated runtime through explicitly derived env; local root review rows are preserved.
- Browser QA begins only after role, content chain, enrollment, due cardinality and runtime identity are confirmed. Hosted successful Preview stays unavailable while zero markers exist.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | D6 objective browser coverage and remaining Owner visual checks are separated; D6 merge recorded. | Focused review smoke, real save/readback and browser failure/retry, 320px/touch/200% zoom and keyboard/focus; docs checks. |
| CP2 | D1/D2 rollout truth and media/creator inventory are reconciled without hosted mutation. | Migration list, deployed SHA ancestry, read-only content/media inventories and available public route/denied Preview checks; preserve missing positive production Preview evidence. |
| CP3 | Database enforces the approved relation/correctness/eligibility contract and preserves existing consumers. | Populated upgrade, isolated local reset; focused integrity, Q7 and D4 tests plus affected D1/D2 tests and PostgREST workspace read; generated types if changed. |
| CP4 | Cumulative changes pass integration review and local delivery is ready, with Owner QA and remote rollout limitations explicit. | TypeScript, targeted lint, docs/diff checks; cumulative author self-review and affected-boundary checks. Record which browser cells are observed and which require Owner inspection. |

- CP1/CP2 can proceed independently of CP3. CP4 depends on their actual results and CP3 verification; checkpoint numbering is not a hard serial implementation order.
- DB tests cover authenticated learner vs anon/unenrolled/collaborator-only, INSERT/UPDATE/upsert, old/new target, wrong user, draft/pending/removed at each chain level, option mismatch/correctness spoof, historical SELECT, parent UPDATE and privileged invalid insertion. Reuse D4 tests for denied direct progress and current completion.
- Constraints must reject mutations to either side of a parent relation, including removed rows. Verify rollback leaves previous valid relations intact, and concurrent parent-key changes cannot commit invalid links.
- Browser failure tests may abort a real action transport before dispatch. They prove client recovery and unchanged local persistence, not a forced database error. No request mocking is used to claim successful action persistence.
- Owner-only checks: final visual composition, subjective animation smoothness and acceptance of the real D6 experience. These do not block a truthful local implementation checkpoint, but STUDENT-004 remains open.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Hidden invalid historical rows block strict constraints. | Run aggregate inventory and populated upgrade checks; abort migration rather than silently repairing learner history. Hosted snapshot must be repeated before any separately authorized rollout. |
| Composite FK replacement changes PostgREST relationships or authoring delete behavior. | Retain names/cascade semantics and verify nested reads plus affected authoring lifecycle tests. |
| A forged correctness value survives direct Data API writes. | Database-derived attempt snapshot with INSERT/UPDATE/upsert spoof tests and unchanged D4 recomputation. |
| New eligibility hides history or invalidates intended privileged fixture writes. | Separate history SELECT from write authorization; test learner/teacher/admin/service boundaries and active/removed rows. |
| A status transition occurs during an in-flight transaction. | Specify statement-visible authorization and test subsequent committed revocation; use constraints for relation races. Do not claim globally serialized lifecycle transitions. |
| Production has no public Preview fixture or inaccessible role session. | Record successful checks and the exact missing matrix cell; never create a marker or request credentials just to declare rollout complete. |

- Hosted rollout runbook after separate authorization: repeat compatibility/media inventory; review the approved migration and rollback; apply migration; verify history, grants, constraints and allow/deny smoke; observe deployed application. No hosted step executes in this unit's initial authority. Executed later under explicit Owner authority (see progress.md): the migration was applied once, one authorized migration-history version repair synchronized history to `20261008130544` with no schema rerun, and the routine Vercel production deployment followed the merge; the authorized alias reassignment was redundant because the alias already pointed at that deployment.
- Stop when: independent plan review has not passed; Owner behavior conflicts with an owning contract; historical repair/deletion is needed; canonical local runtime cannot be safely isolated; a fix needs an excluded product change; or evidence cannot establish a claimed boundary.
- Rollback: application/docs checkpoints can be reverted separately. A database rollback needs a new reviewed migration restoring previous FK/policy shapes; never weaken the live boundary automatically. No historical learner row is deleted/backfilled by this unit.
- Completion: local implementation/automated browser coverage may pass while Owner visual acceptance and a successful production Preview journey remain pending. Full LEARNING-INTEGRITY-001 closeout additionally needs merged delivery and separately authorized hosted verification; this plan does not claim those external steps happened.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
