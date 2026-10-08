# D8-LUI detail plan — learner color polish, learning/Preview UI and documentation closeout

Revision: r1, 2026-10-09. Implementation/design approval: pending. Parent master plan: [plan.md](../../plan.md). The new scope decision is recorded below; master-plan integration is part of CP1. The unapproved surface draft at `docs/ui-design-system-and-review/surfaces/learner/learning-workspace.md` is intentionally excluded from this plan-only commit and is not a committed dependency.

## 1. Binding Spec

This is a proposed implementation contract, not permission to implement. The Owner authorizes the new branch, planning, independent plan-review correction rounds and a local plan-only commit after review passes, then stopping. The eventual delivery is one PR containing documentation reconciliation, bounded D8 color polish and the learning/Preview redesign. Reviewer approval does not approve the visual design; Owner review of a design aid remains pending.

### 1.1 Outcome and acceptance

Outcome: learner account/dashboard colors have consistent semantic meaning, and learning/Preview use a continuous, content-aware practice surface with perceptible causal motion and truthful feedback. Existing access, grading, queue and persistence rules remain authoritative.

| ID | Observable result |
| --- | --- |
| AC1 | `/learn` and `/profile` keep their current layout, controls and data behavior; primary actions, selected/focus states, progress, confirmed success, warnings and errors use the accepted Product Language roles. Green no longer means ordinary navigation or an unverified selection. |
| AC2 | `/learn/[course-slug]/[topic-slug]` has one dominant practice area. Standalone questions use the whole task region; grouped material and its current question form one reading/answer path. Course navigation is supporting context, not a competing question panel. |
| AC3 | Every currently supported TOEIC Part 1–7 has an explicit arrangement based on `TOEIC_PART_RULES`. Existing images, audio, passage text, question text and arbitrary valid option counts remain available on narrow and wide screens. No invented transcript, speaker or answer-format data is required. |
| AC4 | Flashcards clearly turn from front to back and continue to the next front after rating succeeds. The old answer never flashes inside the new card, failure keeps the revealed card, and Again/Hard keep their existing requeue semantics. Controls and queue labels do not jump because pending copy mounts/unmounts. |
| AC5 | Memory check retains all-correct server gating, wrong-answer requeue, stale-content recovery and server-confirmed pass. Stage transitions preserve orientation and do not suggest exercises have unlocked before confirmation. |
| AC6 | Selection is distinct from correctness. Result/explanation and recovery remain in the response area; a persistence error retains input and never looks like an incorrect answer. Saved answer with failed progress sync is visibly partial success, not topic completion. |
| AC7 | Proposed interaction amendment: a correct exercise answer exposes explicit `Câu tiếp theo` instead of the current automatic 500ms advance; incorrect feedback stays inline instead of forcing the explanation dialog. Previous/next browsing and retry remain possible under their existing guards. Owner acceptance is required before implementing this amendment. |
| AC8 | Preview shares presentation quality but retains stateless local ratings, transient answer evaluation, no exercise lock behind memory check, eligibility revalidation and private-media delivery. Its completion says the sample was viewed; it never claims saved learner/course progress. |
| AC9 | Route/topic changes, same-group question changes, group changes, reveal, rating, validation, stage completion, disclosures and media loading each have a defined motion/focus/scroll behavior. Default motion is perceptible; reduced motion exposes equivalent settled content and actions. A slow request cannot freeze the next action behind a decorative animation. |
| AC10 | At 320/375/768/1024/1366/1440px, long text and portrait/landscape media remain usable without page-wide horizontal scrolling. Keyboard, touch and actual 200% zoom preserve content and reachable controls; natural vertical scrolling is valid. |
| AC11 | Documentation distinguishes merged/local checks, Owner-reported historical D1 UI QA, hosted DB/RPC observations and actual production guest Preview/media evidence. It removes stale pending rollout claims without upgrading these to a complete authenticated production UI claim. |
| AC12 | Existing D6 ReviewSheet UI/motion/queue behavior, profile validation/upload/password flows, dashboard hydration layout and all server access contracts keep their accepted behavior. No D9 payment history, last-access resume, learning-history/streak feature or broad theme redesign enters this PR. |

### 1.2 Scope and non-goals

