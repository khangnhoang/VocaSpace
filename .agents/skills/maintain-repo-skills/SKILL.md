---
name: maintain-repo-skills
description: Repository-specific governance contract for creating, changing, reviewing, documenting, progressive-disclosing, or evaluating repo-local agent skills and bundled resources. Use before altering `.agents/skills/**`, skill routes in `AGENTS.md`, or repo-local skill governance and evidence contracts.
---

# Maintain Repo Skills

## Activation and ownership

Use this skill for work that creates, changes, reviews, splits, routes, documents, or evaluates a repo-local agent skill or its bundled resources.

Do not use it merely because an ordinary product, test, database, frontend, or documentation task follows an existing skill. Trigger it when the repo-local skill artifact, routing, governance, or evidence contract itself is in scope.

This skill is the authoritative VocaSpace contract for the lifecycle, safety, documentation, evaluation boundary, permission invariant, and stop conditions of repo-local skill changes. System or external skill-authoring guidance is optional and generic. It may help with authoring technique, but it is not a dependency and cannot override this contract or a more restrictive repository rule.

This skill does not own Git command procedure, product-domain behavior, or remote operations.

## Authority and precedence

Apply higher-level safety and permission restrictions first. Within repository-owned guidance:

1. Follow the owner's explicit current-task decisions and action permissions.
2. Follow `AGENTS.md` for explicit repository routing and `docs/agent-loops.md` for lifecycle routing.
3. Use this skill for repo-local skill-change governance.
4. Use the relevant domain and lifecycle skills for the work they own.
5. Treat system or external skill-authoring guidance as optional generic advice only.

When sources conflict, follow the more specific or more restrictive rule and report the conflict. Do not average incompatible rules.

This skill cannot approve itself. An agent-authored skill, plan, evaluation, or material governance revision remains a draft until the owner approves the material decision that the agent introduced or changed.

## Permission and approval boundaries

Keep these gates separate:

- **Decision approval:** approves the specified scope, behavior, architecture, ownership, or acceptance criteria.
- **Implementation permission:** allows the specified local file changes.
- **Review permission:** is read-only by default unless the owner or an already-approved workflow explicitly authorizes corrections.
- **Git and remote permission:** branch changes, staging, commit, push, pull-request actions, merge, release, and deployment each follow their owning workflow and the owner's explicit permission.

Plan approval does not grant implementation permission unless the same instruction clearly grants both. Implementation permission does not grant stage, commit, push, pull-request, merge, deploy, production, remote-mutation, destructive, history-rewrite, or force permission.

A review verdict, confidence label, verification result, or the word `approved` is informational. It never grants another action.

Do not use a plan or material brief revision written by the agent as authority to implement that revision. Unchanged, previously approved work may continue only when it is independent of the unresolved revision and remains within the current permission.

## Safety veto and evaluation boundary

Reject a skill change when it introduces a known regression in safety, permission handling, routing, correctness, ownership clarity, stop behavior, or verification truthfulness. Context, line, byte, or complexity reduction never outweighs such a regression.

Keep evaluation claims within the evidence actually produced:

- Separate deterministic structure checks from semantic behavior judgment.
- Record checks that ran, their actual result, skipped checks, and environment limits.
- Label historical evidence and revalidate it before presenting it as current.
- Do not call manual observation runner-produced, isolated, baseline-equivalent, formal A/B, or versioned-suite evidence unless those properties were actually enforced and recorded.
- Do not infer native platform auto-trigger behavior from explicit `AGENTS.md` routing.
- Do not invoke a model, runner, remote service, or mutation-capable evaluation unless the current task and the owning contract authorize it.

## Required workflow

1. Read root and nested repository instructions, lifecycle overlays, relevant domain skills, current plans/progress sources, and the affected skill bundle before writing.
2. Reconcile draft or tracker claims with Git and repository evidence. Separate confirmed facts, owner-approved decisions, agent proposals, conflicts, and unknowns.
3. Identify the source that owns each intended or current fact. Do not create a duplicate plan, tracker, ADR, reference, or resource when an authoritative source already exists.
4. For non-trivial work, use `implementation-planning-and-pr-breakdown` to define goal, scope, exclusions, dependencies, acceptance criteria, verification, risks, and stop conditions. Do not turn this program's durable-documentation requirement into a universal plan-file gate.
5. Stop before implementation unless the owner has approved the material decisions and granted implementation permission for the current scope.
6. Implement the smallest coherent change. Preserve existing conventions and avoid speculative resources, tooling, metadata, or migrations.
7. Verify the actual diff with checks proportional to the changed contract. Do not claim checks that did not run.
8. Use `code-review-and-quality` for a read-only review. Correct findings only when the current instruction or approved workflow authorizes corrections.
9. Update only the documents that own changed information, then report the exact permission and remote-action state.

