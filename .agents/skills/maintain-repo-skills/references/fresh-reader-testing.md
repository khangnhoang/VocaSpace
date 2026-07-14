# Fresh-Reader Testing Procedure

Use this procedure only when the `Resource routing` condition in the parent `SKILL.md` is true. It defines manual contract-level evidence before the formal schema and runner exist; it does not implement an evaluation runner or grant model/subagent execution permission.

## Purpose

Use a fresh-reader check to learn whether a reader without the authoring-session narrative can determine the intended ownership, approval, permission, resource routing, source hierarchy, handoff, lifecycle, status, stop, or reporting behavior.

A self-review may find defects, but it is not fresh-reader evidence. A reviewer who received the expected answer, author conclusion, suspected defect, intended fix, or full authoring-session context is not a valid fresh reader for that observation.

## Prepare a bounded case

Record before execution:

- one focused scenario or question;
- the exact behavior the document is expected to make decidable, kept outside the executor prompt;
- every file and excerpt supplied to the executor;
- the reason each supplied source is necessary;
- the executor/session type;
- actual filesystem, tool, network, credential, remote, and mutation access;
- the status vocabulary and evaluation criteria.

Do not supply the expected answer, forbidden behavior list, author conclusion, output from another variant, or old/new identity unless the case explicitly evaluates disclosure of that information.

## Supply only required context

For a repository-routing or governance-comprehension case, the bounded package normally contains:

1. the scenario prompt;
2. the relevant `AGENTS.md` routing excerpt or full file;
3. the target `SKILL.md`;
4. only the references whose exact read conditions are true;
5. any competing skill metadata needed by the scenario.

List the supplied files in the observation. Instruction-bounded context is not filesystem isolation. Call the executor isolated only when the environment actually prevents access beyond the approved package or disables the relevant tools.

## Execute read-only

Ask the reader to explain the decision or produce the bounded behavior. Do not authorize repository edits, Git mutation, remote access, model calls, production access, database changes, or destructive actions merely to create evidence.

If the case requires enforcement that the environment cannot provide, record `not_run`. Owner approval cannot convert unsupported isolation or unsafe mutation into valid evidence.

## Record the observation

Use this compact record:

```text
evidence_type: manual fresh-reader
status: passed | partially_passed | failed | not_run
date:
scenario:
bounded_prompt:
supplied_context:
executor_context:
actual_access_and_enforcement:
observation:
missing_or_incorrect_behavior:
known_variance:
claim_limitations:
```

Keep raw observation separate from the author's comparison or release decision. Missing observation is incomplete evidence, not a pass.

## Assign status

- `passed`: the observation covers the bounded criteria without a known material error.
- `partially_passed`: useful behavior is present, but a material criterion is incomplete or ambiguous.
- `failed`: the reader reaches an unsafe, incorrect, or materially misleading result under the supplied contract.
- `not_run`: no valid independent executor/context/enforcement was available, or execution was not authorized.

## Claim boundaries before formal runner support

Manual evidence may report the bounded prompt, supplied context, actual observation, access limits, and status.

Do not describe it as:

- runner-produced;
- versioned-suite evidence;
- strictly isolated when only the prompt limited context;
- baseline-equivalent without an explicit comparable baseline and equivalent conditions;
- a formal A/B comparison;
- proof of native platform auto-trigger behavior;
- proof of broader behavior outside the recorded case.

When no qualified fresh reader is available, record `fresh-reader: not_run` with the reason. Do not substitute self-review and do not weaken the requirement by relabeling a contaminated reader.
