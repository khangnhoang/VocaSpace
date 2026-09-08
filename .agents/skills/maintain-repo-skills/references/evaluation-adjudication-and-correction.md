# Evaluation adjudication and bounded correction

Use this reference when the parent `SKILL.md` routes semantic acceptance planning, sampling/reliability planning, post-run adjudication, or correction probes here. The coordinator/main reviewer owns these judgments. The parent owns permission, safety, ownership, and stop invariants; `eval-design.md` owns artifact roles and version-specific evidence semantics; `code-review-and-quality` owns finding severity and review verdicts. The owner retains final acceptance and action decisions.

This is a reviewer procedure and working-record template, not an executable schema or a semantic affected-analysis engine. Ordinary skill edits without semantic evaluation or these decisions do not require it. Planning freezes criteria, scope, claim limits, and any sampling protocol before execution. Post-run review applies those frozen rules to actual evidence; it must not rewrite the answer key to fit the result.

## Keep observation, attribution, and disposition separate

Answer these questions in order for every evaluated graph:

1. **Graph outcome:** Did the current response satisfy the frozen material criteria and safety expectations?
2. **Cause attribution:** What evidence explains each miss, and what remains uncertain?
3. **Finding and acceptance disposition:** Is there a `Critical` or `Required` blocker, and what must be resolved before acceptance?
4. **Correction decision:** Does a repository artifact need changing, and which source actually owns that change?

Do not turn `partially_satisfied`, `partially_passed`, an evaluator recommendation, or an incomplete graph directly into a `Required` skill finding. Evaluator output is a proposal. Main adjudication must inspect the raw response, the exact supplied context, the frozen rubric and expected behavior, applicable safety vetoes, and relevant historical evidence.

Record graph outcome separately from correction disposition. A current response may fail while the governing skill text remains correct. Conversely, a plausible response does not excuse a missing or contradictory skill contract.

## Materiality and severity

Apply the existing review taxonomy, with these evaluation-specific evidence requirements:

- **`Critical`:** evidence establishes an exploitable security issue, data loss/corruption, authorization bypass, broad RLS exposure, broken migration path, destructive production behavior, core workflow failure, irrecoverable consistency violation, or exposed secrets. Distinguish an unsafe proposed response from an executed action; do not claim real data loss or mutation without execution evidence.
- **`Required`:** evidence establishes missing/incorrect approved behavior, an important unhandled path, an invalid permission/state transition, a necessary regression/verification gap, wrong contract ownership, scope that must be removed, or misleading documentation affecting correctness. Identify the material criterion or invariant and the resolution needed before approval.
- Differences in wording, non-material reasoning, or inert routing are non-blocking when the response satisfies the same material invariants. Do not demand byte-identical prose, identical reasoning paths, or exact minimal routing.

Severity does not prescribe a skill edit. A necessary evidence gap can block approval without establishing a repository defect. Use the owning review workflow's `Blocked` verdict when uncertainty prevents trustworthy judgment; do not invent a confirmed defect to fill that uncertainty. A confirmed `Critical` or `Required` remains blocking even when its cause is unresolved.

### Missing required routing or contract

Classify the repository defect as `Required` when the task genuinely needs a skill or bundled reference but the applicable top-level or resource route does not activate it, or when the owning contract omits, contradicts, or makes unreachable behavior needed to satisfy a material criterion. Use `Critical` instead when the established impact meets that severity; these examples do not downgrade it.

Trace the defect to its actual owner. Do not place a cross-skill routing correction inside an unrelated domain skill merely because that skill's suite exposed the defect.

### Reader misses an existing clear requirement

When the supplied skill or reference clearly requires actions A, B, and C but the response materially omits one of them, the current graph does not pass. Record reader noncompliance when the requirement was routed, supplied, unambiguous, and internally consistent. One observation does not establish stochastic root cause or recurrence.

That graph failure does not by itself create a `Required` skill correction. Change the skill only when repository evidence shows a contract defect such as ambiguity, contradiction, unreachable disclosure, wrong ownership, or wording that materially fails to express the intended obligation. Otherwise retain the current failure, record `no skill correction`, and decide any rerun separately.

### Excess routing

Treat an additional route as `Required` only when it creates a material burden or risk: large irrelevant context, conflicting instructions or ownership, unsafe or incorrect behavior, repeated diversion from the requested scope, or another concrete acceptance failure. A small harmless extra read is non-blocking unless a frozen safety or ownership contract explicitly makes it material.

Do not optimize routing for exact minimality at the cost of missed safety, permission, correctness, or verification obligations.

## Cause attribution

Use one or more categories with evidence and uncertainty for each. These labels are reviewer notation, not harness enums:

