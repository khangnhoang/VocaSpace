# UI Design Sources

This index routes only to Owner-accepted design artifacts. Plans, progress records, review aids, future directions, and candidates remain outside the accepted-source route.

**How changes are approved** (see the [Master Plan lifecycle](./plan.md#design-artifact-lifecycle)): a new surface or redesign needs a brief and Owner review of the running result; a change to a source below the surface level, or to interaction semantics, cross-surface behavior, accessibility, or destructive confirmation, needs an explicit Owner decision; anything smaller ships with an Owner-approved PR and no spec ceremony. Each entry records its acceptance date and the commit or PR that carries the accepted content. Git keeps the history.

## Accepted product language

- [VocaSpace Product Language](./product-language.md) — `Accepted` 2026-09-27; current content at `a14939f` (Button radius correction, 2026-09-30). Shared product identity and semantic intent for Learning Experience and Teacher Authoring.

## Accepted screen-type designs

- [Learning Experience](./screen-types/learning-experience.md) — `Accepted` 2026-09-27 at `70813c9`. Learner hierarchy, feedback, progress, recall, completion, responsive behavior, and accessibility.
- [Teacher Authoring](./screen-types/teacher-authoring.md) — `Accepted` 2026-09-28 at `5c79043`. Teacher portfolio, insight/action hierarchy, scalable Structure, focused topic authoring, recovery, responsive behavior, and accessibility.

## Accepted shared-component contracts

- [Button](./components/button.md) — `Accepted` 2026-09-29; current content at `a14939f` (radius correction, 2026-09-30). Reusable Button semantics, geometry, interaction treatment, icon and accessibility behavior, motion, and composition boundaries.

## Accepted surface specifications

- [Teacher Course Structure](./surfaces/teacher/course-structure.md) — `Accepted` 2026-10-01; current content at `6e771ce`. Route-specific composition of `/teacher/courses/[id]/structure` on top of Product Language, Teacher Authoring, and Button.
