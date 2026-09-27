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

## Learning streak direction

Learning Experience may later use a compact learning-streak metric as supporting context when the runtime owns truthful learning-history data. Current UI-2 work must omit streak rather than derive it from topic completion, flashcard review dates, or other proxy signals.

Future streak work owns the history model, day and timezone boundary, qualifying activity, repair/freeze behavior if any, privacy and reset semantics, and the surface-specific presentation. This direction is not permission to add persistence, analytics, gamification, or a placeholder streak to the current LE candidate.

## Global animation preference direction

VocaSpace may later expose a product-level animation preference through global account/settings ownership:

- default `ON` uses the accepted normal motion language;
- `OFF` requests reduced or no optional motion;
- the switch communicates `ON` with its knob on the right and a restrained Route/Action blue track;
- the switch communicates `OFF` with its knob on the left and a quiet neutral track; and
- the platform/browser `prefers-reduced-motion` signal remains respected independently of any explicit product preference.

The account-menu switch in the current TA review aid is non-authoritative review chrome and interaction evidence only. This future direction does not amend the accepted Product Language, require a Teacher-specific setting, define preference precedence or persistence, authorize runtime implementation, or decide the final account/settings placement. Future product-level work owns those decisions and must receive separate Owner acceptance and implementation authority.
