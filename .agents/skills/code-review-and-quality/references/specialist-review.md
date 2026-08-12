# Specialist review

Read this reference after the applicable main review only when the concise core gate leaves a materially viable specialist candidate, and before deciding, packaging, executing, or reconciling that action. Skip it for default main-only reviews and reviewed work with no candidate passing the core gate.

## Risk clusters, permission coverage, quota, and deduplication

* Every specialist is limited to one threatened-invariant risk cluster.
* There is no task-wide one-specialist cap. Multiple specialists are possible only for multiple genuinely independent unresolved material clusters; a count such as 2–3 is a possible outcome, never a target, entitlement, or default.
* Group signals into one cluster when they threaten the same invariant or causal chain and one bounded answer could resolve them, even when they appear in several skills, files, or symptoms.
* Separate clusters only when their threatened invariants and material failure modes are independent, resolving one would not materially resolve the other, and each retains its own evidence gap, 1–3 exact questions, benefit, and permission coverage.
* Every action must fit current explicit permission. One owner instruction may authorize a bounded count or class of actions; another owner round-trip is required only when the next action exceeds its count, domain, access, package, or action boundary.
* A granted count or class is a permission boundary, not a specialist quota, entitlement, target, or reason to call that many specialists.
* Evaluate quota on the initial package before the call. Narrowing questions after context was supplied does not recover that cost or prove compliance.
* Quota controls package width, deduplication, low-value calls, and unnecessary repetition. Token cost alone must not veto a bounded specialist whose evidence could materially resolve an unresolved correctness or safety risk blocking a trustworthy main-agent verdict.
* Use the smallest available conversation/context inheritance that satisfies the fixed package; do not fork the full authoring context by default.
* Broad whole-plan/whole-branch review is not the default.
* Do not call a specialist again during implementation merely for continuity. Re-entry requires a residual hard risk plus insufficient main review/verification and a fresh valid permission/package gate.

## Bounded-context package

Record this package before calling a specialist:

```text
Risk cluster:
Threatened invariant:
Concrete failure mode and material impact:
1–3 exact questions:
Fixed maximum context — files/documents/excerpts:
Reason each source is necessary:
Why main-only review is insufficient:
Expected benefit versus quota:
Current permission coverage and remaining count/class boundary:
Approved scope and exclusions:
Required concise output:
Expansion rule: no expansion by default
Stop condition:
Authority: read-only, one turn, no delegation
Actual filesystem/tool/network/credential/mutation access:
```

Do not call a specialist when expected benefit cannot be explained. When unresolved material correctness or safety risk blocks a trustworthy main verdict and a bounded specialist could materially resolve it, that safety benefit satisfies the gate; quota should narrow and deduplicate the package rather than veto the evidence. If current permission or a valid executor/package is unavailable, record `not_run` and use `Blocked` when main evidence cannot establish trustworthy readiness. Instruction-bounded context is not filesystem isolation; record actual access rather than implying enforcement the environment does not provide.

When `implementation-planning-and-pr-breakdown` routes a specialist plan review, that skill owns the plan-specific decision, risk cluster and feedback reconciliation; this section owns the reusable package and reviewer behavior.

## Reviewer behavior and output

The reviewer must:

* remain read-only and answer the supplied questions in one turn;
* use only the fixed package and not broad-discover, request an expanding follow-up, call another agent, implement, commit, push or open remote scope;
* return `Blocked` with the missing source and reason when supplied context is insufficient;
* prioritize Critical/Required issues and report non-blocking suggestions only when requested or clearly valuable;
* locate every finding, state evidence and impact, and provide the smallest valid correction;
* state unanswered questions, missing context and claim limitations;
* stop when the questions are answered or an owner/material decision is required.

Use the existing severity taxonomy and finding format for supported issues. A specialist report is advisory evidence: it does not issue the main agent's final verdict and never grants an action permission.

## Main reconciliation and claim labels

The main agent reproduces or verifies specialist evidence against current owner decisions, repository facts, source ownership, approved plans and applicable domain skills. Unsupported, stale or conflicting assertions stay out of the final finding set. Do not resolve disagreement by reviewer count or majority vote.

Use labels precisely:

* `main self-review`: the authoring agent reviews its own artifact;
* `specialist review`: a reviewer focuses on one domain/risk cluster;
* `bounded-context review`: the prompt fixes a package, without implying filesystem isolation;
* `fresh-reader`: only when expected answers, author conclusions, suspected defects and contaminating author context were withheld under the owning fresh-reader contract;
* `independent review`: only when independence was actually established and described, not merely because another turn or same-model instance was used.

Self-review or specialist review does not substitute for required fresh-reader evidence. Record actual context/access and use `not_run` instead of upgrading an unsupported evidence claim.
