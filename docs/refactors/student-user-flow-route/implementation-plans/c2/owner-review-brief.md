# C2 owner-review brief — Workspace Route Hardening

## Quyết định đã qua validation, cần owner duyệt trước implementation

- URL `/learn/[course-slug]/[topic-slug]` là source of truth duy nhất cho current topic.
- Sidebar/previous/next dùng canonical topic links/navigation với history push; direct URL, refresh, back và forward phải render đúng topic của URL.
- Không còn invalid-topic fallback sang topic đầu tiên.
- Workspace có explicit `auth_required`, `course_not_found`, `unenrolled`, `topic_unavailable`, `success`, `error` states.
- `topic_unavailable` gộp invalid/nonexistent/draft/removed/wrong-course thành privacy-safe route-local feedback; không invent preview lock semantics.
- Course syntax giữ C1 immediate not-found; topic syntax parse sớm nhưng chỉ classify sau auth → published active course → enrollment. Unenrolled không inspect topic existence/status/ownership.
- Dedicated server contract kiểm tra exact course/topic/chapter và denormalized course consistency trước protected content/history; protected reads bounded/parallel, không N+1 hoặc duplicate client fetch.
- `submitQuestionAnswer` parse UUID, kiểm tra selected option thuộc question và active parent chain trong chính existing bounded read, handle write error; không thêm query round trip hoặc đổi correctness semantics.
- `submitCardReview` chỉ nhận trusted `cardId + rating`, derive topic/current FSRS row từ one bounded content-RLS read, handle write error; bỏ client `topicId`, progress initialization và legacy auto-enrollment.
- ReviewSheet queue/mutation dùng cùng eligibility và không dequeue/show completion irreversibly khi write fail.
- Completion flags/FSRS/exercise correctness giữ semantics hiện tại; final completion, memory check và preview vẫn deferred.
- C2 chỉ guarantee approved application paths. Current DB/RLS vẫn cho self-owned direct Data API writes không được relationally bound; `LEARNING-INTEGRITY-001` sở hữu future DB-wide enforcement, tách khỏi `PROGRESS-001` completion semantics.
- Detailed contract: [plan.md](./plan.md). Brief này không override plan.

## Baseline và quyền hiện tại

- Branch: `feat/workspace-route-hardening`.
- Baseline: `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`.
- PR #75/C1 đã merge tại chính baseline; dependency C1 đã thỏa mãn.
- P0 planning package đã commit/push tại `f4e82cc`; validation pass hiện tại chỉ được reconcile docs, không stage/commit/push.
- Application implementation chưa được phép trong phiên này; cần owner approve plan hoặc instruction implementation mới.

## Checkpoints và gates

| Checkpoint | Outcome | Gate |
| --- | --- | --- |
| P0 — Planning delivery | Reconcile source of truth, C2 plan/brief/status docs, self-review, planning commit/push | Link/stale/scope audit, `git diff --check`, staged diff, no app changes |
| CP1 — Route/read/access contract | Strict precedence/result DTO; exact course-topic-parent binding; bounded protected reads | Focused action/schema + C1/B2 + query-budget regressions, TypeScript, targeted lint, diff check |
| CP2 — Write-context hardening | Progress/question/review bounded relation validation; checked writes; remove auto-enroll/progress-init | Focused progress/review/profile/ReviewSheet regressions, TypeScript, targeted lint, diff check |
| CP3 — URL-owned UI/navigation | Page state mapping, sidebar/previous/next URL push, stale-state reset, accessible feedback | Focused component/helper/C1 regressions, TypeScript, targeted lint, diff check |
| CP4 — Browser/docs completion | Direct/refresh/back/forward/inaccessible seeded smoke, responsive/manual QA, full gates/docs | Full Vitest, TypeScript, focused C2 E2E, build, final audit |

Thứ tự là P0 → CP1 → CP2 → CP3 → CP4; không parallel vì mỗi checkpoint tiêu thụ contract trước đó.

## State/CTA contract

| State | Visible behavior |
| --- | --- |
| `auth_required` | Redirect `/login`; no protected reads |
| `course_not_found` | C1-compatible `notFound()` |
| `unenrolled` | Same-route persistent state; primary `/courses/[course]`, secondary `/learn`; no syllabus/content |
| `topic_unavailable` | Same-route privacy-safe state; primary `/learn/[course]`, secondary `/learn`; no fallback/content leak |
| `success` | Exact route topic, ordered syllabus and strict learner-safe content |
| `error` | Recoverable alert + refresh retry |

Workspace back action đi `/learn/[course]` với accessible label; global `VocaSpace` brand/logo vẫn đi `/`, không thêm Home icon.

## Query-cost guardrails

- `submitQuestionAnswer`: giữ `1 auth + 2 DB`; richer existing read + checked upsert, zero additional round trip.
- `submitCardReview`: từ `1 auth + 6 DB` xuống target `1 auth + 2 DB` (`3 DB` chỉ khi optional current-FSRS embedding không reliable).
- Workspace navigation: một canonical RSC navigation, không legacy `getTopicContent` + history Server Action waterfall, không all-user answer scan/N+1.
- Action mocks chứng minh server query count/order; Playwright request/trace chứng minh browser navigation/duplicate calls. Không dùng Lighthouse target hoặc heavy benchmark framework.

## Fixture readiness

Existing `supabase/seed.sql` đủ cho enrolled ordered topics, card-backed direct topic, wrong-course topic, draft/removed topic, authenticated unenrolled course/topic và deterministic invalid/nonexistent URLs. Không cần migration/RLS/seed theo discovery hiện tại.

## Scope cấm và stop conditions

Không chạm memory check, final completion truth, exercise correctness semantics, FSRS algorithm, preview/30%/collaborator access, global 404, mobile account menu, Wave D, shared primitives/packages hoặc DB schema/RLS/RPC/seed.

Dừng và xin owner decision nếu route trust cần migration/RLS, preview contract, completion/exercise rewrite, shared B2/C1 output change, payment/enrollment redesign hoặc broad workspace/global navigation redesign.

## Planning verdict

- Size: **Large/high-risk**, one PR with four sequential implementation checkpoints.
- Owner-decision validation: cả sáu verdict là **Confirmed with refinement**; không có decision bị reject hoặc material scope/dependency/semantic conflict.
- Main planning self-review sau reconciliation: **Pass — `0 Critical`, `0 Required` còn mở**; exact PostgREST aggregate count giữ confidence Trung bình (`Medium`) tới CP1 tests.
- Specialist: `0`; reconsider only after main implementation review if actual diff leaves one material hard-risk cluster unresolved.
- Implementation permission: **not granted** by this planning session.
