---
name: frontend-ui-review
description: Rendered UI review of a running VocaSpace screen against Owner-accepted design sources. Use for an explicit rendered UI review, or at a substantial new-page, major-redesign, or shared-visual-change checkpoint when an accepted design applies and a runnable target exists. Returns a domain result with evidence and classified findings; never a merge or approval verdict.
---

# Frontend UI Review

## Activation scope

Use this skill when:

* the Owner or a workflow explicitly asks for a rendered UI review of a running screen; or
* a checkpoint delivers a substantial new page, a major redesign, or a shared visual change (for example a changed shared component contract), an Owner-accepted design source applies to it, and a runnable target exists.

Do not use it for:

* code, diff, or source-only review (`code-review-and-quality`);
* visual-direction critique or design proposals without a running target (`frontend-design`);
* small copy, cosmetic, or focused responsive fixes;
* functional browser QA, smoke/E2E tests, or Playwright debugging (`frontend-workflow`, `test-quality-strategy`, `playwright-cli`);
* authoring or revising a product language, screen-type design, component contract, or surface specification (`frontend-design` and its common-design authoring guidance);
* permission-only questions about whether an action is allowed.

If the skill is activated but an accepted design source, runnable target, fixture, or required state is missing or unreachable, it still applies: return `blocked` or list the affected coverage as `not_run`. Never claim design fidelity without the accepted source and the observed state, and never treat current CSS or components as the design standard.

## Ownership

This skill owns the rendered review method, its evidence record, finding classification, and the domain result.

It does not own:

* design rules, tokens, or accessibility thresholds (`frontend-design` and the accepted sources under `docs/ui-design-system-and-review/`);
* browser-driving commands (`playwright-cli`);
* state matrix, fixture readiness, and verification scope (`test-quality-strategy`);
* environment readiness and manual-validation procedure (`frontend-workflow`);
* the integrated readiness verdict, severity taxonomy, or merge readiness (`code-review-and-quality`).

Route to those owners instead of restating their rules.

## Authority

Activation is not permission. A review does not authorize a database reset, fixture mutation (including the owning fixture's documented local commands, unless the current task already authorizes them), server restart, code or CSS fix, design or specification edit, commit, push, PR action, or deployment. Each needs its own current Owner permission.

A domain result never contains `Approved`, a merge or readiness verdict, or approval of a design or specification change. A successful review does not retroactively accept a different design.

## Review inputs

Record before observing:

1. **Target:** exact revision (commit SHA and dirty-tree state), route, and how it is served (local dev, preview build).
2. **Accepted sources:** every applicable source from `docs/ui-design-system-and-review/index.md` (product language, screen-type design, shared-component contract, surface specification) with its revision or recorded hash. Drafts, candidates, plans, and progress files are not accepted sources.
3. **Fixture:** role and data state from a deterministic fixture whose readiness was established under `test-quality-strategy`.
4. **Matrix:** states × viewports × input modality the review must cover, selected from the accepted sources and `test-quality-strategy`:
   * viewport widths that the accepted sources name, at least one wide and one narrow;
   * fine pointer and touch;
   * keyboard-only journey with focus order and focus return;
   * reduced motion where the design specifies motion;
   * 200% zoom and 320px width where the accessibility baseline applies;
   * each role that sees a different surface (for example read-only versus editor).
5. **Journey:** the user task to perform end to end. Screenshots alone are not a review.

If an input cannot be established, stop that part of the review and record it as `blocked` or `not_run` with the reason.

## Observation

Drive the browser through `playwright-cli`. Perform the journey in each matrix cell that the environment can reach. For states that need forced conditions (loading, load or save failure, stale data, rejected action), use a mocked request or an aborted action when the owning skills allow it; otherwise record `not_run` with the reason.

Measure what is measurable, as `frontend-design` requires: compute contrast from rendered colors, inspect rendered target geometry, zoom behavior, focus order, and live-region announcements. Do not estimate a threshold visually. Report any threshold not checked as `not_verified`.

Earlier evidence, including a previous review or an implementation checkpoint's browser matrix, is historical. Revalidate it before presenting it as current.

Keep raw screenshots and traces in ignored output such as `test-results/`. Refer to them by path; do not commit them.

## Finding classes

Assign every observation exactly one class:

* **(A) Contract mismatch** — the rendered UI differs from an accepted source. Cite the source and section, give the reproducible state (role, fixture, viewport, modality, steps), give a correction direction, and name the cause: `implementation_drift`, `stale_specification`, or `proposed_design_change`.
* **(B) Usability or accessibility mismatch** — a measured failure of a `frontend-design` accessibility threshold or of a stricter accepted contract, or a demonstrable user impact (blocked task, lost input, misleading state). Give the measurement or the observed impact and the reproducible state.
* **(C) Design recommendation** — supported by observed hierarchy, rhythm, density, legibility, motivation, interaction cost, or coherence. Advisory to the Owner and never blocking. A preference with no accepted contract and no demonstrable user impact can only be (C).

Do not invent a blocking rule from taste. Do not reclassify a (C) as (A) because a source is silent. When the accepted source itself appears wrong, record (A) with cause `stale_specification` or `proposed_design_change`; the source owner decides.

Functional defects found during the journey are reported as observed behavior for `code-review-and-quality`; they do not become design findings.

## Domain result

Return one domain result with exactly one status:

| Status | Meaning |
| --- | --- |
| `conformant_within_observed_scope` | Every required matrix cell was observed and no (A) or (B) finding exists; the claim covers only the recorded matrix |
| `mismatches_found` | At least one (A) or (B) finding exists; unobserved required cells are still listed |
| `incomplete` | Some required cell is `not_run` or `not_verified` and no (A) or (B) finding was observed in the rest |
| `blocked` | A required input (accepted source, runnable target, fixture, or environment) is missing, so the review could not meaningfully start |

The result contains:

* target, accepted sources with revision or hash, fixture, and environment;
* the matrix, with each cell `observed`, `not_run`, or `not_verified` and a reason for every non-observed cell;
* findings grouped by class, each with its evidence;
* functional observations handed to code review;
* the status.

`code-review-and-quality` consumes the domain result as evidence and keeps the integrated verdict. A tracked plan or progress source may record a concise summary; it is the owner of that summary, not this skill.

## Stop conditions

Stop and report instead of guessing when:

* no applicable accepted source exists, or the accepted source does not match the revision under review;
* the target cannot be run or the fixture cannot reach the required role or data state;
* continuing would need a product fix, a design or specification change, or an action outside current permission;
* the review is asked to issue a merge, readiness, or approval verdict.

When stopping, list the affected coverage as `blocked` or `not_run` and name the smallest input or the specific Owner permission needed to resume (for example "restart the local dev server" or "recreate the previewer fixture account with its documented command"). When declining a requested action outside current permission, such as a code or CSS fix, ask the Owner for that specific permission instead of citing only a tool or environment limit.
