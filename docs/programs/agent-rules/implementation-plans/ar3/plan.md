# AR3 detail plan — align agent instructions with the DevSpace workflow

Revision: r3, 2026-10-27. Owner approval: approved on 2026-10-27 after independent gpt-6.1-sol high read-only review PASS of r3. r2 added D12 and the shared review-wait contract in AC8; r3 removes the redundant Claude-rules binding/pointer for that shared review process, already imported through CLAUDE.md. Master plan: none; this unit extends the existing agent-rules program. Execution mode: NORMAL, one author. Size: large governance change. The Owner authorized a local plan commit, implementation of this plan and local commits throughout implementation. Push, PR, merge, database/browser actions and additional model execution remain separate authorities.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: VocaSpace has a smaller, coherent instruction system adapted from DevSpace, with one owner per rule, explicit task activation, conditional references and no retired managed orchestration. Shared instructions remain usable by both Codex and Claude. This is an instruction change, not a product or database change.

| ID | Observable result |
| --- | --- |
| AC1 | AGENTS.md owns shared engineering principles, permissions, language and skill routing; docs/agent-loops.md owns sizing, lifecycle timing, required review/wait behavior, self-review cadence/cap and stop rules; .claude/rules.md owns Claude-specific roles, tools, sessions and bindings. CLAUDE.md imports those three sources and introduces no competing policy. |
| AC2 | Each in-scope DevSpace skill and reference is dispositioned as adopt, adapt, already satisfied or exclude, with a concrete reason. This compact mapping lives in this plan or the final change report, not a new registry. A line-count reduction is not behavioral acceptance or proof of token savings. |
| AC3 | The managed MULTI_AGENT_MASTER_PLAN / MULTI_AGENT_E2E modes, mandatory managed roles, dispatch/admission ledger, review-artifact protocol, managed correction rounds and dedicated project profiles are removed from active instructions/configuration. Ordinary authorized subagent or side-session use remains possible. The unit does not replace the removed workflow with another orchestration framework. |
| AC4 | The generic self-review method has one owner in code-review-and-quality. docs/agent-self-review.md is deleted only after its material method and evidence limits have been preserved and all active consumers point to the new owner. Lifecycle keeps a maximum of 3 author passes and the Owner escalation rule. The retired managed-workflow correction budget is not retained as a second generic budget. |
| AC5 | The long Specialist decision/package procedure is replaced by a short rule: an authorized call needs a specific question and relevant bounded evidence; advice is advisory and does not grant authority or replace required verification. Existing eval tooling remains available. No model run is mandatory for every skill edit. |
| AC6 | Skill governance explains instruction placement, core/reference ownership, observable read/skip conditions, maintenance of moved pointers and description near-miss checks. Shared permission and truthful-evidence rules are preserved without copied procedural blocks. |
| AC7 | Planning separates binding Spec, baseline facts, reversible hypotheses and current State. An implementation brief names the accepted plan and adds only assigned work, authority and missing operational facts. It does not restate the plan or claim that a plan overrides shared permissions. |
| AC8 | code-review-and-quality has a directly routed references/codex-brief.md for preparing/running/resuming a Codex review. The brief identifies actual candidate/range, required sources, scope, evidence, access limits and reporting. docs/agent-loops.md owns the policy requiring Codex review for large/high-risk work or an explicit Owner request, plus the shared wait contract below, and routes to the review skill. CLAUDE.md already imports the lifecycle; .claude/rules.md contains no duplicate Codex-review rule, binding or routing pointer. Author self-review still applies to every plan and implementation. |
| AC9 | Git/PR procedures retain separate commit, push, PR, merge and destructive authorities, explicit staging, current evidence and correction safety. Fixes from pre-commit self-review happen before the commit; findings after a reviewed commit normally produce a new correction commit. Staging/committing the candidate never runs concurrently with an unfinished candidate edit; independent read-only inspection may run in parallel. Existing skill names and Git/GitHub ownership split stay unless evidence proves a correctness problem. |
| AC10 | Test guidance states actual VocaSpace commands/layers, meaningful allowed/denied cases, prerequisite assertions and cleanup. Test headers describe stable intent and gaps, not a last-run result that goes stale. Results remain in reports. Related comment/review instructions are reconciled. No knownBug helper or fictional command is introduced. |
| AC11 | repo-docs-system documents DevSpace's backlog, single-unit detail plan, multi-unit master plan, evergreen charter/initiatives and entry-plan model, adapted to VocaSpace. Existing program decisions and contents are not reassigned or migrated by this unit. The skill states exactly which shape rules current tooling checks and which need manual review or later checker support. It never claims unsupported enforcement. |
| AC12 | Playwright has explicit use/do-not-use conditions and a VocaSpace policy block that wins over conflicting upstream examples/references, while remaining subordinate to shared permissions. Local is the default; hosted work needs an explicit grant. Attach/CDP/extension require approval through Claude ask rules for the actual supported shell/invocation forms. Reference examples never authorize publishing, mutation, weakening tests or skipping failures. |
| AC13 | Canonical skills remain in .agents/skills; Claude exposes the surviving skills through relative per-skill symlinks. Removing the managed skill also removes its link. No unsupported Claude frontmatter field or DevSpace-only fixture/path/command is copied merely to match its layout. |
| AC14 | Current docs/skill/eval checks pass with no newly broken links or weakening of existing checks. Tests/eval definitions that require retired contracts are retired or rewritten narrowly; surviving permission, routing and evidence guarantees retain appropriate protection. Historical observations are not relabeled current. |
| AC15 | A final read of the whole diff establishes one owner per live rule, no active managed-workflow requirement, valid self-review/Codex routes, documented checker limits, unchanged excluded skill bodies and a truthful report of checks not run. No browser/model/production claim is inferred from structural checks. |