- Documentation reconciliation: the student-flow master/progress/problems and affected D6/L1 wording; close only proven exit conditions. Fold the Owner's local D1 matrix acceptance into this PR, not a separate docs PR.
- D8 color-only polish: learner dashboard, course overview where the same colors drift, and account profile. Existing payment reminder may adopt its existing warning role; its query, states and behavior stay unchanged.
- Redesign: enrolled learning workspace, public Preview and their route-local loading/feedback, flashcard, memory-check, question, context and course-navigation presentation.
- Bounded frontend composition may reuse media already delivered by the current action. Group `image_url` is present but omitted by today's enrolled context renderer; rendering it is included.
- Non-goals: DB migrations, RLS/RPC changes, seed/global production mutations, answer-format/schema changes, auto transcripts, conversational avatars, waveform/time alignment, new player packages, analytics, streak, last-access state, payment/history work, dedicated review route, full dashboard redesign, global navigation redesign or shared Button-contract changes.
- No application, test or fixture edits in this planning checkpoint. Only this plan may be committed after independent review passes; the unapproved surface design stays uncommitted. No push, PR, merge, deployment or implementation is authorized now.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Reuse accepted Product Language, LE and Button; keep the surface candidate out of the accepted-only index until Owner acceptance. | A draft silently replaces established identity/geometry or becomes falsely accepted. |
| G2. Existing D2/D3/D4/L1 actions and DTOs own grading, eligibility, progression and persistence; presentation receives safe results. | Redesign can leak answer keys, bypass the memory gate, celebrate failed writes or persist Preview work. |
| G3. Preserve existing managed media endpoints and fail-closed eligibility behavior; never expose a storage reference/public URL as a shortcut. | Protected group media becomes accessible outside its authorized context. |
| G4. Scope color mapping to affected learner features; reuse `action`, `route`, `route-quiet`, `correction` and `correction-quiet`. Audit consumers before adding any missing semantic role. | Repurposing `primary`, chart or broad global variables changes unrelated teacher/admin surfaces. |
| G5. Use explicit transition properties and stable geometry; semantic success/error cannot wait for animation. Old visual snapshots are inert and inaccessible. | Stale responses or duplicate clicks grade the wrong question, content shifts, or screen readers receive both faces/items. |
| G6. Keep ReviewSheet isolated or retain its exact presentation path when sharing a flashcard primitive. | Accepted D6 flip, queue, final-state copy and modal geometry regress. |
| G7. Keep local Owner QA and hosted probes in distinct evidence classes; never label SQL role probes as full UI acceptance. | Docs exaggerate production coverage or repeat an already completed Owner task. |
| G8. Prepare missing canonical local QA cases before rendered review; never refill production/root learner histories to obtain visuals. | Exhausted/non-representative fixtures invalidate QA and mutate real learner data. |

### 1.4 Owner decisions that bind this unit

- 2026-10-09: all D1 UI cases listed in this conversation were already tested by the Owner on local during D1 development; record that historical Owner evidence with the earlier documentation task.
- 2026-10-09 scope instruction: combine that docs task, bounded D8 colors and learning/Preview UI into one eventual PR; create a branch from pulled main and write the plan/design only. Add the corresponding master-plan decision during CP1 rather than citing a decision that is not yet recorded there.
- 2026-10-09 checkpoint instruction: independently review/correct the plan until it passes, commit only the plan locally, then stop. The Owner has not reviewed a design aid or approved the surface design; no reviewer verdict may substitute for that approval.
- Common LE identity and shared Button remain accepted upstream inputs. Candidate layout, motion choreography and AC7 are proposed, not accepted implementation decisions.

## 2. Repository facts

Baseline: `a92f3711cc7aced117b858e28c1ca785816e17af`, checked 2026-10-09. `main` was fetched and pulled fast-forward-only before creating `feat/learner-ui-d8-workspace`; required D6/L1 commits are merged.

- Accepted-source index has Product Language, LE and Button, but no learner-workspace surface; this justifies a Draft surface design rather than changing the common LE philosophy.
- `LearningWorkspace` has `flashcard → memory → exercise`, optional stages, a content/quiz/sidebar split and server-derived sticky topic completion. It requeues Again/Hard; memory check gates exercises only in enrolled learning.
- `QuizSidebar` auto-advances correct answers after 500ms and uses an explanation dialog for incorrect answers; AC7 therefore changes interaction semantics and needs Owner acceptance.
- `TOEIC_PART_RULES` owns part-specific context requirements. Question DTOs expose one selected option ID and ordered options, not free text, multi-select, drag/drop or speaker/timestamp structures.
- `getLearningWorkspace` maps managed group media to `/api/question-group-media/[groupId]/[type]`; `ExerciseContext` renders passage/audio but not its delivered `image_url`.
- `FlashcardStage` is also consumed by public Preview; ReviewSheet has its own accepted flip CSS and state loop. A shared refactor cannot assume all three persist or progress identically.
- Profile uses emerald for avatar fallback/tab/focus; workspace uses emerald for navigation and ordinary actions; memory selection uses slate; Preview uses blue and separate emerald/rose feedback. This supports a bounded semantic-color reconciliation, not global theme replacement.
- Global runtime already has Action/Route/Correction variables; progress/success/warning and slate neutrals are still locally mapped. Reuse exact accepted roles without commandeering generic primary/chart tokens.
- Program State still describes pre-merge L1 and earlier production deployment. Prior rollout operations verified L1 history `20261008130544`, deployment `dpl_G3iy9Wgw2CGMNGon37Y919QJDXbL` at `a92f371`, guest Preview/image/Range and denied paths; QA course was returned to draft. These are dated observations to reconcile, not evidence collected by this planning checkpoint.
- Prior D1 hosted probes cover authorization/RPC paths, not UI; notably they do not prove M24 exercise creation or M27 browser navigation. The Owner's historical local UI acceptance closes the local manual evidence gap, without inventing a historical SHA or authenticated production observation.

