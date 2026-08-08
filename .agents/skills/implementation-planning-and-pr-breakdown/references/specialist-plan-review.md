# Specialist plan review

Read this reference after main plan self-review only when the concise core gate leaves a materially viable specialist candidate, and before deciding, packaging, executing, or reconciling that action. Skip it for default `0 specialist` plans and reviewed plans with no candidate passing the core gate.

This skill owns the plan-specific risk cluster, questions, source reasons, exclusions, expected benefit and permission state; it does not duplicate the reusable package or reviewer procedure in `code-review-and-quality`.

For every candidate, record the threatened invariant, concrete failure mode and material impact, unresolved question, evidence already inspected and why it is insufficient, required source owners, and current permission coverage. Put signals in one cluster when they threaten the same invariant or causal chain and one bounded answer could resolve them. Separate clusters only when their threatened invariants and material failure modes are independent, resolving one would not materially resolve the other, and each retains its own evidence gap, 1–3 questions, benefit, and permission coverage.

Default to `0 specialist`. There is no task-wide one-specialist cap: multiple specialists are possible only when multiple genuinely independent unresolved material clusters each pass the full gate, and every specialist remains limited to one cluster. A count such as 2–3 is a possible result of the independence test, not a target or entitlement. Do not request broad whole-plan review, one reviewer per skill/file/symptom, delegation, or a follow-up turn that expands the original package.

Every action must be covered by current explicit permission. One owner instruction may authorize a bounded count or class of specialist actions; a new owner round-trip is required only when the next action would exceed its count, domain, access, package, or action boundary. Permission never substitutes for hard risk, material uncertainty, insufficient evidence, bounded context, or expected benefit. If specialist evidence is necessary but permission or a safe bounded package/executor is unavailable, record `not_run` and use `Blocked` when main evidence cannot establish a safe plan.

Quota controls package width, deduplication, low-value calls, and unnecessary repetition. When unresolved material correctness or safety risk blocks a trustworthy plan decision and a bounded specialist could materially resolve it, that safety benefit satisfies the expected-benefit gate; token cost alone must not veto the evidence.

Treat every specialist finding as a claim under External feedback reconciliation below. The main agent retains plan integration, correction decisions and the final recommendation.

## External feedback reconciliation

Treat each feedback item as a claim and classify it as exactly one of:

```txt
đúng trong scope (correct in scope)
đúng nhưng cần scope/decision mới (correct but requires new scope or decision)
sai (incorrect)
stale
xung đột (conflicting)
không đủ evidence (insufficient evidence)
```

Evaluate claims using higher-level safety and exact current owner decisions first, then repository routing and owning domain skills, approved master/ADR/per-PR contracts, actual repository/Git facts, and finally progress/problem sources within their status ownership. Reviewer assertions remain claims until verified.

Fix only claims that are correct and within current correction permission. Stop for material scope, decision or permission changes. Do not use majority vote, and do not treat a review verdict or confidence label as action permission. Formal implementation review and the reusable specialist package/reviewer contract remain owned by `code-review-and-quality`; this skill owns only the plan-review decision and reconciliation route.