Shared review-wait contract (AC8, owned by docs/agent-loops.md):

- After dispatching an authorized review, Main keeps the turn active until the result, an actual blocker or an Owner interruption. It does not end the turn merely because the reviewer is still running. A wait-tool timeout is not reviewer completion and routes back to waiting.
- Main may continue already-authorized independent work only when it cannot change the reviewed candidate, its dependencies or evidence and cannot bias the review. It does not invent work to avoid waiting.
- When no such work remains, use the execution surface's native completion/event wait. Do not repeatedly tail logs, inspect reviewer reasoning/tool activity or narrate unchanged status as a substitute for waiting. Updates follow actual material progress, blockers or applicable communication requirements without a self-imposed stream of unchanged reports.
- Inspect a log only to diagnose a concrete failure, unexpected exit, lost completion signal or a specific Owner request. A slow but normally running reviewer alone is not that signal. Reconcile the completed report and verify the candidate stayed unchanged before reporting its verdict.
- Waiting never grants candidate edits, retries, replacement reviewers, parallel review rounds or wider execution authority. A reviewer role does not recursively dispatch another review merely because it loaded the common lifecycle instructions.

### 1.2 Scope and non-goals

In scope:

- AGENTS.md, CLAUDE.md, .claude/rules.md, docs/agent-loops.md; relocating and deleting docs/agent-self-review.md.
- Seven DevSpace groups mapped to VocaSpace: skill-authoring → maintain-repo-skills; git-pr-workflow → git-checkpoint-workflow and github-pr-ci-workflow; planning → implementation-planning-and-pr-breakdown; code-review → code-review-and-quality; test-quality-strategy; program-docs → repo-docs-system; playwright-cli. Include their relevant references, not only SKILL.md.
- Narrow consistency changes in code-commenting-and-maintainability for test-header ownership, and active consumers of the changed shared rules.
- Removal of .agents/skills/native-multi-agent-workflow and its Claude symlink, managed-only planning/review references, .claude/agents/nma-*.md and .codex/agents/{planner,implementor,reviewer,specialist}.toml. Keep .codex/config.toml's generic default_subagent_model; it is not a managed-role registration and this unit changes no model preference.
- .claude/README.md and a shared .claude/settings.json for the reviewed ask patterns. Preserve local settings and unrelated grants.
- Existing .agents/evals definitions and deterministic tests only where the accepted instruction change invalidates them. Existing evaluator/harness runtime, schemas and retention machinery are not redesigned.
- Current docs index, ADR/index pointers and known-link baseline only where they own changed facts or references. Repair historical links to removed sources with baseline-commit links when necessary; preserve historical decisions and findings as history.
- A short docs-structure ADR and its index entry during implementation if the cross-program model change is not already owned by the existing docs-system ADR. Reuse the existing owner where possible; do not create duplicate decisions.

