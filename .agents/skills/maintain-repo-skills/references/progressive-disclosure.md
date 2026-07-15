# Progressive Disclosure Procedure

Use this procedure only when the `Resource routing` condition in the parent `SKILL.md` is true. The parent core remains authoritative for permission, safety, ownership, related-skill routing, and stop behavior.

## 1. Inventory the current bundle

List every file and classify each section of current or proposed content as one of:

```text
mandatory core invariant
decision or routing rule
conditional procedure
matrix or checklist
template or example
unsupported or unrelated content
```

Record the valid invocation group that does not need each proposed reference. If no meaningful group can skip the content, keep it in core.

## 2. Protect mandatory core

Keep content in `SKILL.md` when an agent must know it before deciding whether it may act, which source owns the decision, which related skill to read, whether a resource is required, when to stop, or how to report truthfully.

Do not move these items out of required context merely to reduce line count:

- activation and ownership;
- authority and precedence;
- approval, implementation, review, Git, remote, production, and destructive boundaries;
- safety veto and evidence-claim boundary;
- source-of-truth ownership;
- related-skill and resource routing;
- stop and reporting contracts.

## 3. Establish a resource consumer

For every proposed resource, write down:

- the task or decision that consumes it;
- why core alone is insufficient for that task;
- which valid task group can skip it;
- why an existing source cannot own the same information;
- whether the resource contains procedure, matrix, checklist, template, example, questionnaire, or detailed guidance.

Do not create the resource if the consumer is hypothetical, duplicated, or outside the approved scope.

## 4. Write an exact read condition

Express the condition as an observable task or change, not as vague advice.

Prefer:

```text
Read before adding, deleting, renaming, or moving a bundled resource.
Read when changed skill text adds or changes required permission behavior.
```

Avoid:

```text
Read when useful.
Read for advanced work.
Consult as needed.
```

The condition must be non-empty, distinguish tasks that need the resource from tasks that do not, and require the read before the affected decision or evidence claim.

## 5. Keep the bundle contained

- Use a relative path from `SKILL.md`.
- Keep the target inside the skill directory.
- Link each resource directly from the core resource-routing table.
- Do not use a reference to discover another required reference.
- Do not follow or introduce symlinks, junctions, or reparse-point indirection as resource routing.
- Do not add a script, asset, metadata file, or placeholder unless the approved scope has a demonstrated consumer.

## 6. Review the split

Review core without loading references and answer:

1. Can the agent determine authority and permission?
2. Can the agent identify mandatory safety and evidence limits?
3. Can the agent choose every required related skill and reference?
4. Can the agent identify stop conditions and reporting requirements?

Then review each resource and answer:

1. Does its exact condition select this resource and exclude a meaningful near miss?
2. Does its path resolve inside the bundle?
3. Does it duplicate or weaken core?
4. Is every section used by the stated consumer?
5. Would deleting the resource leave a hidden mandatory rule missing from core?

Any known safety, permission, routing, correctness, ownership, or verification regression rejects the split even if core becomes shorter.

## Output

Record:

```text
Resource:
Consumer:
Exact read condition:
Valid invocation that skips it:
Content moved:
Mandatory core audit:
Path/link result:
Known regression:
Decision: keep in core / create resource / revise / reject
```
