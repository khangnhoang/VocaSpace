# ASM-PR6: bounded evaluation and evidence reuse

ASM-PR6 evaluated a revision of VocaSpace's `supabase-safe-migration` skill against a real repository workload. The goal was not to minimize calls in isolation. It was to reduce redundant model work while retaining comparable baseline/candidate readers, evaluator review, provenance, bounded retries, and an explicit main-agent semantic adjudication.

## Result at a glance

| Measure | Result | Classification |
| --- | ---: | --- |
| Live comparison runs | `8` | Observed in retained run manifests |
| Candidate evaluation checkpoints | `10` | Reconstructed; the first run contained three candidate revisions |
| Model attempts recorded by the harness | `270` | Reconstructed from attempt records |
| Full-fanout counterfactual | approximately `672` | Estimated; not executed |
| Difference under that counterfactual | approximately `402` attempts | Derived |
| Relative reduction | approximately `60%` | Derived |
| Main-agent graph adjudication | `21/21` passed | Observed evidence plus main-agent adjudication; not owner acceptance |
| Main-agent severity | `0 Critical / 0 Required` | Observed evidence plus main-agent adjudication; not owner acceptance |

The `270` total is:

```text
98 + 10 + 12 + 35 + 5 + 39 + 12 + 59 = 270
```

The retained attempt records break down as follows:

| Run | Reader attempts | Evaluator attempts | Total |
| --- | ---: | ---: | ---: |
| `run-d2e1b1d1bcee4334ab28374cf6549b1b` | `64` | `34` | `98` |
| `run-11074b35f6494d3d947ab865b3aace52` | `8` | `2` | `10` |
| `run-2de434fc650b443fb1b3b85420c67ee0` | `8` | `4` | `12` |
| `run-2584f3eb15a14de1823476335e1e4dcb` | `19` | `16` | `35` |
| `run-461b4852b92d474db7c6fbeb5fa9b7ee` | `3` | `2` | `5` |
| `run-81720f2a1c0f44a29706a07bddca8afd` | `20` | `19` | `39` |
| `run-f0e0c78f72ab478bbf04c18b6ecd6bc6` | `8` | `4` | `12` |
| `run-2925a9e211e54465bf7c48e66f9f1b66` | `23` | `36` | `59` |

These are harness-recorded attempts, not a claim that every attempt produced a successful provider response. The runs include timeouts, quota failures, and targeted retries where the persisted evidence records them.

An R4 routing follow-up was intentionally outside the PR6 adjudication scope and added exactly `2` candidate-only calls. Including it would make the broader sequence `272`, but it is not included in the PR6 comparison above.

## Counterfactual

The comparison asks a narrow question: what if the same workflow had preserved `2 readers + 1 evaluator` per graph, but rerun the entire relevant suite after every correction checkpoint instead of probing affected closures and reusing exact-valid evidence?

The estimate is:

```text
First run, three candidate revisions:     3 x 66 = 198
Six subsequent 22-graph checkpoints:      6 x 66 = 396
Final 21-graph closure plus 15 retries:       63 + 15 = 78
                                                   --------
Estimated full-fanout total:                         672

Estimated difference:                     672 - 270 = 402
Estimated relative reduction:              402 / 672 = 59.8%
```

The `66`-attempt fanout is `22 graphs x (2 readers + 1 evaluator)`. The final closure uses `21 graphs x 3 = 63`, then adds the `15` evaluator retries that were actually required after quota failures.

This counterfactual was not executed. It therefore does not establish an absolute cost saving, a universal benchmark, or expected behavior for another repository, model, reasoning setting, rubric, or provider condition. It shows that PR6 used about `40%` of the attempts of one explicitly defined, evidence-comparable full-rerun workflow.

## Where the reduction came from

### Bounded affected-graph checks

Corrections were evaluated with deliberately small closures before the final candidate-wide evaluation:

- the initial canary used `3` calls and exposed `2 Required` findings before the remaining `63` units were opened;
- an R1/R5 probe used `10` attempts instead of a full `66`;
- its reprobe used `12` attempts;
- a trigger-safety probe used `5` attempts; and
- a later R1 impact probe used `12` attempts.

Only after those probes supported the correction did the workflow open the final candidate-wide evaluation closure. A `patch-check` closure is all-or-nothing for the selected graphs: dependencies remain explicit, incomplete units remain incomplete, and a targeted result is not silently promoted to a suite-wide result.

### Exact donor reuse

The harness can import reader results only when their fingerprints and provenance remain exact for the prepared inputs. PR6 used exact-valid donor records to avoid redispatching eligible readers, but this case study does not publish a sequence-wide avoided-dispatch total: the retained reuse manifests prove which records were imported, while not every run retained a durable selected-closure ledger that would prove every import was actually consumed by that closure.

### No automatic semantic promotion

The final required closure contained `21` current graphs. Seventeen evaluator proposals were `satisfied`. Four were `partially_satisfied`; the main adjudication reviewed the paired reader outputs, frozen criteria, expected behavior, safety vetoes, and historical evidence before recording them individually as passed.

That distinction matters. The four proposals reflected uncertainty about available implementation evidence, not four proven defects in the skill. Treating every partial evaluator proposal as an automatic correction would have created unnecessary edits and reruns.

## What the harness guarantees

For a prepared run, the CLI harness records and checks:

- immutable package inputs, hashes, workspace identity, and provenance;
- zero-dispatch preparation before live execution;
- reader-to-evaluator dependency closure;
- explicit concurrency and attempt ceilings;
- no automatic retry beyond the authorized command;
- exact donor reuse with a separate reuse manifest; and
- truthful incomplete, failed, unknown, and budget-blocked states.

The harness does not decide whether a response is semantically correct. Skill guidance defines the behavioral scope and evaluation rubrics; evaluator output is advisory; the main adjudication owns the semantic review recommendation, while the repository owner retains final acceptance.

## Adjudication boundary

The main-agent adjudication concluded that `21/21` required graphs passed with `0 Critical / 0 Required` for the exact final candidate and the recorded `gpt-5.6-sol` / `medium` evidence set. This is not an owner-acceptance record, a stability guarantee for future model output, or a claim that the same behavior will hold under other configurations.

The repository keeps the auditable control-plane design and concise decision record in Git. Raw model packages, transcripts, and machine-specific temporary paths are not published because they can contain repository material and runtime-local data.

## Repository evidence

- [ASM-PR6 implementation plan and final adjudication](../agent-skills/implementation-plans/asm-pr6/plan.md)
- [Evaluation design and evidence contract](../../.agents/skills/maintain-repo-skills/references/eval-design.md)
- [Evaluation adjudication and correction workflow](../../.agents/skills/maintain-repo-skills/references/evaluation-adjudication-and-correction.md)
- [CLI harness](../../.agents/scripts/run-skill-eval-cli.mjs)
- [Supabase skill evaluation suites](../../.agents/evals/supabase-safe-migration)