Out of scope:

- dependency-updates, package updates, npm audit/outdated, installs or dependency policy imported from the newly added DevSpace skill.
- Changes to frontend-design, frontend-workflow, supabase-safe-migration and nextjs-server-action-zod. VocaSpace-only frontend-ui-review is not being optimized in this unit. Fix their incoming routing in a changed owner rather than rewriting these excluded bundles.
- New known-bug helpers, bulk conversion of tests, product code, migrations, database/reset/seed actions, hosted queries or mutation, deployments and live browser work.
- Moving existing documents between programs, reassessing which existing feature belongs to which program, creating missing evergreen programs or migrating historical programs. A separate PR owns that work.
- New docs-checker features for the expanded taxonomy or script changes solely to migrate existing programs. Document unsupported checks honestly. Necessary removal/correction of managed-only tests and eval expectations is still in scope under AC14.
- Replacing DevSpace's vendored Playwright body/references wholesale, adding global tools, changing its upstream version, or asserting unverified provenance.
- Automatic model/eval dispatch, new custom runtimes, broad skill renames, changing repository comment language, Git/remote actions without their own grant.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Use current repository instructions until the reviewed replacement is installed; this plan is not its own implementation grant. | The candidate author uses draft rules to authorize work. |
| G2. Preserve one owner per live permission, lifecycle, procedure and State fact. DevSpace is a reference, not authority over VocaSpace. | Claude-only permission ownership leaks into shared Codex behavior. |
| G3. Remove managed machinery as a complete dependency change; keep general subagent use and the generic model preference. | Dead profiles or tests keep enforcing removed behavior, or ordinary tools are unintentionally disabled. |
| G4. Preserve the self-review method, evidence block, 3-pass cap, reporting limits and escalation while changing their location. | Moving text silently weakens review or leaves an unreachable method. |
| G5. Freeze the four excluded bundles and keep new tooling claims tied to actual commands/capabilities. | The alignment expands into frontend/database work or invents verification. |
| G6. Do not enable a new program shape through a false checker claim. Existing docs remain under their current rules until a later explicit migration. | A new instruction makes existing documents invalid or claims enforcement that does not exist. |
| G7. Preserve explicit permission boundaries for attach, hosted access, publishing, Git and production regardless of reference examples. | Reference guidance becomes an accidental action grant. |
| G8. Retire obsolete assertions; preserve meaningful surviving guarantees. Never change an expected answer merely to make an observed model output pass. | Removed contracts survive in tests, or real regressions disappear with ceremonial tests. |
| G9. No mandatory live model test for every edit; no claim of runtime enforcement or semantic PASS from parsing JSON, grep or schema validation. | Structural success is misreported as model behavior or approval enforcement. |

### 1.4 Owner decisions that bind this unit

Confirmed in this conversation on 2026-10-27:

