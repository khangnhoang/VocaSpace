# Future features — UI/UX design

Charter: [README.md](./README.md). Directions below are not implementation authority. Transferred wording retains its original planning scope and dated evidence; this migration does not revalidate runtime status.

<a id="feat-017"></a>

## FEAT-017: Redesign the auth email templates

- Status: Deferred (Owner, 2026-10-07), a separate PR after A5.
- Direction: the confirmation, recovery and other Supabase Auth emails get a modern VocaSpace design and wording, including a "set your password" wording for accounts an admin creates.
- Why deferred: A5 reuses the existing recovery email for admin-created accounts (A5 plan §1.4 decision 5); the visual redesign is its own change.
- Pointers: [A5 plan](../auth-onboarding/implementation-plans/a5/plan.md) §1.4 decision 5.
- Target program: [UI/UX design](./README.md).
- Legacy identity: auth-onboarding:FEAT-005.

<a id="feat-018"></a>

## FEAT-018: Theme direction

- Status: Deferred; direction only, requiring its own acceptance and implementation authority.
- Direction: Theme direction; the complete Owner direction and limits follow below.
- Target program: [UI/UX design](./README.md).

- Learning Experience (LE/student) should eventually support both light and dark themes.
- Teacher Authoring (TA/teacher) should eventually support both light and dark themes.
- Admin is dark-only; the accepted [Admin screen-type design](../../ui-design-system-and-review/screen-types/admin-business-operations.md) owns its dark values.

UI-2 does not implement or fully specify dark mode. The current Product Language may define a light reference, but its semantic ownership and token mapping must not make these future theme directions structurally incompatible. Future theme work owns exact dark values, contrast verification, component/surface mappings, persistence or preference behavior, transition behavior, and runtime rollout.

<a id="feat-019"></a>

## FEAT-019: Public homepage hero direction

- Status: Deferred; direction only, requiring its own acceptance and implementation authority.
- Direction: Public homepage hero direction; the complete Owner direction and limits follow below.
- Target program: [UI/UX design](./README.md).

The public/user-facing homepage should eventually move away from the current slideshow/carousel toward one premium hero with:

- one strong key visual;
- one large headline;
- one primary call to action;
- one secondary call to action; and
- VocaSpace-specific content rather than generic SaaS presentation.

This is a future homepage surface direction, not a global Product Language layout rule. The homepage plan must reconcile it with the actual homepage content, route behavior, responsive composition, accessibility, performance, asset ownership, and current implementation before any code change.

<a id="feat-020"></a>

## FEAT-020: Floating sheet direction

- Status: Deferred; direction only, requiring its own acceptance and implementation authority.
- Direction: Floating sheet direction; the complete Owner direction and limits follow below.
- Target program: [UI/UX design](./README.md).

(Owner, 2026-10-14.) Side panels built on `components/ui/sheet.tsx` should become a floating panel instead of a full-height drawer stuck to the screen edge:

- about 80–90% of the viewport height;
- all four corners rounded; and
- inset from the right edge (and top and bottom) instead of touching it.

The trigger case is the learner course outline sheet "Duyệt chương học" (`app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx`); the AD3 admin course summary (`app/admin/courses/_components/course-summary-sheet.tsx`) uses the same default sheet. The Owner wants a component design for it, like `components/button.md`, as a shared sheet variant rather than a one-off restyle. Future work owns the exact sizes, small-screen behavior, motion, focus and the migration of existing sheets.

<a id="feat-021"></a>

## FEAT-021: Global animation preference direction

- Status: Deferred; direction only, requiring its own acceptance and implementation authority.
- Direction: Global animation preference direction; the complete Owner direction and limits follow below.
- Target program: [UI/UX design](./README.md).

VocaSpace may later expose a product-level animation preference through global account/settings ownership:

- default `ON` uses the accepted normal motion language;
- `OFF` requests reduced or no optional motion;
- the switch communicates `ON` with its knob on the right and a restrained Route/Action blue track;
- the switch communicates `OFF` with its knob on the left and a quiet neutral track; and
- the platform/browser `prefers-reduced-motion` signal remains respected independently of any explicit product preference.

The account-menu switch in the current TA review aid is non-authoritative review chrome and interaction evidence only. This future direction does not amend the accepted Product Language, require a Teacher-specific setting, define preference precedence or persistence, or authorize runtime implementation. The placement direction is the avatar (account) dropdown, per the Owner direction below. Persistence, precedence and the detailed design stay future work, which must receive separate Owner acceptance and implementation authority.

Owner direction of 2026-10-15 for where the preference lives: the control belongs in the avatar (account) dropdown, as a toggle whose track uses a Route-to-Action blue gradient and whose knob animates when it is switched, and the reduced-motion setting is off by default, which is the same default behaviour as `ON` above (normal motion); whether the label reads as "animation" or as "reduce motion" is a future design decision this list does not settle. A gradient track is a gradient use outside the data-bar exception in the Admin screen-type design and would need its own accepted exception. The operating-system `prefers-reduced-motion` signal stays respected independently, and persistence and precedence between the two stay future work. This direction is not part of the Admin screen-type acceptance and is not a runtime change.

<a id="feat-025"></a>

## FEAT-025: Return to `/learn` after sign-in

- Status: Deferred (Owner, 2026-11-09) by [U3 plan](./implementation-plans/u3-auth-pages-redesign/plan.md) decision 14.
- Direction: a signed-out learner whom a `/learn…` page sends to `/login` returns to that page after signing in, as U3 does for `/teacher`, `/profile` and `/admin`.
- Why deferred: the `/learn` pages cannot write cookies while rendering, and the proxy cannot tell a production link prefetch from a navigation, while the header shows the "Học tập" link to every visitor. A design must prove on a production build that prefetch never records the path, and must keep U3 G1 (never read from the query).
- Target program: [UI/UX design](./README.md).
