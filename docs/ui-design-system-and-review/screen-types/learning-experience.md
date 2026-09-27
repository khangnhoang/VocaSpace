# Learning Experience Screen-Type Design

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — published as the Learning Experience screen-type design; not runtime implementation authority |
| Accepted candidate identity | `LE-CANDIDATE-1`; Owner-accepted pre-publication SHA-256 `34C633DFBFA054ABADD7C9973CFB3F2EF50AA79C97B824A4294C08C0097BC508` on 2026-09-27 after exact upstream reconciliation |
| Upstream authority | [Accepted Product Language](../product-language.md) and the frozen [UI-2 Detail Plan](../implementation-plans/ui-2/plan.md), Stage 2A |
| Product Language prerequisite | [PL-MOTION-CORRECTION-1](../candidates/product-language-earned-completion.md) is accepted correction evidence; its bounded earned-completion rule is published in the authoritative [Product Language](../product-language.md) |
| Scope | Learner-facing dashboard, enrolled-course overview, active practice, feedback, review, progress, and completion as screen-type rules |
| Excludes | Route redesign, workflow or persistence changes, FSRS/business logic, exact shared-component variants, runtime token migration, and route-specific page composition |
| Acceptance scope | Today Runway, Chapter/Topic hierarchy, Focus Stage, recall loop, answer feedback, progress and earned-completion behavior, responsive rules, and accessibility direction are accepted together |
| Scenario review state | Today Runway and the corrected Chapter spine, Focus stage, answer feedback, recall loop, and Earned completion directions are reconciled from Owner review and published without material design change from the accepted candidate. |
| Final review evidence | Derived non-authoritative aid revision `stage2a-final-owner-gate`, SHA-256 `F35FC8E462A433073AAC55571096648A10FB6352BC3E5C9FBD65091FB4A143E6`; the durable rules below remain authoritative if that ephemeral aid is removed |

This artifact specializes the accepted Product Language for Learning Experience (LE). It references inherited product values rather than redefining them. Existing `/learn` code is comparison evidence, not proof of conformance or authority to change runtime behavior.

## 1. LE purpose and jobs

LE turns **Guided momentum** into a repeatable learning loop. At every point, the learner should be able to answer three questions without scanning the whole screen:

1. What am I doing now?
2. What changed because of my last action?
3. What is the next useful action?

The screen type covers these jobs:

| Journey context | Learner job | Required visible truth |
| --- | --- | --- |
| Dashboard | Resume the most useful learning or review task | The best current task, why it matters now, and one dominant route into it |
| Course overview | Understand position in the course hierarchy and choose the next topic | Course progress, chapter position, local topic progress, and the next executable topic |
| Active practice | Focus on one recall, reveal, or answer task | The learning object, its task instruction, local progress, and one primary response path |
| Feedback and correction | Understand whether the response worked and what to do next | Result, explanation or recovery, persisted/pending truth, and the next attempt/action |
| Review | Repeat due learning items with low interruption cost | Remaining workload, the current item, stable response controls, and completion of the queue |
| Completion | Recognize earned progress and continue or stop deliberately | What was completed, what progress changed, and the next meaningful option |

Dashboard summaries and course metadata remain subordinate to the current learner job. LE does not turn learning into a generic analytics dashboard or invent progress from unrelated counts.

## 2. Design latitude, hierarchy, and composition

LE has **medium-to-high design latitude**. It must materially improve learning focus and emotional response rather than repaint the current `/learn` card/dashboard composition with accepted colors. Expressiveness is spent on a continuous learner route, the active learning object, correction, visible progress change, and earned accomplishment. Supporting navigation and account utilities remain quiet.

### 2.1 Composition thesis — one learning runway

LE composes a **learning runway**: a visually continuous path from context → current task → response/result → next action. The runway is not one reusable component or a decorative timeline. It is a screen-type composition rule:

- the current learner job occupies the dominant visual field rather than another same-weight card;
- progress appears beside the decision it explains, not as a detached metric tile;
- feedback resolves inside or directly adjacent to the response plane rather than in a separate generic notification block; and
- the next action emerges from the resolved state, so the learner follows one path instead of scanning a dashboard of possible actions.

Dashboard, course overview, and practice express the runway differently. They must not collapse into the same grid of bordered white cards.

### 2.2 One local learning focus

Each local decision area has one dominant learning object or current task. Supporting context may identify the course, topic, queue, or instruction, but it must not compete with the object being recalled or answered.

