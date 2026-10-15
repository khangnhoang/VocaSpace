# Future Product Directions

## Status and authority

This document records explicit Owner direction that is intentionally outside the current UI-2 Product Language acceptance scope. It is not an accepted design specification, implementation plan, runtime requirement, or permission to change product code. Future work must perform its own repository discovery, bounded design, Owner acceptance, and implementation authorization.

## Theme direction

- Learning Experience (LE/student) should eventually support both light and dark themes.
- Teacher Authoring (TA/teacher) should eventually support both light and dark themes.
- Admin is dark-only; the accepted [Admin screen-type design](./screen-types/admin-business-operations.md) owns its dark values.

UI-2 does not implement or fully specify dark mode. The current Product Language may define a light reference, but its semantic ownership and token mapping must not make these future theme directions structurally incompatible. Future theme work owns exact dark values, contrast verification, component/surface mappings, persistence or preference behavior, transition behavior, and runtime rollout.

## Public homepage hero direction

The public/user-facing homepage should eventually move away from the current slideshow/carousel toward one premium hero with:

- one strong key visual;
- one large headline;
- one primary call to action;
- one secondary call to action; and
- VocaSpace-specific content rather than generic SaaS presentation.

This is a future homepage surface direction, not a global Product Language layout rule. The homepage plan must reconcile it with the actual homepage content, route behavior, responsive composition, accessibility, performance, asset ownership, and current implementation before any code change.

## Floating sheet direction

(Owner, 2026-10-14.) Side panels built on `components/ui/sheet.tsx` should become a floating panel instead of a full-height drawer stuck to the screen edge:

- about 80–90% of the viewport height;
- all four corners rounded; and
- inset from the right edge (and top and bottom) instead of touching it.

The trigger case is the learner course outline sheet "Duyệt chương học" (`app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx`); the AD3 admin course summary (`app/admin/courses/_components/course-summary-sheet.tsx`) uses the same default sheet. The Owner wants a component design for it, like `components/button.md`, as a shared sheet variant rather than a one-off restyle. Future work owns the exact sizes, small-screen behavior, motion, focus and the migration of existing sheets.

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

The account-menu switch in the current TA review aid is non-authoritative review chrome and interaction evidence only. This future direction does not amend the accepted Product Language, require a Teacher-specific setting, define preference precedence or persistence, or authorize runtime implementation. The placement direction is the avatar (account) dropdown, per the Owner direction below. Persistence, precedence and the detailed design stay future work, which must receive separate Owner acceptance and implementation authority.

Owner direction of 2026-10-15 for where the preference lives: the control belongs in the avatar (account) dropdown, as a toggle whose track uses a Route-to-Action blue gradient and whose knob animates when it is switched, and the reduced-motion setting is off by default, which is the same default behaviour as `ON` above (normal motion); whether the label reads as "animation" or as "reduce motion" is a future design decision this list does not settle. A gradient track is a gradient use outside the data-bar exception in the Admin screen-type design and would need its own accepted exception. The operating-system `prefers-reduced-motion` signal stays respected independently, and persistence and precedence between the two stay future work. This direction is not part of the Admin screen-type acceptance and is not a runtime change.
