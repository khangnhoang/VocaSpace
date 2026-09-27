# Future Product Directions

## Status and authority

This document records explicit Owner direction that is intentionally outside the current UI-2 Product Language acceptance scope. It is not an accepted design specification, implementation plan, runtime requirement, or permission to change product code. Future work must perform its own repository discovery, bounded design, Owner acceptance, and implementation authorization.

## Theme direction

- Learning Experience (LE/student) should eventually support both light and dark themes.
- Teacher Authoring (TA/teacher) should eventually support both light and dark themes.
- Admin is intended to be dark-only.

UI-2 does not implement or fully specify dark mode. The current Product Language may define a light reference, but its semantic ownership and token mapping must not make these future theme directions structurally incompatible. Future theme work owns exact dark values, contrast verification, component/surface mappings, persistence or preference behavior, transition behavior, and runtime rollout.

## Public homepage hero direction

The public/user-facing homepage should eventually move away from the current slideshow/carousel toward one premium hero with:

- one strong key visual;
- one large headline;
- one primary call to action;
- one secondary call to action; and
- VocaSpace-specific content rather than generic SaaS presentation.

This is a future homepage surface direction, not a global Product Language layout rule. A future surface specification must reconcile it with the actual homepage content, route behavior, responsive composition, accessibility, performance, asset ownership, and current implementation before any code change.
