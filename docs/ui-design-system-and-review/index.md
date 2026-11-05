# UI Design Sources

This index routes only to Owner-accepted design artifacts. Plans, progress records, review aids, future directions, and candidates remain outside the accepted-source route.

**How changes are approved** (see the [Master Plan lifecycle](./plan.md#design-artifact-lifecycle)): a new page or redesign builds on the product language, its screen-type design and the component contracts below, with no per-page brief, and needs Owner review of the running screen before merge; a page whose screen type has no accepted design here is raised as an Owner question at planning; a change to product language, a screen-type design, or a shared-component contract (including a new palette or geometry), or to interaction semantics, cross-surface behavior, accessibility, or destructive confirmation, needs an explicit Owner decision; anything smaller ships with an Owner-approved PR and no spec ceremony. Each entry records its acceptance date and the commit or PR that carries the accepted content. Git keeps the history.

## Accepted product language

- [VocaSpace Product Language](./product-language.md) — `Accepted` 2026-09-27; Admin dark-values ownership amended 2026-10-15; product-wide motion duration limits retired by Owner instruction 2026-11-05. Shared product identity and semantic intent for Learning Experience and Teacher Authoring.

## Accepted screen-type designs

- [Learning Experience](./screen-types/learning-experience.md) — `Accepted` 2026-09-27 at `70813c9`. Learner hierarchy, feedback, progress, recall, completion, responsive behavior, and accessibility.
- [Teacher Authoring](./screen-types/teacher-authoring.md) — `Accepted` 2026-09-28 at `5c79043`. Teacher portfolio, insight/action hierarchy, scalable Structure, focused topic authoring, recovery, responsive behavior, and accessibility.
- [Admin Business Operations](./screen-types/admin-business-operations.md) — `Accepted` 2026-10-15; accepted content in this PR. Admin dark palette and hierarchy, tables and row actions, as-you-type search, confirmations, dashboard charts, tab-style selectors, responsive behavior, motion, and accessibility.

## Accepted shared-component contracts

- [Button](./components/button.md) — `Accepted` 2026-09-29; current content at `a14939f` (radius correction, 2026-09-30). Reusable Button semantics, geometry, interaction treatment, icon and accessibility behavior, motion, and composition boundaries.

## Accepted surface specifications

Reference briefs for their routes. New pages do not need one; a PR that makes part of one wrong fixes or removes that part in the same PR.

- [Teacher Course Structure](./surfaces/teacher/course-structure.md) — `Accepted` 2026-10-02 as a design brief and the surface template (PR #116). Route-specific composition of `/teacher/courses/[id]/structure` on top of Product Language, Teacher Authoring, and Button.
- [Learning Workspace and Public Preview](./surfaces/learner/learning-workspace.md) — `Accepted` 2026-10-09 as a design brief by Owner review of the running local UI; accepted content at `c819416`. Route-specific composition of `/learn/[course-slug]/[topic-slug]` and `/courses/[course-slug]/preview/[topic-slug]` on top of Product Language, Learning Experience, and Button.

Continuing capability and initiative navigation: [UI/UX design charter](../programs/ui-ux-design/README.md). This index and its accepted artifacts retain design-decision ownership.
