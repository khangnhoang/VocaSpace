# Spec, State, and Planning Hierarchy

Read this reference before authoring or materially revising a durable plan that needs multiple meaningful Checkpoints, any Stage, cross-session resume State, a managed detailed-plan handoff, or a decision whether implementation discovery requires plan correction. Skip it for one-session work with one coherent outcome and no separate resume/review boundary.

The parent skill owns activation, planning permission, core classification, and final output. This reference supplies the detailed decision procedure, examples, templates, and falsification checks. Domain skills still own product, database, UI, test, Git, and review rules. Advisory output remains non-authoritative.

## Resolve framing before binding the Spec

Classify each unresolved item in this order:

1. **Repository-resolvable fact:** inspect the owning source with deterministic tools. Do not ask the Owner or an adviser to choose the fact.
2. **Missing material evidence:** keep the item unresolved or blocked and name the evidence needed. Ask the Owner only to supply inaccessible evidence they control, not to convert a technical fact into a preference.
3. **Reversible implementation uncertainty:** record a bounded hypothesis when it can change without altering the Spec or an execution guardrail.
4. **Fuzzy or conflicting product framing:** ask one focused material question at a time. Reflect the proposed outcome, Done means, non-goals, and trade-offs; obtain Owner confirmation before binding them.
5. **Hard or high-impact judgment:** optional advisory consultation is justified only when repository discovery is complete enough to provide the relevant evidence and an exact question. Skip it when requirements are crisp, the choice is reversible, or advice would not change the decision surface.
6. **Unresolved Owner-controlled decision:** stop before binding the affected Spec and return `OWNER_DECISION_REQUIRED` with the smallest exact decision surface.

Questions whose answers cannot change product meaning, scope, acceptance, ownership, authority, or another material Spec boundary are not pre-Spec blockers. If an interview repeats, conflicts remain undisposed, or no answer changes the framing, preserve the unresolved decision and stop instead of looping.

An adviser may challenge, reframe, compare, and recommend. Main independently reconciles the advice against owning evidence. Advice cannot implement, approve, grant authority, override deterministic facts, or confirm an Owner-controlled outcome. A recommendation that changes scope, authority, or an Owner-confirmed end state remains a proposal until the owning gate accepts it.

## Classify plan content

### Binding Spec

Keep these binding when material:

* outcome and observable acceptance meaning;
* explicit scope and non-goals;
* material Owner decisions;
* semantic ownership and allowed or forbidden writer domains;
* authority boundaries;
* hard dependencies and required order;
* required evidence, stop, recovery, and rollback boundaries; and
* exact mechanisms only when current repository evidence proves that a different mechanism would violate one of the above.

Every execution guardrail needs a concrete failure statement: if it were omitted, how could the requested outcome become incorrect, unauthorized, unverifiable, unrecoverable, or owned by the wrong source? If no realistic failure exists, do not make the detail binding.

### Bounded implementation hypotheses

Typical hypotheses include:

* likely files and symbols;
* candidate call paths, helpers, components, RPCs, or adapters;
* tentative internal sequencing;
* a reversible local mechanism; and
* an expected test location when the observable guarantee and evidence layer are already fixed.

A hypothesis must name its boundary: what may change and which Spec/guardrail facts must remain true. Do not use “hypothesis” to hide a new writer domain, permission, semantic owner, hard dependency, acceptance meaning, or evidence requirement.

### State

State is the smallest truthful resume projection. Its field list and milestone format are defined only in `.agents/skills/repo-docs-system/references/templates/progress.md`; read it before writing a State block, and do not redefine the fields in a plan.

Update State when execution truth changes. Do not copy the full Spec, chat transcript, review artifact, or live managed-workflow ledger into State. Existing progress or program sources retain their documented ownership; add no duplicate tracker merely to satisfy this template.

## Choose the shallowest meaningful hierarchy

