# Manual UI validation

Read this reference before planning, running, or reporting browser/manual UI validation. Read the responsive subsection when responsive behavior is material. The core `SKILL.md` remains authoritative for approval, scope, evidence claims, stop, and reporting behavior; `test-quality-strategy` owns its manual-QA state matrix, fixture-readiness gate, and verification-scope rules.

Browser QA begins only after the relevant implementation is stable, focused automated checks are green, required fixtures exist, and the local environment is ready. Use the manual-QA state matrix, fixture-readiness gate, and verification-scope rules owned by `test-quality-strategy` rather than redefining them here.

Prepare and execute browser QA as one deliberate pass:

1. Define the exact observable checks first.
2. Reuse the existing deterministic fixture.
3. Reuse the current local server and browser session when healthy.
4. Perform the planned viewport and interaction matrix.
5. Record observed results.
6. Stop rather than expanding into unrelated visual polish.

Do not start browser QA before required data exists; repeatedly reset or recreate seed data; restart Supabase or the dev server when a healthy process can be reused; open multiple browser-QA phases for the same unchanged implementation; reread database, migration, or backend documentation for a focused frontend composition task; or reopen broad discovery during visual refinement.

For focused UI refinement, browser QA may be explicitly deferred to the owner. Respect instructions such as `no browser QA`, `no tests`, `targeted tests only`, or `implement and stop for owner manual QA`; report the deferred checks as pending without converting them into success claims.

Create a task-specific checklist with exact actions and expected results.

Cover as applicable:

* required role/data and route
* required responsive viewports
* primary and destructive flows
* loading/pending and failure recovery
* long, null, missing, and empty data
* permission/status variants
* keyboard, focus, labels, and dialog accessibility

Execute available checks. Mark visual or environment-dependent checks pending and request user confirmation.

Do not claim full UI validation while required checks remain pending.

Do not ask the owner to repeatedly run smoke/E2E checks for ordinary refactor checkpoints. Request smoke/E2E only when the change touches a critical browser workflow, crosses client/server/auth/persistence boundaries, or lower-level verification cannot prove the risk.

## Responsive QA matrix

For responsive interfaces, verify the repository-defined minimum supported width, 375px mobile, tablet or narrow desktop where relevant, and normal desktop. If the repository defines no minimum, verify both 320px and 375px; one successful 375px screenshot does not prove smaller supported widths are safe.

At each relevant viewport, verify interaction and layout behavior, not only screenshots:

* no horizontal page overflow, including `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
* flex/grid children can shrink and relevant containers use safe wrapping or `min-width: 0` where needed
* text and CTA labels do not escape cards
* section ordering matches the approved mobile hierarchy
* dialogs, sheets, menus, cards, and payment/course rows remain usable
* desktop-only composition does not clip content at small widths

For focused UI refinement, keep verification limited to the affected composition, viewports, and interactions unless observed evidence shows broader risk.