Priority order:

1. **Current task or learning object** — the word, prompt, question, next topic, or review queue that requires attention.
2. **Immediate response or next action** — reveal, choose, confirm, retry, resume, or continue.
3. **Result and recovery** — correctness, explanation, saved/pending/error truth, and the next allowed response.
4. **Local progress** — position within the current course, topic, practice set, or review queue.
5. **Supporting navigation and metadata** — course identity, previous/next navigation, filters, or secondary context.

The preferred CTA hierarchy is inherited unchanged: one filled primary action using the accepted Product Language treatment plus one subordinate text action. An outlined secondary is reserved for a real competing action that needs stronger affordance. LE does not create another button geometry, color, or weight contract.

### 2.3 Context-specific hierarchy

- **Dashboard:** a dominant “today runway” joins course, current chapter, next topic, and one resume action in one field. The existing due-review row remains inside that runway. The lightweight lower shelf stays in learning context: one completed topic the learner can deliberately reopen and one truthful progress summary replace unrelated-course promotion without changing the runway composition. If no resumable task exists, the empty-state action becomes primary.
- **Course overview:** overall course progress frames a chapter spine. Each chapter exposes its own topic progress; only the current chapter expands its local topic run by default. The next executable topic and its parent chapter stay adjacent to the resume action.
- **Practice:** the active learning object owns one open focus stage. Recall and answer checking are sequential modes in that stage rather than simultaneous same-weight panels. Navigation/context recedes to a compact progress thread or disclosure.
- **Correction:** the result and recovery action temporarily outrank onward navigation. Incorrect feedback must not disappear before the learner can understand it.
- **Completion:** confirmation and next-step choice replace the prior response controls; they do not stack another celebratory card on top of the unfinished task.

Dashboard data must retain its semantic scope. A completed topic may expose an `Ôn lại` action because completed topics are reopenable; its learned/reviewable count must be derived through the learner's `user_flashcards.card_id → cards.topic_id` relationship rather than copied from the global review queue. The global due workload stays in its existing runway row. Learning streak is omitted because the current runtime does not supply it; future ownership is recorded separately. These lower items are contextual learning support, not an invented recommendation ranking.

### 2.4 Today Runway — accepted scenario direction

The approved dashboard direction is an **asymmetrical learning field**, not a generic two-column card layout. At wide widths it uses one continuous rounded surface with a dominant current-route region and a quieter supporting region. The reference balance is approximately `70/30`: enough asymmetry for the route to read first while the progress region remains immediately visible. A soft tonal or diagonal transition may connect the regions, but neither side becomes an independently bordered card.

The composition has three fixed hierarchy bands:

1. **Current-learning route — dominant upper-left region.** Course and chapter context lead into the next topic title, concise supporting copy, one filled `Tiếp tục học` action, and the subordinate `Xem lộ trình` text action. This region owns the largest type and most visual space.
2. **Course progress — quiet upper-right region.** A compact `completed topics / eligible topics` value and semantic progressbar support the route without competing with it. This is the same course-progress truth used elsewhere, not a new score or analytics metric.
3. **Due review — full lower row inside the runway.** A quiet divider separates the existing `n thẻ cần ôn hôm nay` workload from the upper regions. Supporting duration copy may appear only when a truthful estimator exists. The outlined `Ôn ngay` action aligns at the far end. This row must not be moved into the lower continuation shelf or merged with topic-scoped review.

Immediately below the runway, two equal-width, flat continuation items preserve the established rhythm through whitespace and a bottom divider rather than card borders, shadows, tinted boxes, or nested surfaces:

- **Lower-left — revisit learned content.** Show one topic the learner has actually completed, its truthful topic-scoped learned/reviewable flashcard count, and a lightweight `Ôn lại` text action. The count is derived by joining the learner's flashcard state to cards in that topic; the global due count must never be relabelled as a topic count. The selection is contextual learned content, not a recommendation algorithm.
- **Lower-right — supporting course progress.** Repeat only truthful course progress such as `Đã học n/x chủ đề`, an optional percentage derived from the same numerator/denominator, and a compact semantic progressbar. It remains quieter than both the current route and the right-side progress region. It must not be replaced by streak until a separately owned runtime contract supplies truthful streak data.

