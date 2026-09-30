# UI-4 Detail Plan: Teacher Surface Pilot

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — the Owner accepted this plan and the recommended D1–D4 on 2026-09-30. Stage 1 authoring is authorized; the surface specification itself still needs its own Owner acceptance. |
| Program owner | [UI Design System and Rendered UI Review Master Plan](../../plan.md), workstream `UI-4` |
| Accepted design inputs | [Product Language](../../product-language.md), [Teacher Authoring](../../screen-types/teacher-authoring.md), and [Button](../../components/button.md) through the [accepted-source index](../../index.md) |
| Planning baseline | `main` and `origin/main` at `8ee3ff4e4812a1541ed7e121dc505dd48cf0cc06` (PR #109 merge; includes the UI-3 PR #107 merge) |
| Planning branch | `docs/ui-4-detail-plan` |
| Execution mode | `NORMAL`: one surface, one semantic owner per artifact, no unresolved cross-owner risk that would justify managed roles |
| Preliminary / final size | `Large`: a material Owner design gate, a published design artifact, a runtime rewrite of a permission- and ordering-sensitive workspace, and data-dependent browser QA |
| Current authority | Plan commit, `progress.md` reconciliation, and Stage 1 CP1.1 candidate authoring (2026-09-30). Surface-specification acceptance, Stage 2 runtime, fixtures, push, PR, and merge each need a separate explicit Owner instruction. |

The Master Plan requires UI-4 to deliver **one** Owner-accepted Teacher surface specification under `docs/ui-design-system-and-review/surfaces/` and a runnable pilot in the owning feature code. The pilot must make the primary creation journey and direct item editing observable, and it must match the accepted design.

## Binding Spec

### Outcome and acceptance

UI-4 is complete only when all of the following hold:

1. An Owner-accepted surface specification for the selected surface (D1) is published under `docs/ui-design-system-and-review/surfaces/teacher/` and routed from `index.md`. It composes Product Language, TA, and Button without redefining their values.
2. The runtime surface implements that specification within the current route, permission, persistence, and lifecycle contracts.
3. A Teacher can move from the surface into content creation (add chapter → add topic → open the topic builder) and can directly open, rename, reorder, hide, and restore an existing item without detouring through another destination.
4. With a small (1–3 chapter) and a large (≥ 20 chapter) course, the surface stays bounded. It never renders every chapter's topics at once, and a chapter can be found or jumped to efficiently.
5. At narrow widths, the surface uses sequential disclosure with an explicit way back. It does not overflow the page at 320px, and critical touch actions keep the accepted 44 × 44px target.
6. Loading, empty, error, pending move, failed move, read-only, stale-target, and deep-linked readiness-issue states behave as TA §9 and §12 require. Previously supported behavior is not lost.
7. Targeted automated tests and browser evidence at the planned states and viewports pass. Anything unobserved is reported as pending.

### Scope

- One surface, selected by D1. The recommendation is the Structure workspace at `/teacher/courses/[id]/structure`.
- The surface specification artifact and its index route.
- Runtime changes inside that surface's feature folder and its direct dialogs and sheets.
- Updates to existing tests and smoke E2E that assert the replaced interaction.
- Narrow additions to test fixtures (D3).
- A read-model extension only if D2 approves it.

### Non-goals

- Portfolio, Overview, and topic-builder redesign, except for links back to the selected surface.
- Analytics queries or projections, DB schema, RLS, RPC, migrations, or permission changes.
- Changes to route architecture, lifecycle, readiness order, preview-quota rules, or soft-delete semantics.
- Changes to shared primitives in `components/ui/*`, other than the already-accepted Button usage.
- New packages, the shadcn CLI, a virtualization library, or drag-and-drop.
- UI-5 (the rendered review skill), a dark theme, and normalizing unrelated screens.

### Necessary execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| Permission-derived controls (`canManage`, `canReorderChapters`, `isReadOnly`, `canEditContent`, `canManageStructure`, `canDeleteTopic`, `canManagePreviewMarkers`) keep exactly their current meaning; illegal actions stay absent rather than disabled-and-unexplained | A redesign widens or hides authoring authority |
| Existing Server Actions stay the only writers; ordering keeps the confirmed-server-order model (no optimistic reorder without rollback) | Persisted order or state diverges from what is shown |
| Deep-link issue contexts `course_has_no_chapters` and `chapter_has_no_topics`, return feedback, preview allocation/suspension notices, and the hidden-chapter restore path keep working | Overview → Structure repair journeys silently break |
| Only the selected chapter mounts topic detail | The large-course scale invariant (TA §7.1) is violated |
| Surface specification acceptance precedes dependent runtime work | Implementation invents material design decisions |
| No production data, remote database, or seed mutation without its own approval | Evidence work mutates shared state |

## Owner decisions (accepted 2026-09-30: D1–D4 as recommended)

| ID | Decision | Recommendation | Why it is the Owner's call |
| --- | --- | --- | --- |
| D1 | Which surface to pilot | **Structure** (`/teacher/courses/[id]/structure`) | The Master Plan leaves pilot selection to the Owner |
| D2 | Show a topic count for each chapter in the navigator | **Yes**, via one aggregated count added to the existing chapter read path. The action must still enforce membership, and the change needs no migration or RLS change | It widens the writer domain to a Server Action (`nextjs-server-action-zod`) |
| D3 | Source of the large-structure QA fixture | A **test-time fixture helper** that creates and cleans up its own course, following `e2e/support/d2-preview-fixture.ts`, with no `supabase/seed.sql` change | A seed change would enter the `supabase-safe-migration` domain and change shared local data |
| D4 | Fate of the per-chapter `TopicManagementSheet` on wide screens | **Replace** it with an inline selected-chapter workbench, keeping sequential disclosure on narrow screens. The final shape is decided in the Stage 1 surface specification | It changes an established interaction that smoke tests assert |

### D1 comparison (discovery evidence)

| Surface | Data readiness | Fit with the Master Plan acceptance | Main risk |
| --- | --- | --- | --- |
| **Structure** | `Direct`: `getChaptersByCourseId`, `getTopicsByChapterId`, `getCourseStats`, and the move, create, update, hide, and restore actions all exist | Directly exercises creation (chapter → topic → builder) and direct item editing | Ordering and permission regressions; it replaces a sheet that smoke tests assert |
| Portfolio `/teacher/courses` | Partial. `getCoursesForTeacher` exists, but no cross-course attention-queue read exists, which TA §4.1 requires | Continuation only; no item editing | Needs a new cross-course read that must respect permissions; the page also hosts the course edit form |
| Overview `/teacher/courses/[id]` | Analytics are `Derivable` or bounded later data work (TA §2) and need a new projection or RPC, which is excluded | Insight and next action; creation happens elsewhere | Only the no-data state could ship truthfully |
| Topic builder | `Direct` | Strong for item editing; weak for the course-level journey | The largest files (`ExerciseTab.tsx` 1272 lines, `AddExerciseDialog.tsx` 1104 lines) and strict lifecycle and review coupling |

Structure is the only candidate that meets the UI-4 acceptance without data work. The current runtime also diverges from TA in ways a pilot can show clearly:

- a card per chapter (`ChapterList.tsx`) instead of a dense list rhythm (TA §7.3);
- a four-card stats grid in `CourseStructureWorkspace.tsx` instead of a compact summary;
- topic detail only inside a per-chapter sheet, with no chapter search or jump (TA §7.1, §7.2).

The Owner selected D1 = Structure. Choosing another surface later requires a plan correction.

## Repository facts

- Route: `app/(teacher)/teacher/courses/[id]/structure/page.tsx`. It parses issue feedback and renders `CourseStructureWorkspace` (646 lines).
- `CourseStructureWorkspace` loads the chapter list, hidden chapters, stats, and access and preview projections on the client. It composes `ChapterList` (321 lines), `TopicManagementSheet` (717 lines), `ChapterFormModal`, `DeleteChapterModal`, `DeletedChaptersModal`, `DashboardIssueNotice`, `DashboardReturnFeedback`, and the preview controls.
- Chapter permission is computed in `getChaptersByCourseId`: owner and co-owner manage any chapter; an editor manages only chapters they created. Topics are loaded one chapter at a time by `getTopicsByChapterId`, together with per-topic capability flags from an RPC.
- Ordering uses up/down move actions (`moveChapterOrder`, `moveTopicOrder`) and a single `OrderingPendingState`. There is no drag-and-drop.
- Tests that assert the current interaction:
  - `e2e/smoke/course-structure.smoke.spec.ts` finds a chapter `article` and uses the "Quản lý bài học" sheet button;
  - `__tests__/components/topic-management-navigation.test.tsx`;
  - `__tests__/components/course-workspace-routes.test.tsx`;
  - the related smoke files `issue-deep-links` and `topic-create-navigation`.
- Fixtures: the `supabase/seed.sql` courses have 1–3 chapters. No local fixture has ≥ 20 chapters.
- Recent history: `39feb3a` fixed a 320px overflow in Structure and topic management. That fix is a regression guard for narrow widths.

### Conflicts and stale sources

- At planning time, `progress.md` still described UI-3 as "complete locally" although PR #107 had merged it. The Owner directed reconciliation, and `progress.md` now records merged delivery for UI-1 through UI-3.

## Bounded implementation hypotheses

These may change during implementation as long as the Spec and guardrails still hold:

- A navigator and workbench split inside `CourseStructureWorkspace`: `ChapterList` becomes a compact navigator; the topic list and actions extracted from `TopicManagementSheet` become a selected-chapter workbench. Existing dialogs are reused.
- The selected chapter lives in the URL (for example `?chapter=<id>`), so refresh, deep link, and back navigation keep context. The issue-context parameters keep priority.
- Chapter search is client-side filtering over the already loaded chapter list; no pagination or virtualization until measurement demands it.
- On narrow screens, the navigator and chapter detail are shown in sequence, with a back control that returns focus to the chapter that was opened.
- The D2 count comes from a second grouped query inside `getChaptersByCourseId` under the same membership check.

## Dependency graph

```text
D1–D4 Owner decisions
  → Stage 1: surface specification candidate → Owner acceptance → publication (index route)
  → Stage 2: runtime pilot (+ D2 read extension, if approved) → tests updated → fixture (D3) → browser QA
  → progress/State update
  → (later, separate) UI-5 pilot review
```

Hard dependency: Stage 2 must not start before the Stage 1 acceptance.

## Stages and Checkpoints

### Stage 1 — Accepted Structure surface specification

This Stage establishes an integrated outcome: a published, Owner-accepted surface contract that gates all runtime work.

- **CP1.1 Candidate:** write `docs/ui-design-system-and-review/surfaces/teacher/course-structure.md`. It covers:
  - the job and reading path;
  - wide and narrow composition;
  - the navigator and workbench contents;
  - the action tiers from TA §9, mapped to Button roles;
  - the state matrix (TA §9 recovery contract);
  - scale behavior for small and large courses;
  - focus, keyboard, and live-region behavior;
  - motion within TA §13;
  - the D2 decision;
  - explicit non-goals.

  It references inherited values rather than copying them. An optional non-authoritative rendered aid may be created outside the repository for the Owner's review.
- **CP1.2 Acceptance and publication:** after an explicit Owner acceptance of the exact candidate (record its SHA-256), set the status to `Accepted`, add an index route, and record acceptance in `progress.md`.

**Stage 1 exit:** the specification is published and accepted, the index routes only to accepted sources, and there is no runtime diff.

### Stage 2 — Runtime pilot

- **CP2.1 Implementation:**
  - implement the accepted specification in the Structure feature folder;
  - apply D2 if it was approved;
  - update the affected component tests and smoke E2E to the new interaction, keeping their guarantees: metadata edits, the hidden-parent topic guard, topic creation navigation, and issue deep links;
  - add component tests for selection, search or jump, permission-derived controls, pending and failed moves, and narrow-width back navigation.
- **CP2.2 Fixture and browser evidence:**
  - add the D3 large-structure fixture;
  - run browser QA on the matrix below;
  - record the evidence in `progress.md`;
  - update the specification only if accepted behavior intentionally changed, which requires the Owner.

**Stage 2 exit:** Spec acceptance items 2–7 are evidenced, or explicitly pending with their limits stated.

A final cumulative review is required, because correctness depends on design, runtime, tests, and fixtures composing across Stages.

## Verification strategy

| Boundary | Checks |
| --- | --- |
| Stage 1 (docs) | Relative links resolve; the index lists accepted sources only; `git diff --check`; author self-review against TA §7, §9, §11, §12, §13, §15. No product tests are claimed |
| CP2.1 | Focused Vitest for the changed component tests; `__tests__/actions` for D2 if applied, covering the membership-denied path; targeted ESLint and TypeScript on changed files; the affected smoke specs (`course-structure`, `issue-deep-links`, `topic-create-navigation`) against local Supabase |
| CP2.2 | Browser QA through `playwright-cli`, run once the fixture is ready |
| Merge readiness | Normal CI (`Test and Build`, `production-gate`) |

A full suite or build runs only for the final PR, or if a shared boundary changes.

### QA fixture readiness

- **QA type:** data-dependent browser QA with authenticated Teacher roles.
- **Canonical fixture source:** `supabase/seed.sql` (small courses; owner and editor collaborators) plus a new test-time helper (D3).
- **Existing covered states:**
  - small structure;
  - an empty chapter (`b2100000-0000-4000-8000-000000000012`);
  - an editor managing their own chapter versus another collaborator's chapter;
  - the preview fixtures.
- **Missing states:** a large structure (≥ 20 chapters, with one chapter holding ≥ 6 topics in mixed `draft`/`pending`/`published`), a hidden chapter to restore, and a read-only (previewer) actor on the same course.
- **Required fixture additions:** a D3 helper that creates the large course and those roles, and cleans them up.
- **Reset/setup:** local Supabase via the existing smoke setup; no remote database.
- **Fixture checkpoint:** CP2.2, before final browser QA.
- **Browser QA may begin when:** CP2.1 tests pass and the D3 helper produces the states above.

### Browser state and viewport matrix (CP2.2)

- **States:** small course; large course; empty course (`course_has_no_chapters` deep link); empty chapter (`chapter_has_no_topics` deep link); pending move; failed move (forced action error); read-only actor; hidden chapter restore; stale selected chapter (a removed ID in the URL).
- **Viewports:** fine pointer at 1440 and 1024px; touch-primary at 768, 375, and 320px.
- **Checks:**
  - no page overflow;
  - bounded topic detail;
  - keyboard-only completion of the journey (add chapter → add topic → open builder);
  - focus return after dialogs and after narrow back navigation;
  - move announcement;
  - the thresholds in `frontend-design` Accessibility baseline (contrast from actual tokens; 44px critical touch);
  - reduced motion.

## Risks, stop, recovery, and rollback

| Risk | Earliest exposure | Treatment |
| --- | --- | --- |
| Permission regression while restructuring controls | CP2.1 | Guardrail table; component tests for owner, editor-own, editor-other, and read-only |
| Deep-link, return-feedback, or preview journeys break | CP2.1 | Keep the smoke specs green; include them in the state matrix |
| Narrow-width regression (history `39feb3a`) | CP2.2 | 320 and 375px in the matrix |
| The specification quietly becomes a new design system | CP1.1 | Reference inherited values only; the Owner accepts the exact candidate |
| D2 query cost or leakage | CP2.1 | Same membership gate; one grouped query; an action test for the denied path |

**Stop conditions:**

- D1–D4 are unresolved;
- the specification is not accepted before Stage 2;
- repository evidence contradicts a guardrail;
- the work needs DB, RLS, or migration changes, shared primitive changes, or packages;
- fixture states cannot be produced.

**Rollback:** Stage 1 is documentation only. Stage 2 is confined to the Structure feature folder (plus the D2 action and tests), so the pre-pilot workspace can be restored by reverting that commit range.

## State — current resume projection

```text
Current Spec revision: accepted revision 1 (Owner, 2026-09-30; D1–D4 as recommended)
Current position: Stage 1, CP1.1 (surface specification candidate)
Status: in progress
Completed evidence: repository discovery on baseline 8ee3ff4
Accepted bounded deviations: none
Open decisions: acceptance of the exact CP1.1 candidate
Next action: author the CP1.1 candidate, then stop for Owner acceptance (CP1.2)
Current authority: plan commit, progress reconciliation, CP1.1 authoring; no spec acceptance, runtime, push, PR, or merge authority
```
