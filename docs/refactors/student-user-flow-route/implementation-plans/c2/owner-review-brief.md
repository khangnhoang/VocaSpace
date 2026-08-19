# C2 owner-review brief — Workspace Route Hardening

## Quyết định đã qua validation và được triển khai

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

## Baseline và trạng thái hiện tại

- Branch: `feat/workspace-route-hardening`.
- Baseline: `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`.
- PR #75/C1 đã merge tại chính baseline; dependency C1 đã thỏa mãn.
- Approved reconciled plan: `237ad103`.
- Checkpoints: CP1 `bc1cd93`; CP2 `9682389`; CP3 `a3191b5`; CP4 completion/self-review checkpoint đang hoàn tất.
- CP1–CP4 implementation và automated/browser/build gates đã đạt. Final commit/push được owner cho phép; PR/merge/deploy không được phép và chưa thực hiện.

## Checkpoints và gates

| Checkpoint | Outcome | Gate |
| --- | --- | --- |
| P0 — Planning delivery | Reconcile source of truth, C2 plan/brief/status docs, self-review, planning commit/push | Link/stale/scope audit, `git diff --check`, staged diff, no app changes |
| CP1 — Route/read/access contract | Hoàn tất tại `bc1cd93` | Focused `36/36`, TypeScript/lint/diff đạt; query budget `1 auth + 3 DB` |
| CP2 — Write-context hardening | Hoàn tất tại `9682389` | Focused `27/27`, TypeScript/lint/diff đạt; bounded checked mutations |
| CP3 — URL-owned UI/navigation | Hoàn tất tại `a3191b5` | Focused/regression `43/43`, TypeScript/lint/diff đạt |
| CP4 — Browser/docs completion | Đã triển khai; final checkpoint pending | Full Vitest `415/415`; C2/C1 smoke `3/3 + 3/3`; build đạt |

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

## Implementation verdict

- Size: **Large/high-risk**, one PR with four sequential implementation checkpoints.
- Owner-decision validation: cả sáu verdict là **Confirmed with refinement**; không có decision bị reject hoặc material scope/dependency/semantic conflict.
- Planning self-review lịch sử: **Pass — `0 Critical`, `0 Required` còn mở**.
- Runtime confidence: CP1 tests xác minh exact query composition; isolated local Supabase smoke xác nhận aggregate/RLS/query behavior thực tế.
- Full gates post-review: Vitest `46 files / 415 tests`, TypeScript, targeted lint, C2 seeded browser `3/3`, C1 regression browser `3/3`, production build đều đạt.
- Formal self-review finding `Required` về historical/seeded FSRS metadata thiếu `learning_steps` đã được sửa bằng input default + update regression; re-review còn `0 Critical`, `0 Required` mở.
- Specialist: `0`; actual diff/evidence không để lại hard-risk cluster cần escalation.
- Verdict: **Implementation review passed; manual QA pending** cho subjective visual/full-keyboard confidence; đây không phải automated/release blocker theo current evidence. Final checkpoint/push được phép; không tạo PR, merge, deploy hoặc mutate remote/production DB.
