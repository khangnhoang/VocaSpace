import {
  ArtifactError,
  canonicalJson,
  sha256Canonical,
} from "./artifact-schema-v1.mjs";

const criterionAssessments = [
  "satisfied",
  "partially_satisfied",
  "not_satisfied",
  "uncertain",
];
const vetoAssessments = ["triggered", "not_triggered", "uncertain"];

const findingSchema = (idName, assessments) => ({
  type: "object",
  additionalProperties: false,
  required: [idName, "assessment", "rationale"],
  properties: {
    [idName]: { type: "string", minLength: 1 },
    assessment: { enum: assessments },
    rationale: { type: "string", minLength: 1 },
  },
});

export const evaluatorProposalSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "output_type",
    "criterion_findings",
    "safety_veto_findings",
    "comparison_findings",
    "summary",
  ],
  properties: {
    schema_version: { const: 1 },
    output_type: { const: "evaluator_proposal" },
    criterion_findings: {
      type: "array",
      items: findingSchema("criterion_id", criterionAssessments),
    },
    safety_veto_findings: {
      type: "array",
      items: findingSchema("veto_id", vetoAssessments),
    },
    comparison_findings: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["material_differences", "uncertainties"],
          properties: {
            material_differences: { type: "array", items: { type: "string", minLength: 1 } },
            uncertainties: { type: "array", items: { type: "string", minLength: 1 } },
          },
        },
      ],
    },
    summary: { type: "string", minLength: 1 },
  },
});

export function assertEvaluatorProposal(value, staticPlan) {
  assertExactKeys(value, [
    "comparison_findings",
    "criterion_findings",
    "output_type",
    "safety_veto_findings",
    "schema_version",
    "summary",
  ], "evaluator proposal");
  if (value.schema_version !== 1 || value.output_type !== "evaluator_proposal") {
    fail("Evaluator proposal version or output_type is invalid.");
  }
  assertFindings(
    value.criterion_findings,
    "criterion_id",
    staticPlan.criterion_ids,
    criterionAssessments,
    "criterion findings",
  );
  assertFindings(
    value.safety_veto_findings,
    "veto_id",
    staticPlan.veto_ids,
    vetoAssessments,
    "safety veto findings",
  );
  assertTrimmed(value.summary, "summary");
  if (staticPlan.mode === "candidate_only") {
    if (value.comparison_findings !== null) {
      fail("Candidate-only evaluator proposal must use comparison_findings: null.");
    }
  } else {
    assertExactKeys(
      value.comparison_findings,
      ["material_differences", "uncertainties"],
      "comparison findings",
    );
    for (const field of ["material_differences", "uncertainties"]) {
      if (!Array.isArray(value.comparison_findings[field])) fail(`${field} must be an array.`);
      for (const item of value.comparison_findings[field]) assertTrimmed(item, field);
    }
  }
  return value;
}

export function createEvaluatorStaticPlan({ skill, suite, selectedCase, readerDescriptors, mode }) {
  const logicalUnitKey = {
    schema_version: 1,
    kind: "evaluator",
    skill,
    suite,
    case_id: selectedCase.case_id,
  };
  const dependencies = readerDescriptors
    .map((descriptor) => ({
      source_role: descriptor.logical_unit_key.source_role,
      unit_id: descriptor.unit_id,
      source_locator: {
        workspace_id: descriptor.source_locator.workspace_id,
        variant_id: descriptor.source_locator.variant_id,
        execution_context_hash: descriptor.source_locator.execution_context_hash,
      },
    }))
    .sort((left, right) => compareStrings(left.source_role, right.source_role));
  const expectedRoles = mode === "comparison" ? ["baseline", "candidate"] : ["candidate"];
  if (
    dependencies.length !== expectedRoles.length ||
    dependencies.some((dependency, index) => dependency.source_role !== expectedRoles[index])
  ) {
    fail("Evaluator dependencies do not match the selected mode.");
  }
  return assertEvaluatorStaticPlan({
    schema_version: 1,
    unit_id: `evaluator-${sha256Canonical(logicalUnitKey)}`,
    logical_unit_key: logicalUnitKey,
    kind: "evaluator",
    mode,
    dependencies,
    evaluator_only: structuredClone(selectedCase.evaluator_only),
    suite_config: structuredClone(selectedCase.suite_config),
    criterion_ids: selectedCase.evaluator_only.criteria.map((item) => item.criterion_id),
    veto_ids: selectedCase.evaluator_only.safety_vetoes.map((item) => item.veto_id),
  });
}

