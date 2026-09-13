# Shared Author Self-Review Methodology

## Ownership boundary

This document owns only the generic methodology an author applies when self-reviewing an actual plan, implementation, change set, or managed-author candidate. `docs/agent-loops.md` owns activation, review depth, and lifecycle placement. Planning, domain, testing, Git, formal-review, and managed-workflow sources retain their artifact-specific procedures, evidence requirements, and consequences.

Self-review may expose defects, but it does not create independence or fresh-reader evidence, replace a mandatory Reviewer, Specialist, fresh-reader check, or manual QA requirement, or grant implementation, Git, remote, production, destructive, or lifecycle-transition authority.

## Read and application boundary

Read this document completely when `docs/agent-loops.md` routes an author into an applicable self-review boundary. Read it once for that boundary and apply it together with every applicable local extension; multiple local extensions do not create additional reads. If it was already read completely as a governing or target source and remains unchanged and reliably available in current context, that read satisfies the boundary.

Plan and implementation self-review are separate boundaries. When correction changes the candidate or its supporting evidence, reapply the affected methodology to the new current state. Reread this document only when its contract may have changed or is no longer reliably available in current context.

## Method

### 1. Anchor the review object

Return to the exact current governing sources before semantic judgment:

- the Owner request or accepted requirement;
- the accepted plan or contract when one exists;
- applicable scope, exclusions, acceptance criteria, and authority boundary; and
- the actual current candidate, repository state, and evidence.

Do not review from memory, planned steps, author intent, an author summary, a conversational claim that a correction exists, an intended architecture, or an earlier candidate or evidence snapshot. If candidate identity or currentness is uncertain, resolve it through the owning repository or Git procedure before continuing.

Close only the cheap mechanical or currentness questions needed to establish that the correct object and evidence are being reviewed. Do not run every expensive check before semantic review merely because it is deterministic.

### 2. Try to falsify the candidate

Use the governing contract, task risk, and affected boundaries to identify only plausible material ways the candidate could be wrong. Challenge omitted requirements, unsupported assumptions, wrong ownership, incomplete state transitions, scope leakage, missing boundary or failure paths, stale evidence, and claims stronger than their support.

Keep these hypotheses bounded, specific enough to test, and proportional to the task. Do not require a fixed count, durable registry, ritual phrase, long checklist, or invented defect. Inspect the actual candidate and current evidence against the hypotheses, using deterministic evidence whenever a question is machine-decidable.

Focus semantic judgment on requirements, behavior, ownership, boundaries, and readiness that deterministic evidence cannot establish by itself.

Before concluding semantic review, verify the most plausible remaining material reason an independent reviewer could reject the candidate, if such a reason exists. Correct or reclassify a supported defect under the owning workflow; do not manufacture one to complete the step.

### 3. Close affected verification and reconcile readiness

After the semantic candidate is stable, run or reuse every applicable deterministic check established by the owning contract. Use deterministic tools for deterministic questions. A deterministic failure cannot be overridden by narrative judgment.

Reuse unchanged passing evidence while its candidate, inputs, contract, and relevant environment remain current. Rerun only checks that a later change or currentness break could invalidate. Artifact and domain owners determine the exact tests, validators, schemas, path or literal comparisons, Git checks, manual evidence, and broader verification required.

Ground every material or non-obvious correctness or readiness claim in concrete current evidence. Reference an already established deterministic result instead of re-arguing the same fact. When required evidence is missing, stale, failed, unavailable, or only partial, preserve the corresponding failed, unverified, partial, or blocked status and identify the affected claim.

## Proportionality

Scale depth to semantic risk, affected boundaries, verification complexity, and uncertainty. Do not create an extra role, session, artifact, lengthy report, repeated unchanged check, formal review, or citation ceremony solely to demonstrate that self-review occurred. Small `NORMAL` work remains eligible for the universal minimum review; discovered material risk may still trigger the stricter depth owned by `docs/agent-loops.md` and the applicable skill.
