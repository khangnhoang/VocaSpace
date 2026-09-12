# Master Plan Only Workflow

Read this reference only when the parent skill routes a `MULTI_AGENT_MASTER_PLAN` candidate or a closed Master Plan Correction recommendation. Ordinary bounded plans, PR breakdowns, and tracked-program reconciliation can skip it. The parent skill remains authoritative for planning ownership and permissions; [`native-multi-agent-workflow`](../../native-multi-agent-workflow/SKILL.md) owns managed lifecycle state, review identity/artifacts, correction budget, and Main-only transitions.

## Master Plan authoring procedure

1. Admit the exact Owner Source Package before substantive work. Echo its `owner_input_revision` and declared ordered included refs. Derive candidate semantics from the included whole Owner entries, not from Main's routing summary or a durable candidate's historical package identity.
2. Inspect the applicable repository owners and current evidence. Separate confirmed facts, Owner decisions, assumptions, conflicts, and open questions. For every material assumption, record evidence and the condition that invalidates it.
3. Write the GOAL before mechanisms. The required fields are `GOAL ID`, `GOAL Revision`, `Desired Outcome`, `Success Boundaries`, `Protected Invariants`, and `Scope Boundary`. Desired Outcome and boundaries describe observable end state and claim limits; tables, services, modules, APIs, runtimes, and other implementation mechanisms belong below the GOAL.
4. Map ownership and semantic lineage. Every contract/workstream uses `ID | owns | depends_on | consumes | produces | assumes`. Record evidence and invalidation conditions in `assumes`. Trace every Owner requirement forward through GOAL, contract, workstream, and phase gate; trace every material mechanism backward to an Owner requirement or repository necessity.
5. Decompose workstreams and phases by dependency and verification boundary. Each phase states owned contracts, prerequisites, inputs/outputs, exact completion boundary, observable verification gate, and affected/unaffected/`needs_review` blast radius. Missing an edge is not evidence of `unaffected`; use `unaffected` only with positive evidence, otherwise keep `needs_review`.
6. Define acceptance and failure routing. Reject vague acceptance, hidden permission expansion, unbounded retries, deferred material choices, and phase gates that cannot detect the contract nearest the phase that creates it. A fresh downstream Implementor must not need to invent material GOAL, ownership, dependency, acceptance, or architecture semantics.
7. Self-review the candidate for exact Owner fidelity, repository ownership, bidirectional traceability, lifecycle liveness/boundedness, implementability, verification truthfulness, and unnecessary mechanisms. The candidate remains planning-only.

## Revision and correction boundary

- `Plan Revision` changes when decomposition or lower contract details change without changing the semantic GOAL.
- Only the Owner may approve a semantic change to Desired Outcome, Success Boundaries, Protected Invariants, or Scope Boundary and increment `GOAL Revision`. An agent or Reviewer discovering such a need returns `OWNER_DECISION_REQUIRED`; it does not rewrite the GOAL.
- Materially ambiguous Owner input returns `BLOCKED(ambiguous_owner_intent)` and Main opens the Owner gate before planning continues.
- An active detailed-plan mismatch may return through the current Planner/reviewer route owned by the native workflow. When repository reality challenges a closed Master Plan, lower work pauses. A fresh read-only Master Plan Correction role independently verifies the mismatch, traces it to GOAL and lineage, recommends the smallest goal-preserving correction with affected assumptions/blast radius, and returns that recommendation to Main. The role does not edit the canonical plan or resume implementation; the Owner decides disposition.

## Review handoff

Handoff the exact candidate and source identity into the existing `native-multi-agent-workflow` Master Plan Review contract. That owner supplies Stage R-A/R-B, the six canonical review dimensions, exact local-only review artifact, finding/verdict bar, same-session correction/rereview, and Main-only admission/transition. Do not restate or fork those definitions here.

Master Plan Reviewer `PASS` means the complete review contract passed for the exact candidate. It does not replace Owner approval, does not resolve a verdict-changing limitation, and grants no implementation or Git/remote action. The workflow ends with a reviewed Master Plan and an explicit Owner-facing permission state; implementation begins only under separately established authority.

## Compact candidate template

```text
# Master Plan — <initiative>

## Source identity and status
owner_input_revision:
ordered included refs:
Plan Revision:
Owner approval state:
implementation/Git/remote authority:

## GOAL
### GOAL ID
### GOAL Revision
### Desired Outcome
### Success Boundaries
### Protected Invariants
### Scope Boundary

## Repository facts, Owner decisions, assumptions, conflicts, and open questions
## Ownership map
## Semantic lineage
| ID | owns | depends_on | consumes | produces | assumes |
## Workstreams and phase gates
## Acceptance and verification
## Failure, mismatch, and Owner-decision routes
## Risks, claim limits, and explicit exclusions
## Review handoff and completion boundary
```

## Author self-review

- Every GOAL field is derived from exact included Owner source; no implementation mechanism leaks into GOAL.
- Every Owner requirement has a forward trace and every material mechanism has a necessary backward trace.
- Every lineage edge, assumption, `unaffected` claim, workstream dependency, and phase gate has current evidence or remains visibly `needs_review`.
- Failure paths identify detector, state owner, authority, identity, next route, and recovery/Owner gate without duplicating the native state machine.
- Acceptance and verification are observable, proportional, and close to the phase that introduces the contract.
- The plan defers no material semantic decision to Implementor and ends without implementation or implied action authority.
