# C2 owner-review brief — Workspace Route Hardening

## Quyết định cần owner duyệt trước implementation

- URL `/learn/[course-slug]/[topic-slug]` là source of truth duy nhất cho current topic.
- Sidebar/previous/next dùng canonical topic links/navigation với history push; direct URL, refresh, back và forward phải render đúng topic của URL.
- Không còn invalid-topic fallback sang topic đầu tiên.
- Workspace có explicit `auth_required`, `course_not_found`, `unenrolled`, `topic_unavailable`, `success`, `error` states.
- `topic_unavailable` gộp invalid/nonexistent/draft/removed/wrong-course thành privacy-safe route-local feedback; không invent preview lock semantics.
- Dedicated server contract kiểm tra parse → auth → published active course → enrollment → active published exact topic thuộc course → content/history.
- Affected progress/card-review writes phải derive/verify trusted topic relation trước mutation; legacy card-review auto-enrollment bị loại.
- Completion flags/FSRS/exercise correctness giữ semantics hiện tại; final completion, memory check và preview vẫn deferred.
- Detailed contract: [plan.md](./plan.md). Brief này không override plan.

## Baseline và quyền hiện tại

- Branch: `feat/workspace-route-hardening`.
- Baseline: `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`.
- PR #75/C1 đã merge tại chính baseline; dependency C1 đã thỏa mãn.
- Planning package đã được phép discovery, self-review, commit và push một lần.
- Application implementation chưa được phép trong phiên này; cần owner approve plan hoặc instruction implementation mới.

## Checkpoints và gates

| Checkpoint | Outcome | Gate |
| --- | --- | --- |
| P0 — Planning delivery | Reconcile source of truth, C2 plan/brief/status docs, self-review, planning commit/push | Link/stale/scope audit, `git diff --check`, staged diff, no app changes |
| CP1 — Route/read/access contract | Strict route params/result DTO; exact course-topic binding; classified access/content state | Focused action/schema + C1/B2 regressions, TypeScript, targeted lint, diff check |
| CP2 — Write-context hardening | Progress/review relation validation, topic-scoped history, remove auto-enrollment | Focused progress/review/dashboard regressions, TypeScript, targeted lint, diff check |
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

## Fixture readiness

Existing `supabase/seed.sql` đủ cho enrolled ordered topics, card-backed direct topic, wrong-course topic, draft/removed topic, authenticated unenrolled course/topic và deterministic invalid/nonexistent URLs. Không cần migration/RLS/seed theo discovery hiện tại.

## Scope cấm và stop conditions

Không chạm memory check, final completion truth, exercise correctness semantics, preview/30%/collaborator access, global 404, mobile account menu, Wave D, shared primitives/packages hoặc DB schema/RLS/RPC/seed.

Dừng và xin owner decision nếu route trust cần migration/RLS, preview contract, completion/exercise rewrite, shared B2/C1 output change, payment/enrollment redesign hoặc broad workspace/global navigation redesign.

## Planning verdict

- Size: **Large/high-risk**, one PR with four sequential implementation checkpoints.
- Main planning self-review: **Pass — không còn `Critical`/`Required` trong planning scope C2**; local links, C1 ancestry, stale status, scope/exclusions và docs-only diff gates đã đạt.
- Specialist: `0`; reconsider only after main implementation review if actual diff leaves one material hard-risk cluster unresolved.
- Implementation permission: **not granted** by this planning session.