### 2.1 Documentation disposition for the same PR

| Source | Required correction during implementation/closeout |
| --- | --- |
| Program State and milestones | PR 142 merged; L1 hosted applied/history synchronized under explicit authority; dated production deployment/Preview checks; new active D8-LUI checkpoint. Do not retain completed L1 as current pending State. |
| D1 rollout problem/evidence | Owner confirms all listed D1 manual UI cases tested locally; record source/date of confirmation separately from hosted DB/RPC checks. Leave seed debt, cleanup debt and candidate revisions open unless independently solved. |
| D6 AC5/AC7 and remaining acceptance | Match the already merged authoritative no-due-card completion/`Quay lại` copy and stable saving presentation. Preserve history in Git; do not claim old candidate wording describes runtime. |
| L1 rollout/runbook wording | Applied migration and one authorized history-version repair; no schema rerun; no claim that routine Vercel domain switching is manual. The authorized alias reassignment was redundant according to its returned oldDeploymentId. |
| Future-features/problems | Do not close last-access resume, learning history, D9, D5 or unrelated defects merely because learner colors/design are revised. |

## 3. Bounded implementation hypotheses

- Compose feature-local task/header/context/response regions from `LearningWorkspace`, `FlashcardStage`, `MemoryCheckStage`, `QuizSidebar`, `ExerciseContext` and `ChapterSidebar`; files and component boundaries may change while G2/G6 hold.
- Share presentation and content ordering with `PublicCoursePreviewExperience`, using explicit mode callbacks rather than a merged persistence/state engine. Keep enrolled and stateless action owners separate.
- CSS transform/opacity and existing Radix/tw-animate capabilities should suffice. No motion dependency or generalized animation runtime is assumed. Existing fonts and Lucide stay unchanged.
- Use a stable media node keyed by group ID, and a question response node keyed by question ID; the former may survive same-group navigation, while the latter resets only its own legal attempt state.
- Missing semantic colors may be feature-scoped CSS variables mapping accepted roles, or additive theme-addressable tokens after a bounded consumer audit. No global neutral/theme migration is implied.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0, current | Independently reviewed plan and local plan-only commit, then stop; unapproved visual draft remains outside the commit | Source/contract self-review, independent review/corrections, docs structure/links, diff/staged scope checks; later Owner design-aid review and AC7 acceptance before code |
| CP1 | Existing rollout/Owner QA docs reconciled and D8 colors coherent without layout/workflow change | Docs checks, scoped diff, existing profile/dashboard/overview checks selected from actual diff; rendered palette/focus checks |
| CP2 | Enrolled practice layout, all content modes, durable feedback and causal motion compose safely | Focused workspace/memory/flashcard/media interaction tests, TypeScript, targeted lint; local fixture readiness |
| CP3 | Preview achieves the same presentation quality while retaining independent stateless/eligibility behavior | Focused Preview tests plus unchanged D2 guards; real public Preview/private-media and enrolled learning journeys |
| CP4 | One integrated PR candidate ready for Owner UI/motion judgment and independent implementation review when requested | Rendered review against accepted sources/candidate accepted by Owner; cross-surface D6/route regressions, exact diff, truthful docs/manual status |

CP1–CP4 do not grant implementation or delivery authority. Dependencies are CP0 acceptance → CP1/CP2 → CP3 → CP4; all code and its direct tests remain in the same eventual PR. Documentation-only closeout is not a separate PR.

### 4.1 Verification strategy