Unrelated course discovery or recommendation does not belong in this composition. Other courses remain discoverable through their owning navigation/surface; the Today Runway stays focused on continuing the current course, revisiting already learned content, understanding current progress, and entering due review.

At narrow widths, preserve semantic order rather than desktop geometry: current route → course progress → due-review row → learned-topic continuation → supporting progress. The upper regions stack inside the same runway, the two lower items stack without becoming cards, and actions retain usable targets. Narrow composition must not hide the progress denominator, topic count, or distinction between global due review and topic-scoped review.

## 3. LE signature: hierarchical momentum path

LE applies the accepted progression rail through a truthful **hierarchical momentum path**:

- At course level, the primary spine represents ordered chapters. Every chapter exposes a labelled local topic count; the current chapter may expand a secondary topic run.
- Overall course progress remains based on completed topics over eligible topics because that is the current learner data contract. Chapter structure explains where those topics belong; it does not replace the denominator or invent equal chapter weighting.
- A course with four chapters therefore shows four chapter stages, each with local progress such as “2/3 chủ đề”. The current chapter exposes its ordered topic states and identifies one next executable topic. Completed or future chapters remain summarized until the learner opens them.
- In an expanded topic run, current state is carried primarily by the numbered node/marker plus a visible label and `aria-current`. Do not add a redundant tinted or bordered container around the whole topic row when those cues and chapter context already make the state clear. A one-shot cue may radiate from the node when it becomes current, then settle to a small static halo; it must not pulse perpetually.
- Inside practice, a compact rail or semantic progress indicator may show position in a real card, question, group, or review queue.
- After a confirmed response, the current node/state advances only when the underlying learning state has actually advanced.
- Completion converts the current state to completed and exposes the next route or deliberate stop; it never invents an achievement score. When the completed topic is the final topic in its chapter, one bounded cue may confirm that current chapter. The next chapter may then receive a subordinate “next” indication, but it does not become current until the learner or workflow actually enters it. The rail does not add an unlabeled intermediate marker that duplicates the numeric progress value.
- One progress rail tells one semantic scale. A chapter-sequence rail may show completed/current/future chapters and the current chapter's real local topic progress; it must not animate a course-level percentage as though that percentage were the distance between chapter nodes. Course-level progress remains separately labelled text or a separately labelled course progress indicator.

The signature may be expressed through a rail, ordered list, labelled progressbar, or equivalent compact composition. The accepted Product Language owns its colors and geometry intent. Text labels, order, `aria-current`, and semantic progress values must preserve meaning without the visual rail.

This signature is functional rather than decorative: removing course/chapter/topic/card values should make the composition nonsensical. Flattening topics across chapter boundaries, treating chapters as equally weighted percentages, or pasting a generic numbered timeline onto unrelated learner cards is prohibited.

### 3.1 Domain vocabulary

Repository contracts name the routable learning unit `Topic`; it belongs to one `Chapter`, and a `Course` owns ordered chapters. Current learner copy inconsistently calls that same unit both “chủ đề” and “bài học”. This LE candidate resolves its own examples as follows:

- use **khóa học → chương → chủ đề** for structure, progress, current/next state, and completion;
- use activity names such as **thẻ từ vựng**, **câu hỏi**, and **bài tập** inside a topic;
- use **Tiếp tục học** as the generic resume CTA, with the exact chapter and topic shown next to it; and
- label next context from the next executable unit rather than repeating its ancestor: while topics remain in the current chapter, use **Chủ đề N · <topic title>**; after the final topic, foreground **Chương N · <chapter title>** and retain the first executable topic as supporting context; and
- avoid introducing “bài” or “bài học” as a parallel structural unit unless a later product-owned vocabulary decision explicitly maps it to `Topic`.

## 4. Learning feedback and semantic states

LE uses the inherited semantic roles without changing their values:

| Learning state | Required meaning and evidence | Prohibited shortcut |
| --- | --- | --- |
| Current/selected | Route/current treatment plus text, marker, `aria-current`, `aria-selected`, or checked state | Blue fill alone |
| In progress | Recall/progress treatment plus value, position, or named step | Treating partial work as success |
| Correct/success | Growth/success treatment only after confirmed correctness or persistence; include result text/icon | Green selection before validation |
| Incorrect/error | Correction/error treatment beside the affected answer or task; include explanation/retry | Red toast as the only durable feedback |
| Warning/incomplete | Attention/warning treatment with the missing prerequisite or incomplete state named | Disabling a control without a reason |
| Locked/unavailable | Neutral or warning presentation with the reason and permitted recovery/route | Faded content as the only explanation |
| Completed | Growth/completed treatment, the completed object, and a next action or deliberate endpoint | Confetti or a checkmark without progress truth |
| Next action | The accepted filled-primary CTA when dominant; subordinate text/outlined treatment only by hierarchy | Several equal-weight actions |

