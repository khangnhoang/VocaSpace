# ADR: Student/user flow and route namespace refactor

## Status

Accepted.

This ADR records the route and user-flow decisions for the upcoming VocaSpace student/user flow refactor. It is documentation-only and does not implement the refactor.

Implementation status note (2026-07-11): Wave A has completed the teacher hard cut to
`/teacher/courses`, and PR B1 checkpoints B1.1–B1.6 have established public `/courses`
catalog/detail while retaining legacy `/learn/[course-slug]` temporarily. The context
below is the decision-time baseline; B2/B3 and later learning-route work remain pending.

## Context

VocaSpace currently has teacher authoring under `/courses`, while product direction needs `/courses` to become the public course catalog. Student learning routes also need clearer separation:

- `/` should remain public homepage/landing.
- `/courses` should become public catalog.
- `/courses/[course-slug]` should become public course detail.
- `/learn` should become authenticated student dashboard.
- `/learn/[course-slug]` should become enrolled course overview.
- `/learn/[course-slug]/[topic-slug]` should remain the learning workspace.
- `/profile` should return to account/profile management.

The project uses `proxy.ts` with `utils/supabase/middleware.ts` for route/session behavior. The current proxy guard already targets `/teacher`, which aligns with the target teacher namespace after teacher authoring moves to `/teacher/courses`.

## Decision

The refactor will be staged in waves:

1. Hard cut teacher authoring from `/courses` to `/teacher/courses`.
2. Create public `/courses` catalog and `/courses/[course-slug]` detail after teacher routes move away.
3. Build `/learn` as the authenticated student dashboard.
4. Reclaim `/learn/[course-slug]` as enrolled course overview after old public detail redirects to `/courses/[course-slug]`.
5. Harden `/learn/[course-slug]/[topic-slug]` so the topic slug from URL is the source of truth.
6. Keep preview, memory check, server-side completion truth, Google OAuth, and deeper review/payment UX as later backlog.

## Consequences

Positive consequences:

- `/courses` becomes available for public catalog without teacher route ambiguity.
- Teacher route protection better matches the existing `/teacher` guard in `proxy.ts`.
- Student learning UX gains a clear home at `/learn`.
- `/profile` can stay focused on account/profile management.
- Public course discovery and enrolled learning no longer share the same semantic route.
- Future memory check and analytics work gets an explicit architecture boundary.

Costs and risks:

- Teacher route migration touches helpers, navigation, breadcrumbs, back links, imports, tests, revalidation paths and docs.
- No legacy teacher redirect means old teacher URLs intentionally break after the hard cut.
- Public detail transition must be ordered carefully so `/learn/[course-slug]` does not collide with enrolled overview.
- Dashboard data contracts for `/learn` need careful scoping to avoid overfetching.
- Workspace route hardening must avoid writing progress to the wrong topic.

## Alternatives considered

### Keep teacher authoring under `/courses`

Rejected. This blocks `/courses` from becoming public catalog and keeps public/teacher route semantics mixed.

### Duplicate teacher UI under both `/courses` and `/teacher/courses`

Rejected. The app has no real users yet, so preserving old teacher URLs is unnecessary. Duplication would create two canonical surfaces, stale link risk, and extra test burden.

### Add temporary redirects for old teacher `/courses/*`

Rejected. Old teacher route preservation is not needed. A hard cut keeps the namespace migration simpler and makes stale references fail loudly during development.

### Make `/learn` the public catalog

Rejected. `/learn` should mean authenticated learning area. Public catalog belongs at `/courses`.

### Keep `/profile` as learning dashboard

Rejected. Profile should manage account/profile information. Learning progress, enrolled courses, due cards, next topic and pending payment reminder belong under `/learn`.

### Implement memory check immediately with a generic `type`

Rejected. Memory check is required later, but it is a usage/activity stage, not a question analytics category. A generic overloaded `type` would make future analytics ambiguous.

## Why no old teacher route redirects are needed

The project has no real users yet, so preserving old teacher `/courses/*` URLs is unnecessary. Redirects would add temporary behavior that must later be removed, increase test surface, and make stale internal links harder to find. The chosen approach is a hard cut: move teacher authoring to `/teacher/courses`, update all internal references, and let old teacher URLs stop being valid.

## Why `/courses` should be public catalog

`/courses` is the natural product URL for a public course catalog. It should list public/published courses and serve users who are discovering content before enrollment. Teacher authoring is a private/role-based workflow, so it belongs under `/teacher/courses` instead.

## Why `/learn` should be student dashboard

`/learn` should represent the authenticated learning area. It should show enrolled courses, continue learning, next topic, progress, due flashcards summary, and pending payment reminder. It should not be a public course gallery because public discovery belongs under `/courses`.

## Why `/profile` should not remain the learning dashboard

Profile/account management and learning progress are different user jobs. Keeping learning dashboard inside `/profile` makes the core student flow harder to find and couples account settings to learning state. `/profile` can keep a small shortcut to learning/review, but the main learning UX belongs under `/learn`.

## Why memory check must not overload future question analytics architecture

Memory check is part of the activity flow: flashcards -> memory check -> exercises. It does not describe what skill a question tests. Future Study4-like analytics may need categories such as grammar, vocabulary, main purpose, detail, inference, reference, word form or collocation.

Future planning should keep these concepts separate:

- Question category / skill type: what ability the question tests.
- Answer format: how the answer is presented.
- Usage stage / activity stage: where the question is used.

This lets a memory-check question still be categorized as vocabulary recall, and a normal exercise question still be categorized as grammar or inference.

## Why pending payment reminder uses `sessionStorage` keyed by `paymentId`

The dashboard reminder is lightweight and session-local. It should not permanently hide a pending payment across sessions or devices. `payments.id` is unique, so `paymentId` is a stable key for dismissing a specific active pending payment in `sessionStorage`.

Dismissal only applies while that payment is still `pending`. If the payment becomes `paid`, `cancelled`, `expired`, or `failed`, the dashboard query should naturally stop returning it as active pending, and the reminder disappears regardless of local dismissed state.

## Implementation notes

- Wave A should update `lib/course-authoring/routes.ts`, teacher navigation, breadcrumbs, back links, imports, revalidation paths, tests and docs.
- `proxy.ts` should not be treated as missing middleware. It is the route/session entry point for this project.
- Public `/courses` should not be implemented until teacher authoring has moved away.
- Old public `/learn/[course-slug]` should redirect only after `/learn` dashboard is working.
- Memory check, preview and topic completion truth require later schema/action/RLS/progress audits.

## Verification expectations

- Route helper and navigation tests should assert the new teacher namespace.
- Revalidation tests should assert `/teacher/courses` paths where applicable.
- Proxy/session behavior should be verified for unauthenticated `/teacher/*`.
- Public catalog/detail should be verified separately after Wave A.
- Student dashboard and workspace should have data-state tests and manual QA for empty, enrolled, pending payment, invalid topic, locked topic and direct URL states.

## Related documents

- [plan.md](../refactors/student-user-flow-route/plan.md)
- [progress.md](../refactors/student-user-flow-route/progress.md)
- [problems.md](../refactors/student-user-flow-route/problems.md)