- Planning now: `npm run docs:check`, `git diff --check`, inspect all changed/untracked files; no product test success or rendered-review verdict is claimed.
- Later component coverage: existing `learning-workspace`, `memory-check-stage`, `public-course-preview`, `review-sheet`, `learn-dashboard-interactions` and `edit-profile-form` suites, plus directly affected question/media/overview checks. Cover chosen option versus correctness, confirmed-only advancement, saving/failure recovery, stale question/group results, D3 gate, D4 partial save and Preview zero writes. Do not assert CSS/class implementation as the only behavior proof.
- Later static checks: `npx tsc --noEmit` and scoped ESLint for changed TS/TSX. Full lint/build/integration only if the actual diff or required PR checks justify them.
- Existing E2E runner: `npm run test:e2e -- e2e/smoke/learning-workspace.smoke.spec.ts e2e/d2/public-course-preview.spec.ts`; inspect/extend its fixture and cases before executing, with isolated environment only. This is planned, not a current pass.
- Agent objective browser checks: route refresh/Back/Forward, memory locking, no protected-content flash, chosen/correct/incorrect/pending/error, media 200/Range/denied/withdrawn, no overflow, focus/keyboard/touch, stable SSR/hydration, default/reduced-motion equivalence.
- Owner: perceptual continuity/timing, legibility/density of each content mode, image/dialogue reading comfort, D8 palette harmony and completion feel. Do not ask the Owner to rerun unchanged D1 QA or accepted D6-only scenes.
- Changed workspace/Preview still need their own 200% zoom validation; earlier ReviewSheet scroll acceptance is retained and is not a new-layout pass. Validate reachability and no content loss, not fitting the entire task in one screen.

### 4.2 QA fixture readiness

- Outcome: canonical fixture requires narrow additions for this redesign's content matrix; no fixture mutation now.
- Sources: `supabase/seed.sql`, `e2e/support/d2-preview-fixture.ts`, existing workspace/D3 fixtures, `e2e/smoke/learning-workspace.smoke.spec.ts` and `e2e/d2/public-course-preview.spec.ts`.
- Existing coverage: enrolled/unavailable navigation and flashcards; public Preview with real private image, stateless answer and quota/withdrawal cases; D3 memory correctness/gate coverage. A 1px image proves delivery, not visual media usability.
- Missing visual cases: representative Part 1–7, optional mixed image/audio, long dialogue/passage, readable portrait/landscape images, playable audio, long answers, missing/broken media, memory retry, final-stage and partial-progress-write failure. No structured-speaker or timestamp fixture because the DTO does not support it.
- Required additions: only missing cases in local/test helpers, with stable legal D1/D2 provenance and managed media; use synthetic content/assets with no personal data. Inspect schema and load `supabase-safe-migration` before any independently authorized fixture writes; no migration is justified by fixture needs.
- Setup: the existing isolated `npm run test:e2e -- ...` workflow; current local E2E API/DB are 45441/45442, separate from root 45321/Next 3000. Preserve the Owner's dev data and never reset the root environment.
- Fixture checkpoint: CP2 before browser review. Browser QA begins only after required cases/assets are reproducible and focused checks are green. Prepared fixtures do not themselves prove UI behavior.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Choreography hides state or feels like another instant swap | Review full recall/rating/question/stage loops; animate an identifiable stable object and measure continuity; expose settled state/actions immediately |
| Long passages/media move controls unpredictably | Natural content height, stable answer-area positioning, retained same-group context, deliberate group-boundary focus/scroll; no fixed screen-height clipping |
| Shared presentation changes D6 or Preview writes | Separate mode/state ownership and direct cross-consumer regressions; leave ReviewSheet implementation intact |
| Old result/timer resolves on another question | Capture attempt/question identity; cancel obsolete visual work and ignore stale responses; remove the old correct-answer timer only after AC7 is accepted |
| Polishing becomes full theme/dashboard/analytics work | Bound D8 to semantic colors and existing geometry; stop on required shared primitive/DB/data-contract changes |
| Historical Owner QA becomes production proof | Attribute source, local environment and confirmation date; keep production actor/media scope explicit |

- Rollout runbook: planning acceptance and later implementation authorization → focused checks/fixtures → integrated code/rendered review and Owner visual acceptance → separately authorized commit/push/PR → exact-head CI → separately authorized merge/deployment observation. No hosted migration is planned.
- Stop when: a required content format or media payload is unavailable, a shared accepted contract must change, persistence/permission needs a new writer, or the Owner does not accept AC7; keep the affected design option proposed rather than silently changing behavior.
- Rollback: restore feature-local composition/color changes from this one PR; retain grading/FSRS/progress data and existing APIs. Documentation evidence remains truthful even if UI is rolled back. No new irreversible production data operation is part of this plan.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