export function assertEvaluatorStaticPlan(value) {
  assertExactKeys(value, [
    "criterion_ids", "dependencies", "evaluator_only", "kind", "logical_unit_key", "mode",
    "schema_version", "suite_config", "unit_id", "veto_ids",
  ], "evaluator static plan");
  assertExactKeys(value.logical_unit_key, [
    "case_id", "kind", "schema_version", "skill", "suite",
  ], "evaluator logical key");
  if (
    value.schema_version !== 1 || value.kind !== "evaluator" ||
    value.logical_unit_key.schema_version !== 1 || value.logical_unit_key.kind !== "evaluator" ||
    value.unit_id !== `evaluator-${sha256Canonical(value.logical_unit_key)}` ||
    !["candidate_only", "comparison"].includes(value.mode) ||
    !Array.isArray(value.dependencies)
  ) fail("Evaluator static plan identity is invalid.");
  const expectedRoles = value.mode === "comparison" ? ["baseline", "candidate"] : ["candidate"];
  const roles = value.dependencies.map((dependency) => {
    assertExactKeys(dependency, ["source_locator", "source_role", "unit_id"], "evaluator dependency");
    assertExactKeys(dependency.source_locator, [
      "execution_context_hash", "variant_id", "workspace_id",
    ], "evaluator dependency locator");
    return dependency.source_role;
  });
  if (canonicalJson(roles) !== canonicalJson(expectedRoles)) {
    fail("Evaluator static dependency roles are invalid.");
  }
  if (
    !Array.isArray(value.evaluator_only?.criteria) ||
    !Array.isArray(value.evaluator_only?.safety_vetoes) ||
    canonicalJson(value.criterion_ids) !==
      canonicalJson(value.evaluator_only.criteria.map((item) => item.criterion_id)) ||
    canonicalJson(value.veto_ids) !==
      canonicalJson(value.evaluator_only.safety_vetoes.map((item) => item.veto_id))
  ) fail("Evaluator static rubric IDs are invalid.");
  assertEvaluatorPayload(value);
  return value;
}

function assertFindings(values, idName, expectedIds, assessments, label) {
  if (!Array.isArray(values) || values.length !== expectedIds.length) {
    fail(`${label} must exactly match the selected rubric.`);
  }
  values.forEach((value, index) => {
    assertExactKeys(value, ["assessment", idName, "rationale"], label);
    if (value[idName] !== expectedIds[index] || !assessments.includes(value.assessment)) {
      fail(`${label} membership, order, or assessment is invalid.`);
    }
    assertTrimmed(value.rationale, `${label} rationale`);
  });
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort(compareStrings);
  const sorted = [...expected].sort(compareStrings);
  if (actual.length !== sorted.length || actual.some((key, index) => key !== sorted[index])) {
    fail(`${label} fields are invalid.`);
  }
}

function assertTrimmed(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    fail(`${label} must be a non-empty trimmed string.`);
  }
}

function assertEvaluatorPayload(value) {
  const routing = value.logical_unit_key.suite === "routing";
  assertExactKeys(value.evaluator_only, [
    "criteria", "expected_behavior", "forbidden_behavior", "safety_vetoes",
    ...(routing ? ["expected_routes", "forbidden_routes"] : []),
  ], "evaluator_only");
  for (const criterion of value.evaluator_only.criteria) {
    assertExactKeys(criterion, ["criterion_id", "description", "material"], "criterion");
    assertTrimmed(criterion.criterion_id, "criterion_id");
    assertTrimmed(criterion.description, "criterion description");
    if (typeof criterion.material !== "boolean") fail("criterion material must be boolean.");
  }
  for (const veto of value.evaluator_only.safety_vetoes) {
    assertExactKeys(veto, ["description", "veto_id"], "safety veto");
    assertTrimmed(veto.veto_id, "veto_id");
    assertTrimmed(veto.description, "veto description");
  }
  for (const field of [
    "expected_behavior", "forbidden_behavior",
    ...(routing ? ["expected_routes", "forbidden_routes"] : []),
  ]) {
    if (!Array.isArray(value.evaluator_only[field])) fail(`${field} must be an array.`);
    for (const item of value.evaluator_only[field]) assertTrimmed(item, field);
  }
  const suite = value.logical_unit_key.suite;
  const expectedSuiteConfigKeys = suite === "regression"
    ? ["behavior_area", "protected_invariants"]
    : suite === "routing"
      ? ["candidate_skills", "near_miss", "routing_mode"]
      : suite === "fresh-reader"
        ? ["independence_required", "mode"]
        : null;
  if (expectedSuiteConfigKeys === null) fail("Evaluator suite is invalid.");
  assertExactKeys(value.suite_config, expectedSuiteConfigKeys, "suite_config");
}

function fail(message) {
  throw new ArtifactError("EVALUATOR_CONTRACT_INVALID", message, 3);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
