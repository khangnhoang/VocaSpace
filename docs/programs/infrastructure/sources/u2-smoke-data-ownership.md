# INFRA-U2 smoke data-ownership table (AC1)

Recorded at CP1 on `infra/u2-e2e-parallel` from three read-only audits of the 26 files in `e2e/smoke/` (fixtures under `scripts/e2e/`, `e2e/support/`, seed rows in `supabase/seed.sql`), rechecked against the files before the changes below. Frozen evidence of the CP1 recheck; State lives in [progress.md](../progress.md). Plan: [INFRA-U2 plan](../implementation-plans/u2-e2e-parallel-workers/plan.md) r3.

Scope key: `worker-scoped` = every ID, email, username, slug and Storage path the file writes derives from `testInfo.parallelIndex` (`scripts/e2e/support/worker-scope.mjs`, `e2e` + worker-index UUID prefix that no `seed.sql` UUID uses); `seed-bound` = reads or writes seeded rows, runs in the `seed` project with `workers: 1`; `read-only` = writes nothing another file reads or asserts over.

## Recheck result against plan section 2

- Confirmed: the shared fixed rows were topic `66666666-…` and course `44444444-…-444` (seed rows, rewritten to draft by the authoring fixtures), course `44444444-…-445`, the matrix course `d8a00000-…`, course `f8100000-…-001`, the seeded student's B2 rows and the fixed `admin@gmail.com`/`teacher@gmail.com` rewrites in `course-authoring-base-fixture.mjs`.
- Added by the recheck: `public-course-free-enrollment` also wrote the seed topic `66666666-…` (publish) and the seeded student's enrollment and progress; `published-topic-live-edit` is the sixth matrix file; `topic-create-navigation` and `course-leave-navigation` also rewrote the seeded teacher/admin (and the leave fixture the seeded student).
- Corrected: `learning-workspace` and `enrolled-course-overview` are `seed-bound` readers of B2 rows that `review-session*` write (topics 111/112 progress, student-wide due counts); `admin-gate` shares the revocable admin `66666666-…-666` (auth user) with `e2e/admin/admin-user-hardening.spec.ts`.
- Cause of E2E-LOCAL-001 (code evidence, not reproduced on the base): `TeacherCoursePortfolio.tsx` shows the "Đưa vào thùng rác" button only in the continuation card and only below 5 collaborating courses (`dense = courses.length >= 5`); on the shared `teacher@gmail.com` the fixtures of earlier files had already created 5 or more courses (444, 445, `abab…`, `cccc…`, `f81…`), so the button was absent or ambiguous. The portfolio group now uses its own teacher per worker with exactly one course.

## Table