Correctness and selection are separate states. Selecting an answer may use Route/current semantics; Growth Green or Correction Red appears only after evaluation. Pending persistence also remains distinct from confirmed completion.

## 5. LE typography and density specialization

LE inherits the accepted font families, type roles, values, radius family, surface model, and spacing rhythm. Its specialization is limited to emphasis and density:

- The active learning object may exceed standard heading sizes when the content itself benefits from recall focus. It must wrap naturally on mobile and must not clip Vietnamese diacritics, phonetics, translations, or long foreign-language terms.
- Instructions and explanations use readable body roles rather than utility captions. Utility/caption text is reserved for short queue position, topic context, or progress metadata.
- Action labels retain the accepted Product Language action role unless a later shared-component contract establishes a bounded size variant; LE does not promote routine actions to heavier or display-like treatment.
- Practice may spend the larger intervals in the inherited spacing rhythm around the active object on wide screens, then compress surrounding navigation and metadata before shrinking readable content or touch targets.
- Dashboard and overview use standard work-surface density but must not default to a grid of interchangeable cards. Repeated bordered boxes, all-caps sentences, oversized counts without a learner decision, and clipped fixed-height copy are not LE identity.

## 6. Repository comparison and migration boundaries

Current `/learn` surfaces are a **negative/reference baseline**, not a composition template. They provide useful behavior that this contract must preserve:

- dashboard separation of resumable courses, remaining courses, review workload, empty state, and recoverable load error;
- course overview progress semantics, ordered topics, explicit no-content/access/error states, and a direct next-topic route;
- workspace route ownership, flashcard reveal, answer submission, retry/error feedback, loading announcements, and previous/next lesson navigation; and
- semantic progressbars, `aria-current`, labelled buttons, and accessible loading/error/status regions already present in several components.

They also expose the composition this candidate must move beyond: dashboard card columns, detached summary cards, overview identity/progress/path as separate rounded cards, and a practice workspace split between a large card and a same-time sidebar task. Feature-owned blue/emerald/slate/rose literals, success-colored selection before correctness, multiple heavy action weights, arbitrary runtime motion, repeated large radii/shadows, toast-only result paths, and equal-weight workspace controls are additional drift.

The LE correction is material rather than cosmetic:

| Current negative/reference baseline | LE candidate direction |
| --- | --- |
| Dashboard card grid with unrelated-course shelf | Preserve one today runway and its due-review row; replace only the lower shelf content with an explicitly completed topic to reopen and truthful course progress |
| Course progress summary detached from chapter/topic list | One chapter spine with local topic runs and adjacent overall progress truth |
| Flashcard and quiz/context visible as competing columns | One sequential focus stage with context collapsed around the current learning mode |
| Toast or block appears after an otherwise static response | Response plane visibly resolves selection → correctness → recovery/next action |
| Completion as another centered state card | Completion expands from the learning runway and visibly advances confirmed progress while actions remain present |

Later implementation work must reconcile each affected surface against both its behavioral contract and this screen-type design; UI-2 changes none of that code.

## 7. Practice loop, motion, and celebration

### 7.1 Repeatable interaction loop

The canonical LE practice loop is:

1. orient to the current object and local progress;
2. recall, select, or reveal through one obvious response path;
3. receive immediate, persistent-enough feedback;
4. understand correction, save/pending truth, or completion;
5. continue, retry, or stop through one newly dominant action.

Controls retain their position and semantic role across the loop where possible. Feedback may replace the response area when the next legal action changes, but it must not push the learning object unpredictably or move focus without cause. Repeated answers must not require reopening transient feedback that vanished in a toast.

For recall queues, a rating resolves the current card and advances directly to the next real card. The card position, progress semantics, and content update together; focus lands on the next card's stable reveal/task control so repeated practice can continue without reorientation. The transition is short and causal, not a decorative wait between ratings.

### 7.2 Motion specialization

LE uses only the inherited motion roles, but default motion must be **judgeable and causal**, not technically present yet visually negligible:

- Immediate response makes hover/focus or answer selection perceptible without positional movement.
- State transition visibly connects selected → correct/incorrect, progress before → progress after, and pending → saved/error. The semantic color, result marker, and next/retry action settle as one response, not as an unrelated block appearing below.
- Spatial transition is reserved for a real reveal, flashcard face change, disclosure, sheet, or dialog whose spatial continuity helps orientation. A flashcard face change must preserve one object in space through a clear turn/face transition or an equally legible spatial reveal; a near-invisible fade/translate is insufficient.
- Earned completion visibly resolves the final learning state into confirmed progress. The animated indicator begins at the authoritative prior value and ends at the authoritative new value. The result and actions render immediately, while a bounded cue attached to the changed segment or node supplies the accomplishment moment; a disconnected standalone burst does not.

The current review aid applies the published `PL-MOTION-CORRECTION-1` rule through a composed earned-completion sequence: chapter-local progress → current chapter completion → subordinate next-chapter context over approximately `880ms`. The longer constituent timing belongs only to the accepted composed earned-completion exception; it does not change ordinary Product Language motion roles.

Representative choreography intent:

| Learning event | Default-motion intent | Stable invariant |
| --- | --- | --- |
| Flashcard reveal | One clear spatial face-change with a stable card footprint and anchored content; the back face settles once | Same revealed answer, explanation, focus location, and rating actions |
| Rated card → next card | One short card-state transition that updates content and labelled queue progress together | Rating is recorded, next content is available, and focus continues at the next stable reveal/task control |
| Answer selection | Position-stable Route/current emphasis that makes the chosen option unmistakable | Selection is not yet correctness |
| Correct validation | A visible state transition across the chosen response plus a confirmed marker and next action | Correct result copy is immediate and non-color |
| Incorrect validation | A brief bounded correction cue on the chosen response, then persistent error/explanation and retry | No repeated shake, no blocked retry, no decorative alarm |
| Progress advance | The confirmed segment/node visibly advances from the prior value to the new value; at a real chapter boundary, the active chapter settles from current to completed before the future chapter receives any subordinate next indication | Numeric/text progress and chapter labels update immediately and remain authoritative; the next chapter is not current until entry, and no decorative intermediate marker is required |
| Earned completion | One route-completion sweep or bounded cluster cue around the existing progress path | Completion copy, confirmed progress, and next/stop actions are available from the first settled frame |

The feedback text, icon, progress value, and legal next action exist at the start of the settled state; motion never withholds them. Pending state begins immediately, prevents accidental repeat submission, preserves the control label/width where practical, and ends in a confirmed or recoverable state.

Under reduced motion, LE follows the accepted Product Language equivalence: remove translation, rotation, scale, flip, confetti, and stagger; expose the same final state immediately or with the accepted short opacity alternative. No product-facing motion preference is required by this artifact.

### 7.3 Celebration budget

Celebration is proportional to earned consequence:

| Event | LE treatment |
| --- | --- |
| Correct answer or remembered card | Responsive validation transition and direct success feedback; no confetti and no blocking celebration |
| Practice set, review queue, or topic completion | One clearly perceptible but bounded route/progress completion cue inside the existing learning runway |
| Course or comparably meaningful learning-plan milestone | A future owning surface may propose optional, one-shot confetti only when progress is confirmed, interaction remains available, and reduced motion receives the same non-motion result |
| Pending, optimistic, or failed persistence | Never celebrate; retain pending/error truth and recovery |

Confetti is therefore not an LE default, dependency, or implementation requirement. This artifact supplies its eligibility boundary; a later surface specification must still justify and accept its concrete use.

## 8. Responsive composition and input behavior

LE changes composition before reducing legibility or target usability.

### 8.1 Wide and medium layouts

- A wide practice surface may place the focused learning object beside a quieter course outline or question context. The secondary region must not visually equal the active task.
- At medium widths, supporting context moves below the active task, collapses behind a labelled disclosure, or becomes a non-blocking sheet. The task, result, and primary response remain together.
- Dashboard and course overview may use multiple columns only when reading order remains task-first in the DOM and when a single-column flow preserves the same priority.

### 8.2 Narrow and touch layouts