- D1. Apply all seven remaining skill groups and references; exclude dependency-updates and the four ported frontend/database/action skills named above.
- D2. Optimize the shared principle/lifecycle files as well; DevSpace has no AGENTS.md, so translate ownership instead of copying file boundaries.
- D3. Remove the managed multi-agent workflow because it is cumbersome; do not preserve its role/state-machine ceremony.
- D4. Keep author self-review capped at 3 passes. This keeps AR2 D4's cap, while D3 retires managed-only escalation paths.
- D5. Move the generic method into the review skill and delete docs/agent-self-review.md after closing consumers. This supersedes AR2 D8's file-location decision for future work; AR2 history stays intact.
- D6. Codex review is required for large/high-risk work or when explicitly requested by the Owner; small/medium work keeps proportional author self-review.
- D7. Simplify Specialist procedure to an authorized, specific, evidence-backed advisory question; retain existing eval tools without making model execution universal.
- D8. Do not add a known-bug helper in this unit.
- D9. Adopt the DevSpace docs model in the skill, including backlog, single-unit plans, evergreen charters and entry plans. Existing wrongly placed documents and missing evergreen programs are assigned to a later PR, not silently migrated here. Existing checker support is an explicit limit.
- D10. Playwright defaults to local, permits explicitly authorized hosted work, and requires asking before attach/CDP/extension.
- D11. The original planning request authorized planning and focused clarification only. After independent r3 review PASS, the Owner approved r3, requested the plan commit and implementation, and granted local commits throughout implementation. This grants no push, PR, merge or unrelated execution.
- D12. The Owner's later steer moves review timing/wait behavior into the shared lifecycle: keep the turn waiting if no independent work remains, do not stop while waiting for the review, and do not observe/narrate the reviewer through repeated log reads. Invocation/resume mechanics and brief construction remain in the review skill reference. The Owner clarified that no Codex-review binding or pointer is needed in .claude/rules.md because CLAUDE.md already imports the shared lifecycle. Unrelated Claude-specific rules keep their existing owner. These r2/r3 changes are not covered by r1's independent PASS.

No material product/policy question remains open after these answers. A new ownership, permission or acceptance conflict found during implementation returns to the Owner rather than becoming a silent adaptation.

## 2. Repository facts

Baseline: VocaSpace 33550348b16bd21d75334e152e29e1f7f8661693 on chore/claude-shared-skills, checked 2026-10-27. This follows the completed main synchronization at 8aeed83ef56715a263d0584f267e72591fbd2224. The local symlink/import commit is already complete; it is not an implementation result of AR3.

DevSpace reference: C:/DevSpace, HEAD 164b9c73b8c42ebbeb48ce2eefa039a9987c57fc. Its selected instruction paths had no working-tree changes when checked; comparison from the earlier observed c01b9ac through this HEAD showed no changes to the selected sources. These are local source observations, not remote synchronization or runtime-quality claims.

- VocaSpace has 15 canonical skill directories; Claude's 15 links expose 79 files. This establishes AC13's current layout.
- DevSpace has no AGENTS.md and stores skills under .claude/skills. Its CLAUDE.md combines general instructions with imports. VocaSpace's split must preserve shared ownership (AC1).
- .claude/rules.md currently holds Codex command/resume mechanics and requires review for every plan/main implementation. Its plan handoff rule was already corrected in 33550348 to respect shared precedence (AC7–AC8). The independent r1 review exposed repetitive parent-side log reading/status narration while the reviewer ran; D12 supplies the missing shared waiting rule rather than another monitoring mechanism.
- docs/agent-self-review.md is used by lifecycle, planning, review, native instructions, native static tests and four eval suite files. docs/README.md explicitly says not to move it. AC4/D5 must replace these active statements together, not just delete a file.
- .agents/scripts/native-multi-agent-workflow.test.mjs is a 30-test static contract suite reading the managed skill, role configuration, historical native docs and the method document. Removal requires classifying its assertions, preserving useful general guarantees and retiring obsolete managed-only expectations (AC3, AC14).
- VocaSpace's .codex/config.toml contains only the generic default_subagent_model setting. Managed profiles are separate files, so removal does not require deleting that setting (G3).
- DevSpace's shared settings.json contains 12 ask patterns covering attach/CDP/extension through direct/npx commands and Bash/PowerShell. VocaSpace has no shared settings.json at discovery. Static pattern matching is not live Claude approval evidence (AC12).
- Eight of ten Playwright references match by byte; running-code.md and test-generation.md differ. VocaSpace also lacks the LICENSE file present in DevSpace. This unit does not assert matching upstream versions or copy those differences as policy (G5).
- VocaSpace's test-plan header currently stores a last verification result; comment and review skills refer to verification metadata. DevSpace keeps results in reports (AC10).
- repo-docs-system and scripts/docs/check-structure.mjs currently use lifecycle values active/closed/legacy and do not define DevSpace's evergreen/charter model. Documentation of the expanded model must distinguish manual rules from current mechanical enforcement (AC11).
- agent-rules progress records AR2 as merged (PR 163, 5dbcbce), with no active unit before AR3. No root master plan or problems.md exists in this program; do not manufacture either merely to add AR3.