| File | Scope | Writes | Read scope its assertions depend on | Preconditions | Cleanup scope |
| --- | --- | --- | --- | --- | --- |
| `account-menu` | read-only | none (logs in as the three seed users) | exact menu items per role (`toHaveText`, counts 0/1) | seed `admin@`/`teacher@`/`student@gmail.com` with seed roles (setup keeps them canonical) | none |
| `admin-gate` | seed-bound | revocable admin auth user + profile (`66666666-…`, `e2e-revocable-admin@gmail.com`, shared with `e2e/admin/admin-user-hardening`) | page-wide text (`student@gmail.com` found through the user list's search box, because the client-paginated list also holds the worker accounts; sidebar links) | seed admin/student; no seed row written | `removeRevocableAdmin` in `finally` |
| `auth-return-path` | read-only | none | URL regexes | seed `student@gmail.com` | none |
| `course-leave-navigation` | worker-scoped | worker teacher + course + owner row; worker student `leave` + editor row | `dialog.last()`, URL | none from seed | none; next prepare re-upserts, the leave action deletes only this worker's membership |
| `course-structure` | worker-scoped | worker teacher, course (slug `local-structure-test-course-w<N>`), chapters/topics titled `E2E Structure … [w<N>]` | exact ordering via titles, `Chương 2 / 3`, `Chương đã xóa (1)` over the worker's own course | none from seed | prepare hard-deletes this worker's prefixed chapters/topics |
| `dashboard-return-freshness` | worker-scoped | worker authoring course/chapter/topic; cards on the worker topic | topic-wide active card count 0 then 1 (the worker topic only); issue list filtered by topic title | none from seed | prepare wipes cards/exercises of the worker topic; afterEach removes prefixed cards |
| `enrolled-course-overview` | seed-bound | none | exact progress values (50/100, 2/4, 3/3), unscoped `Tiếp tục học` links, absence of `Local Test Topic` | seed student B2 enrolments/progress; student not enrolled in `44444444-…-444` | none |
| `exercise-authoring` | worker-scoped | worker authoring course/chapter/topic; exercise tree titled `E2E Smoke Exercise [w<N>]` | one exercise by title, one group/question | none from seed | prepare deletes this worker's prefixed exercises |
| `flashcard-delete` | worker-scoped | worker authoring topic; one card `E2E Delete Flashcard …` | word-scoped locators, toast count 1 | none from seed | prepare and afterEach delete this worker's prefixed cards |
| `issue-deep-links` | worker-scoped | worker structure course (shared with `course-structure` on the same worker only), one chapter, one topic | `1 chương · 1 bài học` over the worker's course | `course-structure` prefix rows are removed by this file's own prepare | prepare hard-deletes this worker's prefixed chapters/topics |
| `learning-fast-rating` | worker-scoped | worker matrix course (`d8-learning-matrix-w<N>`), chapter, 7 topics, Storage under `<course>/<topic>/<worker matrix teacher>/`, worker student enrolment and progress | topic-scoped `last_rating` map, `4 / 4` counters | none from seed | afterAll `cleanupLearningWorkspaceMatrix({ scope })`; Storage folders of the worker's own topics |
| `learning-memory-cards-gate` | worker-scoped | as the matrix, plus `negotiate` card on the worker full-flow topic | exact lists/counts over the worker topic; the stored-answer lookup is limited to the worker's matrix course because question text repeats across workers | tests at L243 depend on L114 inside the same file; reseeds inside the file clean first | afterAll matrix cleanup |
| `learning-topic-completion` | worker-scoped | as the matrix | `progressbar` count 2, `Có 1 thẻ đến hạn` (worker student only), next-topic href from matrix order | `resetLearner` in beforeEach resets the worker student | afterAll matrix cleanup |
| `learning-workspace-matrix` | worker-scoped | as the matrix | page-wide card/answer buttons, `audio[data-mark]` count 1, scrollWidth | memory topic clean after seed | afterAll matrix cleanup |
| `learning-workspace` | seed-bound | none | page-wide `progress` count 0, zero `next-action` requests, dashboard geometry, topic 2 without progress row | seed student `33333333-…` B2 course/topics (`seed.sql` ~700–1180, 1481–1507) | none |
| `profile-username-once` | read-only | its private auth user `5555…` (`e2e-no-username@gmail.com`); no other file reads or writes it | label/text locators, DB readback of this user | none | none (fixture resets username to null per run) |
| `public-course-detail-progress` | worker-scoped | as the matrix | `Học tiếp` count 1, `Đã hoàn thành` 0/1, `a[href^=/learn/<worker course slug>/]` 0 | visitor test runs before any login in the file | `resetStudentProgress` per test; afterAll matrix cleanup |
| `public-course-discovery` | read-only | none | `h1` count 1, first highlighted link capped at 4 (not a course set) | published seed courses (worker courses may also be listed; no assertion counts courses) | none |
| `public-course-free-enrollment` | worker-scoped | worker student auth/profile, its enrolment in the seed course `local-toeic-test-course` and its progress on the seed topic; seed course/topic are read, never written | `Đăng ký miễn phí`/`Bắt đầu học`, `Tiếp tục: Local Test Topic` | seed topic must be published with no cards/exercises (no file writes it any more) | afterEach removes the worker student's enrolment; beforeEach its progress |
| `published-topic-live-edit` | worker-scoped | as the matrix (worker matrix teacher edits a card; worker student reads) | button regex `schedule` (first), exact text on the learner page | none from seed | afterAll matrix cleanup |
| `review-session-recovery` | seed-bound | seed B2 user flashcards `…001/002` (due dates), card `b2500000-…-001` content, topic 111/112 progress (snapshot + restore) | student-wide due count 2 then 1 | seed B2 rows; the fixture rejects when seed differs | `restore()` in `finally` |
| `review-session` | seed-bound | as above plus 49 extra cards/reviews (`d66…`) | student-wide due counts, `Đã xử lý n/50` | as above | `restore()` in `finally` |
| `teacher-course-portfolio` | worker-scoped | worker portfolio teacher (`extraTeacher("portfolio")`) + course `f81…`-style worker ID + owner row | link `Sửa: <title>`, level-2 heading, console guard | none from seed | none; next prepare re-upserts the title |
| `topic-builder-sheet-layout` | worker-scoped | worker authoring topic (cards wiped); worker portfolio teacher/course | header box equality; trash button unique because the portfolio teacher owns one course | scrollbar precondition asserted in the test | afterEach removes prefixed cards |
| `topic-builder-tabs` | worker-scoped | worker authoring topic; cards titled `E2E Return Freshness Flashcard …` | topic-wide active card count 1 over the worker topic | none from seed | afterEach removes prefixed cards |
| `topic-create-navigation` | worker-scoped | worker teacher, course, 3 chapters, 0/1/3 existing drafts, 3 created topics | per-chapter URL regex, exact title lookup in the worker course | none from seed | none; the stack is reset per local run |

## Non-smoke specs that write seed rows (correction after the Codex implementation review)

CI runs only `e2e/smoke`, but a full `npm run test:e2e` with `E2E_WORKERS=2` also collects `e2e/admin` and `e2e/d2`. They are seed-bound and run in the `seed` project with the five seed-bound smoke files, so they never run next to them or next to each other:

| File | Scope | Seed rows it writes or depends on |
| --- | --- | --- |
| `e2e/admin/admin-user-hardening.spec.ts` | seed-bound | the revocable admin `66666666-…-666` shared with `admin-gate` |
| `e2e/admin/admin-course-review.spec.ts` | seed-bound | a course plus collaborators on the seeded teacher/admin; the admin course list is read page-wide |
| `e2e/d2/public-course-preview.spec.ts` | seed-bound | due flashcards, an answer, progress and an enrolment for the seed student `3333…`, which `review-session` counts student-wide |

Also corrected: a worker authoring course whose teacher is `co_owner` now gets the shared admin as its `owner` (the seed owner row belongs to the seed course `44444444-…-444`), and `topic-create-navigation` removes the topics of its three chapters before rebuilding so the 0/1/3 draft counts hold on every prepare.

## Conclusion

17 files are `worker-scoped`, 5 are `seed-bound` (`admin-gate`, `enrolled-course-overview`, `learning-workspace`, `review-session`, `review-session-recovery`) and 4 are `read-only` (`account-menu`, `auth-return-path`, `profile-username-once`, `public-course-discovery`). After the CP1/CP2 changes and the review correction no worker-scoped file writes a seed row or an account the seed-bound files read, and the only shared writers of accounts (`ensureSharedAccounts`) run once before the first worker starts.