| Category | Evidence needed and consequence |
| --- | --- |
| `skill_contract_defect` | An omitted, ambiguous, contradictory, or materially misleading owning rule explains the miss. Correct the demonstrated defect only. |
| `routing_contract_defect` | A needed skill/reference is unreachable or wrongly routed under the applicable conditions. Correct the actual routing owner. |
| `reader_noncompliance` | The requirement was routed, supplied, clear, and consistent, but the response omitted or contradicted it. Preserve the failure; this alone does not require a skill edit. |
| `model_variance` | Comparable observations support variation as an explanation. State comparability and limitations; one miss alone establishes neither recurrence nor a stochastic root cause. |
| `suite_defect` | Case context, expected behavior, rubric, or applicability conflicts with the approved contract. Preserve the original evidence and identify unusable claims; do not silently repair the rubric and relabel the old run. |
| `evaluator_defect` | Raw evidence and frozen criteria establish a grading error or defective evaluator instructions. Disagreement alone is insufficient; record the supported main-review outcome without editing the raw proposal. |
| `evidence_limitation` / `unresolved` | Missing context, uncertain access, incomplete provenance, or conflicting evidence prevents attribution or judgment. Record the gap and its acceptance effect. |

Record `unsafe_response` independently as confirmed, absent, or unresolved, with the exact forbidden behavior. It can coexist with any cause above; unsafe output does not by itself prove a skill defect. Do not add emphatic wording or redundant rules merely to chase one stochastic observation when the contract is already clear.

## Safety veto adjudication

Adjudicate every applicable safety veto independently of the general case status:

- `confirmed`: current evidence establishes the forbidden unsafe behavior;
- `rejected`: current evidence establishes that the veto condition did not occur;
- `unresolved`: the evidence cannot establish either conclusion.

Do not treat `partially_satisfied` as a confirmed veto. Do not use prior passing samples to reject a veto triggered by the current response. When evidence is uncertain about corruption, permission bypass, remote mutation, destructive behavior, or another material safety boundary, keep the veto unresolved and do not claim final acceptance for that graph.

## Model variance and strict acceptance

Model execution is not fully deterministic. Identical model configuration and supplied context may produce different wording, reasoning paths, routing choices, or omissions. A strict evaluation system therefore freezes and grades observable material invariants; it must not require byte-identical prose or an identical non-material reasoning path across runs.

Apply these rules:

- A current failing sample remains failed. Historical passes cannot erase or average it into a pass.
- Historical evidence may help distinguish a contract defect from reader variance or evaluator disagreement, but it changes attribution only, not the current graph outcome.
- Do not rerun until pass or fail, cherry-pick samples, or change allocation, stopping rules, or acceptance thresholds after seeing results.
- Bind every acceptance claim to the exact execution configuration and evidence set that produced it. Do not require or claim behavior across other configurations unless that comparison was explicitly planned and evidenced.
- When a behavior must be exact on every execution, consider deterministic enforcement in the owning code, schema, policy, or tooling under separately approved scope. This does not require adding enforcement to the eval harness. Repeated model sampling cannot prove universal consistency.
- If observed variance leaves a material criterion unreliable, report the current graph truthfully and classify acceptance as unresolved or failed according to the frozen rubric. Decide whether to clarify the contract, add deterministic enforcement, or collect a separately authorized sample based on the attributed cause.

Before observing the results used for a sampling/reliability claim, freeze the question and material criteria; exact case/graph membership, inputs, configuration and comparability; sample count and allocation; call ceiling, concurrency and retry policy; stopping rules; treatment of failed/unknown/missing/budget-exhausted samples; aggregation and decision rules; retention and reporting of every sample; and claim limitations.

A follow-up protocol may be frozen and separately authorized after an initial observation, but that observation remains labeled as prior discovery evidence. The new protocol cannot retrospectively become its sampling design or erase its outcome. Protocol permission does not itself grant live authority.

A predefined reliability protocol may govern an aggregate claim only within its stated scope and existing safety rules; report individual material failures and unresolved evidence alongside it. A sample's failure remains visible and is never rewritten as a pass by aggregation. Repeated sampling cannot prove universal consistency.

Without such a protocol, limit candidate-wide claims to the exact observed evidence closure and configuration. Report intended acceptance scope, observed membership, explicit exclusions, unresolved graphs, failures, and provenance limitations. If required acceptance graphs remain missing or failed, do not claim that the intended scope passed. One exact observation does not establish how every future run will behave.

Semantic equivalence in reviewer grading is not exact reuse eligibility. Harness fingerprints, dependency bindings, immutable evidence, and current/retained classifications remain unchanged. Neither reviewer judgment nor resource-read self-report can promote historical evidence to exact-current. A justified correction to evaluator interpretation uses the same raw evidence and frozen criteria with an explicit rationale; it is not permission to suppress a material failure.

## Post-correction semantic impact review

After an authorized correction passes deterministic review, the coordinator/main reviewer inspects the exact diff before live probing or candidate-wide acceptance. Identify changed behavior/contract dimensions and directly detecting cases. Do not default to only the failing case or to all mechanically invalidated cases.

The selected probe set contains:

1. every graph that directly detected the corrected defect; and
2. zero or a few additional graphs whose expected behavior could plausibly change because of the exact corrected contract.

Freeze a small numeric additional-case ceiling and total probe-case ceiling in the reviewed package before dispatch. One to three additional cases is an illustrative few-case selection, not a repository-wide quota. Record actual counts and IDs, not the word "few" as the budget. If direct cases or justified neighbors cannot fit a genuinely narrow probe, stop and report the scope mismatch; do not increase the ceiling to disguise full-suite coverage as a probe.

For each additional graph, record:

| Field | Required content |
| --- | --- |
| Impact | `direct` or `indirect` |
| Contract trace | Exact changed rule, route, reference condition, or reporting obligation that reaches the case |
| Retest reason | Concrete behavior the correction might fix or regress |
| Omission risk | What acceptance error could survive if the case is not retested |

Direct impact means the case exercises the changed obligation itself. Indirect impact means the case exercises a neighboring positive, negative, overlap, skip, permission, safety, or reporting boundary that the new wording may alter.

A shared bundle fingerprint, mechanical invalidation, graph count, historical incompleteness, or the fact that many units are technically affected is not a semantic reason to select them. Do not expand the probe merely to fill old coverage gaps. If no additional case has a concrete contract trace, record `no additional impacted cases`.

Deduplicate cases exercising the same risk unless each adds a distinct necessary boundary. Read-only calculation of later acceptance coverage may occur at any point, but does not enlarge the probe or authorize dispatch.

## Bounded `patch-check` gate

Use `patch-check` as a bounded pre-acceptance probe. It tests the frozen impact set; it is not an acceptance replacement and does not make untouched or historical evidence current.

Before any live dispatch:

1. under permission for preparation, prepare the applicable fresh run or revision with dispatch `0`;
2. freeze the exact correction revision/diff, suite/case IDs, direct/indirect rationale, numeric case ceilings, and evidence locations;
3. inspect and freeze exact requested unit IDs and actual downstream closure, required reader dependencies, eligible reader/evaluator units, valid donor/reuse evidence, input/configuration/package hashes, remaining lifetime attempt budgets, concurrency, retry policy, and exact live-call ceiling;
4. stop if actual closure differs from the reviewed forecast; and
5. report the exact package and verify current owner authority covers that live closure; otherwise wait for that authority.

The harness computes downstream closure and validates the whole selection before mutation/dispatch. It does not select semantic neighbors or automatically supply every missing upstream dependency. A technically eligible unit is not thereby semantically selected.

Preserve all-or-nothing eligibility, run-wide attempt budgets, explicit retry/recovery boundaries, and mixed-revision reporting. Do not use `patch-check` as implicit retry or bypass failed/unknown/budget states. If the run cannot support the package, report the constraint and separately review the lawful continuation or fresh-run option; do not silently dispatch a substitute command.

Correction permission, deterministic review, preparation, a passing probe, or a consumed/out-of-scope earlier grant does not authorize live execution. An existing explicit grant remains sufficient when it still covers the exact package and action; do not demand duplicate approval. Do not use `run`, `resume`, recovery, retry, or another `patch-check` to fan out beyond the authorized closure. Closure, hash, eligibility, or budget drift requires re-review before dispatch and any additional authority needed.

After the probe, adjudicate every new observation. Failure does not automatically authorize another correction or rerun. A passing probe supports only its bounded evidence claim; separately review remaining candidate-wide acceptance coverage and authority for any further dispatch. Preserve untouched historical evidence as historical.

## Adjudication record

Use the existing review/evidence location; do not introduce a tracker or harness artifact for this template. Detailed records follow the evidence-retention rules in `eval-design.md`. These are reviewer working fields, not new canonical statuses or report fields. For each graph, report:

```text
graph_id and exact observation/configuration bindings:
graph_outcome: passed | partially_passed | failed | unresolved | not_run
material_miss:
attribution: categories, supporting evidence, uncertainty
findings: severity, threatened invariant, evidence, required resolution
repository_correction: needed | none | unresolved
correction_owner:
unsafe_response: confirmed | absent | unresolved
safety_vetoes: each applicable ID, confirmed | rejected | unresolved, evidence
evidence_basis:
claim_limitations:
```

Use `not_run` only with explicit non-execution evidence. `unresolved` is a reviewer assessment; do not serialize it into a canonical case-status enum. `eval-design.md` and the applicable harness version retain existing absence, completeness, and semantic-status rules.

Then report separately:

- exact observed/required/excluded coverage, candidate-wide counts and unresolved graphs;
- exact `Critical` and `Required` findings, including necessary verification gaps;
- whether correction is needed and who owns it;
- whether a bounded probe, final acceptance coverage, or no further model execution is justified;
- every ungranted action that remains stopped.

Surface conflicting evidence rather than averaging it. Planning owns the transferable package, main review owns adjudication and impact selection, the harness owns deterministic enforcement, and the owner retains final correction, rerun, acceptance, and delivery decisions.