- The active object, feedback, and immediate action form one uninterrupted vertical flow. Horizontal page scrolling is not allowed for ordinary learner copy or controls.
- Answer choices, flashcard actions, next/retry actions, and previous/next navigation remain comfortably targetable and do not rely on a small icon alone.
- Correct/incorrect result markers remain aligned with their owning answer choice at narrow widths; they do not wrap into an ambiguous second row. When a retry text action would leave too small or weak a touch target, the surface may use the already allowed outlined-secondary affordance without creating a new Button geometry.
- Long Vietnamese labels and foreign-language content wrap. Controls may stretch to their content region when the surface composition benefits; this is not a global Button-width rule.
- Fixed or sticky controls may be used only when they do not cover content, feedback, the focused element, the on-screen keyboard, or safe-area space.
- Sidebars become disclosures, sheets, or ordered inline context rather than squeezed desktop columns. Opening and closing them must preserve an intelligible focus return.

### 8.3 Input equivalence

- Every pointer action has a keyboard path and a visible focus state.
- A single-answer question uses a semantic mutually exclusive choice pattern; selection and submission remain separate when validation requires confirmation.
- Flashcard reveal is an explicit button, not a hover or swipe requirement. Rating/recall choices remain labelled with words rather than gesture direction or color alone.
- Previous/next controls communicate unavailable boundaries through disabled semantics and, when non-obvious, a nearby reason.
- Touch, mouse, and keyboard reach the same result; shortcuts may accelerate a task but never become the only path.

## 9. Loading, absence, failure, and persistence truth

Every representative LE surface must define these states when applicable:

| State | Required behavior |
| --- | --- |
| Loading | Preserve recognizable task geometry, expose busy/status semantics, and avoid presenting fake progress or selectable placeholders |
| Empty/no content | Name what is absent and offer the nearest truthful route or action; do not render zero as invented learning progress |
| Error | Keep the affected context, explain what failed in learner language, and expose a retry or safe route |
| Partial/stale data | Label the limited or possibly outdated truth; do not silently merge it with confirmed progress |
| Pending | Identify the action underway, prevent repeat submission, retain current input/context, and announce material completion |
| Disabled/locked | Preserve legibility and name the prerequisite when the reason is not already obvious |
| Saved but progress failed | Distinguish the saved answer/card from the failed progress update and provide the appropriate recovery; never claim completion |
| Completion | Show the confirmed object and progress consequence, then a next action or deliberate endpoint |
| Retry | Retry only the failed boundary and preserve still-valid learner work whenever the owning workflow supports it |

A toast may supplement a persistent state but cannot be the only source for correctness, an actionable error, or a completion decision. LE does not change the underlying persistence model or promise recovery the repository does not support.

## 10. Accessibility contract

LE inherits the Product Language contrast, focus, non-color, typography, imagery, and reduced-motion requirements and adds these learning-specific rules:

- Heading order and landmarks expose the current course/topic/task before supporting regions. Visual reordering must not create a contradictory reading or focus order.
- Course, topic, card, question, group, and review progress use native or ARIA progress semantics with current value and a human-readable label. Decorative rails remain hidden from assistive technology.
- Current and completed states include text or semantic attributes. Correct/incorrect answers include result text and an icon or equivalent cue; color is supplementary.
- Choice groups have a programmatic group label, each option has a complete accessible name, and selected, disabled, correct, and incorrect states are not inferred from styling.
- Newly available answer feedback or completion uses an appropriate live status. Blocking errors use alert semantics. Announcements stay concise and do not repeat on every render.
- Focus remains on the initiating control for an in-place reveal when that remains useful; when a dialog/sheet opens, focus enters it and returns to the trigger on close. Advancing to a new item places focus at a stable task heading or equivalent orientation point when needed.
- Keyboard order follows task → response → feedback/recovery → supporting navigation. Sidebar controls or previous/next routes must not interrupt the active answer sequence.
- Media uses meaningful alternative text when it conveys learning content and an explicit decorative fallback when it does not. Audio learning content requires a labelled control and a text-equivalent learning path where the task permits it.
- Long Vietnamese and foreign-language strings survive zoom and narrow widths without clipping, overlap, or meaning hidden solely behind truncation.

The review aid can demonstrate semantics and interaction intent, but it cannot prove production assistive-technology behavior. Runtime implementation later requires browser/assistive validation against the actual components and data.

## 11. Representative type-level patterns

These patterns demonstrate the screen type without freezing a route layout:

### Pattern A — Today runway