Discovery checks at the baseline:

| Check | Observed result |
| --- | --- |
| npm run docs:check | Exit 0; 0 structure violations; 1 broken link already accepted in baseline, 0 new. The old link is .claude/README.md → ../docs/native-multi-agent/reviews/. |
| node .agents/scripts/validate-skill.mjs | Valid; 15 skills, 0 errors, 0 warnings. |
| node .agents/scripts/run-skill-evals.mjs validate --all | Valid; 11 configured skills, 33 suite files, 232 cases, 0 errors/warnings. This is schema/structure validation only. |

## 3. Bounded implementation hypotheses

- Keep the existing skill names and Git/GitHub split. Compact core plus directly routed references can express the accepted process without renaming or merging bundles.
- Put the short generic self-review method in the review skill core; use a reference only if a real subset can skip the detail. Lifecycle can route small author self-review to that section without activating every formal-review reference.
- Use references/codex-brief.md for review preparation and the planning handoff reference for implementation briefs. Each has one named consumer and read condition. Review timing/wait semantics belong only to lifecycle; references provide surface-specific invocation/completion-wait mechanics without copying the lifecycle policy.
- Remove specialist-only references after preserving their surviving short advisory rule and repairing consumers. Keep evaluation-specific procedures in the existing governance/eval owner when still applicable.
- During CP1, map live consumers using rg across AGENTS.md, CLAUDE.md, docs/agent-loops.md, .agents, .claude, .codex and scripts. Keep that mapping in the change report; no persistent registry is needed.
- Review historical links to deleted sources individually. Use a verified baseline-commit permalink where a historical source must remain inspectable, rather than rewriting its past decisions or creating forwarding copies of retired procedures.
- Limit checker work in this PR to removing obsolete managed references/tests and fixing directly affected path bookkeeping. New taxonomy-checker implementation belongs with the follow-up migration work; document the gap in the skill and final report.

## 4. Checkpoints

One coherent implementation PR is proposed for the accepted instruction change. Checkpoints are sequential and independently reviewable; they are not automatic commits or separate approval ceremonies. The later documentation-reassignment/migration PR is outside this unit, and no new plan for it is invented here.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Shared ownership/lifecycle and review method are coherent; retired managed/Specialist machinery and profiles are removed; source/routing/eval consumers are reconciled. | Read the actual current candidate against AC1–AC5, AC13–AC14; check imports, active references, profile inventory and baseline-linked history. Classify/replace affected native static assertions. Run skill validator, suite validation and directly affected Node tests. |
| CP2 | Authoring, planning, Git/PR and code-review instructions are compact and fully routed; implementation and Codex briefs have canonical owners; lifecycle owns required review and waiting behavior. | Use deterministic path/read-condition checks and requirement-to-owner review for AC6–AC9; check positive and near-miss task routes, plan vs brief precedence, review thresholds and every Git grant boundary. Check wait scenarios: independent authorized work vs no work, a normal wait timeout vs actual failure/Owner interruption, no log-watching/duplicate review and candidate stability. No model dispatch. |
| CP3 | Test/comment guidance and program-doc skill/templates express the accepted model without stale result metadata or false tooling claims; no existing documents are reassigned. | Review AC10–AC11; npm run docs:check; verify no product/test-helper changes, no new taxonomy-checker feature and no existing-program migration. Check baseline/manual enforcement distinction and current program compatibility. |
| CP4 | Playwright precedence/activation and shared ask configuration are installed; final integration closes all active consumers and documents remaining evidence limits. | Parse settings JSON; inspect exact command forms and policy precedence without attaching a browser. Verify all surviving symlink targets and excluded bundle bytes; run final skill/eval/docs checks and git diff --check. Whole-diff review against AC1–AC15, then external review when separately authorized. |

