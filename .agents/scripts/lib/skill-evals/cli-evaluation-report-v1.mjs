import { ArtifactError, canonicalJson } from "./artifact-schema-v1.mjs";
import { assertEvaluatorProposal } from "./cli-evaluator-proposal-v1.mjs";

const unitStatuses = ["pending", "running", "succeeded", "failed", "outcome_unknown", "blocked"];
const relations = ["current", "retained_reference", "unavailable"];
const blockReasons = [null, "integrity_failure", "dependency_not_ready", "attempt_budget_exhausted"];

export function createCliEvaluationReport({ run, plan, cases }) {
  const counts = { cases: cases.length, current: 0, retained_reference: 0, incomplete: 0 };
  for (const item of cases) counts[item.coverage_status] += 1;
  return assertCliEvaluationReport({
    schema_version: 1,
    artifact_type: "cli_evaluation_report",
    command: "report",
    status: counts.incomplete > 0 ? "incomplete" : "succeeded",
    run_id: run.run_id,
    workspace_id: run.workspace_id,
    revision: run.current_revision,
    coverage_mode: run.mode ?? "exact_current",
    authority: "advisory_evaluator_proposals_only",
    cases,
    counts,
    dispatch_counts: { reader: 0, evaluator: 0, total: 0 },
  }, plan);
}

export function assertCliEvaluationReport(value, plan) {
  exactKeys(value, ["schema_version", "artifact_type", "command", "status", "run_id", "workspace_id", "revision",
    "coverage_mode", "authority", "cases", "counts", "dispatch_counts"]);
  if (value.schema_version !== 1 || value.artifact_type !== "cli_evaluation_report" || value.command !== "report" ||
    value.run_id !== plan.run_id || value.workspace_id !== plan.workspace_id || value.revision !== plan.revision ||
    !["exact_current", "patch_check_mixed_revision"].includes(value.coverage_mode) ||
    value.authority !== "advisory_evaluator_proposals_only" || !Array.isArray(value.cases) ||
    value.cases.length !== plan.evaluator_units.length ||
    canonicalJson(value.dispatch_counts) !== canonicalJson({ reader: 0, evaluator: 0, total: 0 })) invalid();
  const counts = { cases: value.cases.length, current: 0, retained_reference: 0, incomplete: 0 };
  value.cases.forEach((item, index) => {
    exactKeys(item, ["suite", "case_id", "evaluator_unit_id", "coverage_status", "reader_results", "evaluator_result"]);
    const unit = plan.evaluator_units[index];
    if (item.suite !== unit.logical_unit_key.suite || item.case_id !== unit.logical_unit_key.case_id ||
      item.evaluator_unit_id !== unit.unit_id || !["current", "retained_reference", "incomplete"].includes(item.coverage_status) ||
      !Array.isArray(item.reader_results) || item.reader_results.length !== unit.dependencies.length) invalid();
    item.reader_results.forEach((reader, position) => {
      const dependency = unit.dependencies[position];
      assertResult(reader, false);
      if (reader.unit_id !== dependency.unit_id || reader.source_role !== dependency.source_role) invalid();
    });
    assertResult(item.evaluator_result, true);
    if (item.evaluator_result.unit_id !== unit.unit_id) invalid();
    const results = [...item.reader_results, item.evaluator_result];
    const unavailable = results.some((result) => result.relation === "unavailable");
    const retained = results.some((result) => result.relation === "retained_reference");
    const incomplete = results.some((result) => ["failed", "outcome_unknown", "running"].includes(result.unit_status) ||
      ["integrity_failure", "attempt_budget_exhausted"].includes(result.block_reason));
    const expectedCoverage = unavailable || incomplete ? "incomplete" : retained ? "retained_reference" : "current";
    if ((retained && value.coverage_mode !== "patch_check_mixed_revision") ||
      item.coverage_status !== expectedCoverage ||
      results.some((result) => result.producer_revision !== null && result.producer_revision > value.revision) ||
      (unavailable && results.some((result) => result.relation !== "unavailable"))) invalid();
    if (item.evaluator_result.proposal !== null) {
      const proposal = item.evaluator_result.proposal;
      const criterionIds = proposal.criterion_findings?.map((finding) => finding.criterion_id);
      const vetoIds = proposal.safety_veto_findings?.map((finding) => finding.veto_id);
      if (!criterionIds || !vetoIds || new Set(criterionIds).size !== criterionIds.length || new Set(vetoIds).size !== vetoIds.length) invalid();
      // Membership của rubric được resolver kiểm tra với producing input; retained rubric có thể khác revision hiện tại.
      assertEvaluatorProposal(proposal, { criterion_ids: criterionIds, veto_ids: vetoIds, mode: unit.mode });
    }
    counts[item.coverage_status] += 1;
  });
  if (canonicalJson(value.counts) !== canonicalJson(counts) ||
    value.status !== (counts.incomplete > 0 ? "incomplete" : "succeeded")) invalid();
  return value;
}

function assertResult(value, evaluator) {
  exactKeys(value, ["unit_id", "unit_status", "effective_status", "block_reason", "relation", "attempt_id",
    "producer_revision", "structured_output_sha256", evaluator ? "proposal" : "source_role"]);
  if (!unitStatuses.includes(value.unit_status) || !unitStatuses.includes(value.effective_status) ||
    !blockReasons.includes(value.block_reason) || !relations.includes(value.relation) ||
    !new RegExp(`^${evaluator ? "evaluator" : "reader"}-[a-f0-9]{64}$`).test(value.unit_id ?? "") ||
    value.effective_status !== (value.block_reason === null ? value.unit_status : "blocked") ||
    ((value.unit_status === "blocked") !== (value.block_reason === "integrity_failure")) ||
    (value.block_reason === "dependency_not_ready" && value.unit_status !== "pending") ||
    (value.block_reason === "attempt_budget_exhausted" && !["pending", "failed"].includes(value.unit_status)) ||
    (value.relation === "current" && value.unit_status !== "succeeded")) invalid();
  if (value.relation === "unavailable") {
    if (value.attempt_id !== null || value.producer_revision !== null || value.structured_output_sha256 !== null ||
      (evaluator && value.proposal !== null)) invalid();
  } else if (typeof value.attempt_id !== "string" ||
    !new RegExp(`^${value.unit_id}-attempt-[1-9][0-9]*$`).test(value.attempt_id) ||
    !Number.isSafeInteger(value.producer_revision) || value.producer_revision < 1 ||
    !/^[a-f0-9]{64}$/.test(value.structured_output_sha256 ?? "") || (evaluator && value.proposal === null)) invalid();
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) invalid();
}

function invalid() {
  throw new ArtifactError("CLI_REPORT_INVALID", "CLI advisory report shape or coverage is invalid.", 3);
}