A dashboard fragment joins the resumable course, current chapter, next topic, truthful `completed topics / eligible topics` progress, one “Tiếp tục học” action, and its existing global due-review row in one continuous field. Without rearranging that runway, the two lower shelf positions may show a known completed topic through `Ôn lại` with its topic-scoped learned/reviewable count, plus a compact repeat of truthful course progress. The pattern does not select unrelated courses, infer a recommendation order, attach global card counts to a topic, or show streak without an owning runtime contract.

### Pattern B — Chapter spine and local topic run

A course fragment shows overall completed-topic progress beside an ordered chapter spine. Each chapter names local topic progress; the current chapter expands its ordered topics and exposes the next executable topic. Route/current and completed semantics preserve meaning through labels and order without the visual rail.

### Pattern C — Recall, reveal, and rate

A focused learning object presents one recall prompt and one reveal action. Default motion gives the same object a clear spatial face-change; reduced motion swaps to the same back face without spatial movement. The settled region exposes the answer, explanation, and labelled recall choices. Rating advances to the next real card with its labelled queue progress and a stable focus destination; reduced motion performs the same state change without spatial transition.

### Pattern D — Answer, correction, and retry

A mutually exclusive answer group separates selection from confirmed correctness. Validation visibly resolves the chosen response, result marker, persistent explanation, and next/retry action as one response plane. Reduced motion shows the identical settled state immediately.

### Pattern E — Earned completion

A completion fragment grows from the existing learning runway rather than becoming another detached card. Confirmed result/progress and actions appear immediately; a clearly perceptible bounded route-completion cue supplies accomplishment. A failed progress write remains an error state, not this pattern.

Each pattern may be composed differently by a future surface owner. The patterns do not fix a header, card grid, sidebar width, control dimensions, navigation shell, or route behavior.

## 12. Stage 2A design-quality review lenses

CP and integration self-review must try to falsify the candidate with these additional questions:

1. **Material composition change:** does the candidate replace—not merely repaint—the current card-grid, detached-summary, and competing-column patterns where they weaken learning focus?
2. **Appropriate design latitude:** is LE expressiveness visibly spent on recall, correction, progression, accomplishment, and motivation while surrounding utility remains disciplined?
3. **Judgeable default motion:** can a reviewer perceive the causal reveal, validation, progress, and completion transition without being told an animation occurred?
4. **Hierarchical truth:** for courses with several chapters and topics, does course progress preserve `Course → Chapter → Topic` while retaining the real completed-topic denominator and next-topic route?
5. **Inherited identity without generic cards:** do Product Language roles shape one learning runway and response language rather than becoming colors applied to interchangeable cards?
6. **Reduced-motion and workflow equivalence:** after motion is removed, are the same result, explanation, progress truth, focus destination, and legal actions immediately available?

A semantic/accessibility pass is insufficient if these design-quality lenses fail. Review aids must include the current composition as an explicit negative/reference baseline and make each material difference directly judgeable.

## 13. Explicit non-goals and downstream ownership

This LE screen-type design does not:

- alter `/learn` routes, data contracts, persistence, FSRS scheduling, progress rules, answer validation, or permissions;
- select or install a motion/confetti package, shared component, font, icon set, or runtime token;
- define exact button, tab, choice, progress, sheet, dialog, toast, or sidebar construction owned by UI-3 or later surface work;
- require a user-facing reduced-motion setting or override the platform preference;
- approve the current production UI, migrate feature literals, or make the review aid a source of truth; or
- authorize runtime implementation, shared-component work, Stage 2B, or any remote action.

Future surface specifications must preserve the semantic hierarchy and state truth here while supplying route-specific composition, copy, data conditions, and manual/browser verification. Any exception must name the learner job that cannot be expressed by the accepted Product Language plus this LE specialization.

## 14. Acceptance and publication boundary

The Owner approved the current reconciled LE direction for Stage 2A closure subject to exact identity verification after the upstream Product Language correction was reconciled. Deterministic verification established that the resulting pre-publication artifact remained exact `LE-CANDIDATE-1`, SHA-256 `34C633DFBFA054ABADD7C9973CFB3F2EF50AA79C97B824A4294C08C0097BC508`; upstream reconciliation changed provenance only and did not alter any material LE scenario, hierarchy, interaction, responsive, accessibility, or motion decision.

`CP2A.3` therefore publishes that exact accepted candidate through this artifact and the accepted-source index. Acceptance does not claim runtime conformance, authorize application changes, or make the non-authoritative review aid a source of truth.