| Shape | Use when | Reject when |
| --- | --- | --- |
| Steps only | One small outcome can be completed and verified in one session with no meaningful resume/review boundary | A pause would lose material state or an independent outcome needs acceptance |
| One Checkpoint | One outcome needs a meaningful review or resume boundary but no internal outcome is independently accepted | The Checkpoint is only a container for atomic actions |
| Multiple Checkpoints, no Stage | Several meaningful outcomes have dependency/review/resume value, but no subset forms an intermediate integrated outcome that gates downstream work | A subset must be composed and accepted/published before downstream work |
| Stage containing Checkpoints | The grouped Checkpoints create an intermediate integrated outcome with its own acceptance, publication, rollback, or downstream gate | Stage exists only because the plan is long, has several files, or looks cleaner when grouped |

Steps are local actions inside the current outcome. “Read file,” “edit file,” “run formatter,” and “update docs” are not Checkpoints by themselves.

### Review boundaries

Use a Checkpoint review when that outcome can be assessed independently and the result is meaningful to resume or rollback. Use Stage integration/closure review when several Checkpoints must compose into a new intermediate claim before downstream work. Use final cumulative review only when correctness depends on composition across multiple semantic owners, Stages, writer domains, or evidence boundaries and earlier reviews cannot prove that composition.

Review boundaries do not grant commit, push, PR, merge, deployment, database, production, or other action authority. Checkpoints are not automatically commit boundaries.

## Route implementation discoveries

| Discovery | Required route |
| --- | --- |
| Different file/helper/wiring preserves outcome, allowed domains, authority, semantic ownership, hard dependencies, and evidence boundary | Verify the equivalent, record a bounded deviation in State, and continue within current authority |
| Step or Checkpoint completes; soft order or resume position changes | Update State only |
| A new writer domain, semantic owner, authority, hard dependency, stop/rollback rule, or evidence boundary is required | Stop affected work; correct and re-review the affected execution guardrail |
| Product meaning, acceptance, explicit scope/non-goal, or another Owner-controlled decision changes | Amend the Spec only through the Owner gate; do not continue dependent work |
| Evidence is insufficient to classify the discovery safely | Preserve unresolved/blocked State and obtain the missing evidence; do not guess or downgrade it to a hypothesis |

In a managed workflow, a hypothesis-only deviation is not `PLAN_CONTRACT_MISMATCH`. The Implementor still cannot edit the plan, grant itself authority, or expand a writer domain. Return mismatch when repository evidence challenges the binding Spec or an execution guardrail.

## Compact durable-plan shape

Adapt this shape; omit sections that have no consumer:

```txt
# <Plan>

## Plan identity and approval (revision, Owner approval; no State)
## Binding Spec
### Outcome and acceptance
### Scope and non-goals
### Necessary execution guardrails
### Owner decisions and unresolved material ambiguity
## Repository facts and conflicts
## Bounded implementation hypotheses
## Dependency graph
## Steps / Checkpoints / Stages
## Verification and review boundaries
## Risks, stop, recovery, and rollback
## State pointer — one line to the program progress source
```

When the program has a progress source, the plan has no State section, only that one pointer line. A standalone plan with no program progress may keep an inline State block shaped like the progress template. Document shape and State placement are owned by `repo-docs-system`.

Do not create a separate `state.md`, Stage file, owner brief, or progress source unless repository convention or a current consumer requires it.

## Falsification questions

Before accepting the hierarchy or detail level, ask:

* If this exact file or wiring changes while behavior and guardrails hold, would the plan still be correct? If yes, it is probably a hypothesis.
* What independently meaningful outcome does each Checkpoint produce?
* What new integrated claim does each Stage establish, and which downstream work waits for it?
* What composition risk requires integration or final cumulative review?
* Is the Owner being asked for a preference/decision only they own, or for a fact the repository should answer?
* Does advisory consultation have sufficient evidence and an exact question, and could its answer materially improve the decision?
* Would losing the adviser change authority or approval? It must not.
* Does State let a fresh reader resume without duplicating the Spec or live workflow state?
* Would omitting a proposed guardrail create a concrete correctness, ownership, authority, recovery, or evidence failure? If not, omit it.