Verification detail:

- For each checkpoint run only affected deterministic checks after the last edit; reuse unchanged passing evidence with a reason.
- Common final checks: node .agents/scripts/validate-skill.mjs; node .agents/scripts/run-skill-evals.mjs validate --all; npm run docs:check; git diff --check. Do not expand the broken-link baseline to hide newly invalid links; remove the obsolete ignored-review-artifact entry when its source link is removed.
- If a validator/test implementation changes, run its existing Node tests: .agents/scripts/validate-skill.test.mjs, scripts/docs/check-links.test.mjs or scripts/docs/check-structure.test.mjs as applicable. Do not run product unit/integration/E2E suites for Markdown/JSON changes without an additional concrete risk.
- Eval definitions are updated only for intentionally changed obligations and source locations. Preserve meaningful permission, 3-pass escalation, evidence and near-miss cases. Deleted managed skill behavior is no longer an acceptance target. If an affected definition stops satisfying an existing schema, correct the definition within that schema or report the blocker; do not change the harness/schema to fit the new prose. Validation is not a semantic PASS.
- After a stable implementation and main review, freeze any necessary fresh-reader scenarios, exact source package, case count and claim limits before separately authorized execution. The bounded subjects are shared ownership/3-pass self-review, brief/grant boundaries and Playwright reference precedence. No executor or model is dispatched by this planning grant; record not_run when independent execution has not occurred.
- Live Claude ask behavior remains manual verification pending until an authorized session can show that attach/CDP/extension produces the expected approval prompt. Parsing JSON and inspecting patterns establishes configuration presence only. No real attach, hosted access or publication is used as a probe without its own authority.
- The review-wait scenarios in CP2 are contract/source checks unless a separately authorized real review supplies observable parent-side evidence. Do not call another model merely to test a wait primitive or claim runtime waiting behavior from the new wording alone.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Removing ceremony also removes a permission or evidence invariant. | Separate generic guarantees from managed-only machinery before deletion; compare final ownership/routes against AC1–AC15. |
| One checkpoint leaves instructions/tests pointing to a removed method or role. | Close active consumers with the owning change, classify affected test/eval cases, and verify the final candidate before any delivery. |
| DevSpace commands, model assumptions or fixtures are copied as VocaSpace facts. | Adapt from actual VocaSpace sources; preserve excluded bundles and generic model preference. |
| New docs policy invalidates current files while migration is deferred. | Explicit compatibility boundary; no bulk reclassification, strict new checker claim or evergreen creation in this unit. Follow-up PR owns activation/migration/tooling gaps. |
| An ask pattern does not match a supported command spelling. | Inventory direct/npx and shell forms; static checks plus an explicit pending native approval check. Never claim universal enforcement. |
| Smaller files are presented as proven agent improvement. | Report exact structural changes and observed checks only; no token/quality claim without comparative evidence. |

- Rollout: approve this exact plan; separately authorize implementation; execute CP1–CP4; self-review at most 3 passes per boundary under the current lifecycle; obtain the required large-work Codex review only under an actual execution grant. Commit, push and PR actions require their own grants. A future Claude session must reload the changed instructions before runtime QA.
- Stop when: an Owner decision, material permission/acceptance/ownership conflict, unapproved writer domain, excluded-bundle edit, unsupported runtime claim or necessary checker feature outside scope is discovered; after 3 self-review passes with blocking findings, report them and ask the Owner.
- Rollback: before delivery, correct the task-owned candidate within current authority; never discard unrelated edits. After delivery, use an explicitly authorized correction/revert that restores a coherent instruction/test/profile set while preserving truthful current State. Do not restore stale progress as current.
- Manual QA: no product browser QA is required. Live Claude prompt/skill-discovery behavior and any independent semantic observation remain separately reported until actually observed.
- Follow-up: migrate documents to the correct existing/new programs, create missing evergreen homes on Owner-approved boundaries, and extend the taxonomy checker before claiming enforcement of those new shapes. This follow-up has no implementation authority from AR3.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