## Core and bundled-resource boundary

Keep the following in core when applicable:

- activation and ownership;
- authority and precedence;
- approval, implementation, review, Git, remote, production, and destructive boundaries;
- safety veto and evaluation-claim boundary;
- source-of-truth and documentation ownership;
- related-skill routing;
- resource-routing conditions;
- stop conditions;
- output and reporting contract.

Use references only for detailed procedure, matrix, checklist, template, example, questionnaire, or guidance that a meaningful group of valid invocations does not need.

Every bundled reference must:

- have a demonstrated consumer;
- be linked directly from `SKILL.md`;
- have an exact, non-empty read condition in the resource-routing table;
- use a relative path that stays inside the skill bundle;
- avoid an unnecessary nested reference chain;
- avoid duplicating mandatory core rules.

Do not split content based only on line count. Do not create an empty or speculative resource.

## Resource routing

| Resource | Read condition |
| --- | --- |
| [references/progressive-disclosure.md](references/progressive-disclosure.md) | Read before adding, deleting, renaming, or moving a bundled resource; moving content between core and a reference; or reviewing a proposed core/reference split of a repo-local skill. |
| [references/fresh-reader-testing.md](references/fresh-reader-testing.md) | Read before designing, running, or reporting a fresh-reader check; and when changed skill text adds, removes, or changes required behavior about ownership, approval, permission, resource routing, source-of-truth hierarchy, durable handoff, or lifecycle/status interpretation. |
| [references/eval-design.md](references/eval-design.md) | Read before designing, adding, changing, validating, preparing, or reporting a repo-local skill evaluation suite or runner-owned evidence artifact; and before making comparative, isolation, provenance, or evidence-retention claims from those artifacts. |

Do not read a reference merely because it exists. Read it when its condition is true, before performing the affected work or making the affected evidence claim.

## Documentation ownership

For the agent-skill governance program:

- `docs/agent-skills/plan.md` owns intended program scope, dependencies, phases, and proposed program structure.
- An approved per-PR plan or owner-authored brief owns the detailed execution contract for that PR.
- `docs/agent-skills/progress.md` owns current actual status and verification evidence.
- `AGENTS.md` owns explicit repository skill routing.
- The affected skill bundle owns its operational behavior.

This durable-documentation arrangement is a continuity requirement for this multi-PR program. It is not a repository-wide rule requiring every implementation task to create a plan file.

Update only the source that owns information changed by real evidence. Do not record future work as completed. Distinguish at least `implemented`, `verified`, `committed`, `pushed`, `PR open`, and `merged` when those states matter. Historical branch, verification, or approval evidence must remain labeled as historical rather than current.

## Related-skill routing

Read and follow:

- `implementation-planning-and-pr-breakdown` for non-trivial discovery, scope, dependencies, acceptance criteria, verification planning, and durable handoff;
- `code-review-and-quality` for checkpoint, branch, diff, or readiness review;
- `git-checkpoint-workflow` for branch provenance, dirty-tree safety, staging, commit, correction, and local/remote Git boundaries;
- `github-pr-ci-workflow` for GitHub pull-request and CI operations when the owner activates that workflow;
- every domain skill affected by the content or behavior of the skill being changed.

Related-skill routing does not grant the action that the related skill describes. The current owner instruction must still authorize it.

## Stop conditions

Stop and report instead of guessing or expanding scope when:

- repository evidence materially conflicts with an owner-approved decision;
- branch, base, dependency, dirty-tree ownership, or authoritative source cannot be established;
- a material business, architecture, ownership, permission, acceptance, or verification decision remains unresolved;
- the work requires a resource, tool, schema, runner, CI change, migration, or refactor outside the approved scope;
- a mandatory invariant cannot remain in required context;
- an exact resource read condition or valid contained path cannot be established;
- evidence is stale, incomplete, non-equivalent, or stronger than the environment can support;
- a safety, permission, routing, correctness, ownership, stop-behavior, or verification regression is found;
- proceeding requires ungranted Git, remote, destructive, production, database, deployment, or credential access;
- a required review finding remains unresolved.

## Output contract

At a planning, implementation, or review checkpoint, report:

- goal, approved scope, exclusions, and authoritative source;
- branch/base/dependency and working-tree ownership when Git state is relevant;
- changed files or proposed file tree and why each source owns the change;
- permission state for implementation, commit, push, PR, merge, deploy, remote, production, and destructive actions;
- verification commands actually run, results, skipped checks, and evidence limitations;
- review type, findings, resolutions, remaining Critical/Required findings, and readiness verdict;
- fresh-reader status and claim boundary when the change requires that evidence;
- exact current Git/remote state and the smallest next owner action.

After a completed implementation prompt, follow `git-checkpoint-workflow`: recommend an English Conventional Commit message, but do not stage or commit without explicit owner approval.
