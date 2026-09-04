import {
  ArtifactError,
  assertObservation,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
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
    assessment: { type: "string", enum: assessments },
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
    schema_version: { type: "integer", const: 1 },
    output_type: { type: "string", const: "evaluator_proposal" },
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

export function compileEvaluatorPreparedUnitDescriptor({ staticPlan, bindings, cliOptions }) {
  assertEvaluatorStaticPlan(staticPlan);
  assertCliOptions(cliOptions);
  const expectedByRole = new Map(
    staticPlan.dependencies.map((dependency) => [dependency.source_role, dependency]),
  );
  if (!Array.isArray(bindings) || bindings.length !== expectedByRole.size) {
    fail("Evaluator result bindings must exactly cover its dependencies.");
  }
  const seen = new Set();
  const projections = [];
  const acceptedResults = [];
  for (const binding of bindings) {
    const dependency = expectedByRole.get(binding?.source_role);
    if (!dependency || seen.has(binding.source_role) || binding.unit_id !== dependency.unit_id) {
      fail("Evaluator result binding has wrong, duplicate, or extra lineage.");
    }
    seen.add(binding.source_role);
    if (
      binding.terminal_status !== "succeeded" ||
      typeof binding.attempt_id !== "string" ||
      !new RegExp(`^${binding.unit_id}-attempt-[1-9][0-9]*$`).test(binding.attempt_id) ||
      !Number.isSafeInteger(binding.producer_revision) || binding.producer_revision <= 0 ||
      !/^[a-f0-9]{64}$/.test(binding.producer_behavior_fingerprint ?? "") ||
      !binding.producer_locator ||
      typeof binding.structured_output_path !== "string" ||
      binding.structured_output_path.length === 0 ||
      !/^[a-f0-9]{64}$/.test(binding.structured_output_sha256 ?? "") ||
      !Buffer.isBuffer(binding.observation_bytes) ||
      sha256Bytes(binding.observation_bytes) !== binding.structured_output_sha256
    ) {
      fail("Evaluator dependency is not an exact accepted reader result.");
    }
    assertExactKeys(binding.producer_locator, [
      "execution_context_hash", "variant_id", "workspace_id",
    ], "accepted producer locator");
    const observationValue = parseStrictJson(binding.observation_bytes, "accepted reader observation");
    if (!Buffer.from(canonicalJson(observationValue), "utf8").equals(binding.observation_bytes)) {
      fail("Accepted reader observation must use canonical JSON bytes.");
    }
    const observation = assertObservation(observationValue, {
      workspaceId: binding.producer_locator.workspace_id,
      skill: staticPlan.logical_unit_key.skill,
      role: binding.source_role,
      executionContextHash: binding.producer_locator.execution_context_hash,
    });
    if (
      observation.suite !== staticPlan.logical_unit_key.suite ||
      observation.case_id !== staticPlan.logical_unit_key.case_id ||
      observation.variant_id !== binding.producer_locator.variant_id
    ) {
      fail("Accepted reader observation belongs to a different semantic lineage.");
    }
    projections.push({
      source_role: binding.source_role,
      execution_status: observation.execution_status,
      execution_reason: observation.execution_reason,
      raw_response: observation.raw_response,
      observed_access: observation.observed_access,
    });
    acceptedResults.push({
      source_role: binding.source_role,
      unit_id: binding.unit_id,
      attempt_id: binding.attempt_id,
      producer_revision: binding.producer_revision,
      producer_behavior_fingerprint: binding.producer_behavior_fingerprint,
      producer_locator: structuredClone(binding.producer_locator),
      structured_output_path: binding.structured_output_path,
      structured_output_sha256: binding.structured_output_sha256,
    });
  }
  projections.sort((left, right) => compareStrings(left.source_role, right.source_role));
  acceptedResults.sort((left, right) => compareStrings(left.source_role, right.source_role));
  return evaluatorDescriptor(staticPlan, projections, acceptedResults, cliOptions);
}

export function validateEvaluatorPreparedInput({ stdinBytes, schemaBytes, cliOptions, staticPlan, preparedUnit, allowHistoricalSchema = false }) {
  const input = parseStrictJson(stdinBytes, "prepared evaluator input");
  const key = preparedUnit?.logical_unit_key ?? staticPlan?.logical_unit_key;
  if (!key || key.kind !== "evaluator") fail("Prepared evaluator identity is invalid.");
  const roles = input.mode === "comparison" ? ["baseline", "candidate"] : ["candidate"];
  const derived = assertEvaluatorStaticPlan({
    schema_version: 1,
    unit_id: `evaluator-${sha256Canonical(key)}`,
    logical_unit_key: key,
    kind: "evaluator",
    mode: input.mode,
    dependencies: roles.map((sourceRole) => ({
      source_role: sourceRole,
      unit_id: `reader-${sha256Canonical({ ...key, kind: "reader", source_role: sourceRole })}`,
      source_locator: { workspace_id: `ws-${"0".repeat(32)}`, variant_id: "A", execution_context_hash: "0".repeat(64) },
    })),
    evaluator_only: input.evaluator_only,
    suite_config: input.suite_config,
    criterion_ids: input.evaluator_only?.criteria?.map((item) => item.criterion_id),
    veto_ids: input.evaluator_only?.safety_vetoes?.map((item) => item.veto_id),
  });
  const contract = staticPlan ?? derived;
  assertEvaluatorStaticPlan(contract);
  assertCliOptions(cliOptions);
  if (!Array.isArray(input.dependencies) || input.dependencies.length !== roles.length) {
    fail("Prepared evaluator dependency count is invalid.");
  }
  input.dependencies.forEach((projection, index) => {
    assertExactKeys(projection, ["source_role", "execution_status", "execution_reason", "raw_response", "observed_access"], "semantic reader projection");
    if (projection.source_role !== roles[index]) fail("Prepared evaluator dependency order is invalid.");
    // Locator trung tính chỉ phục vụ validation của phần semantic, không tạo bằng chứng provenance.
    const locator = derived.dependencies[index].source_locator;
    assertObservation({
      schema_version: 1, artifact_type: `${projection.source_role}_observation`,
      workspace_id: locator.workspace_id, skill: key.skill, suite: key.suite, case_id: key.case_id,
      variant_id: locator.variant_id, execution_context_hash: locator.execution_context_hash,
      execution_status: projection.execution_status, execution_reason: projection.execution_reason,
      raw_response: projection.raw_response, observed_access: projection.observed_access,
    }, { workspaceId: locator.workspace_id, skill: key.skill, role: projection.source_role, executionContextHash: locator.execution_context_hash });
  });
  const currentSchemaBytes = Buffer.from(canonicalJson(evaluatorProposalSchema), "utf8");
  // Schema trước pilot thiếu type ở const/enum; chỉ đọc exact bytes cũ để giữ producer proof.
  const historicalSchema = allowHistoricalSchema &&
    sha256Bytes(schemaBytes) === "c6740d5ff183275f644aeb9e41bc7e4507550e879b566f2fdc4654e1f7d6ecfa";
  if (!schemaBytes.equals(currentSchemaBytes) && !historicalSchema) {
    fail("Prepared evaluator schema does not match a supported producing contract.");
  }
  const descriptor = evaluatorDescriptor(contract, input.dependencies, [], cliOptions, schemaBytes);
  if (!descriptor.invocation_content.stdin_bytes.equals(stdinBytes)) {
    fail("Prepared evaluator bytes do not match the exact producing contract.");
  }
  if (preparedUnit && (preparedUnit.kind !== "evaluator" || preparedUnit.unit_id !== descriptor.unit_id ||
    canonicalJson(preparedUnit.dependencies) !== canonicalJson(descriptor.dependencies) ||
    canonicalJson(preparedUnit.behavior_projection) !== canonicalJson(descriptor.behavior_projection) ||
    canonicalJson(preparedUnit.invocation.cli_options) !== canonicalJson(cliOptions))) {
    fail("Prepared evaluator identity, dependencies, fingerprint or options mismatch.");
  }
  return { staticPlan: contract, descriptor, projections: input.dependencies };
}

function evaluatorDescriptor(staticPlan, projections, acceptedResults, cliOptions,
  schemaBytes = Buffer.from(canonicalJson(evaluatorProposalSchema), "utf8")) {
  const envelope = {
    schema_version: 1,
    kind: "evaluator_input",
    delivery_mode: "stdin_embedded_evaluator_input_v1",
    instruction: {
      task: "Evaluate the supplied reader observation or observations against evaluator_only and suite_config.",
      authority: "Return advisory findings only. Do not assign human case or comparison status, choose a winner, recommend accept, reject, or rerun actions, or claim human authority.",
      evidence: "Use only the supplied semantic reader projections. Do not infer opaque variant mapping or provenance.",
      response: "Return exactly one JSON object matching the output schema enforced by the CLI, with no prose outside that object.",
    },
    identity: {
      skill: staticPlan.logical_unit_key.skill,
      suite: staticPlan.logical_unit_key.suite,
      case_id: staticPlan.logical_unit_key.case_id,
    },
    mode: staticPlan.mode,
    evaluator_only: structuredClone(staticPlan.evaluator_only),
    suite_config: structuredClone(staticPlan.suite_config),
    dependencies: projections,
  };
  const stdinBytes = Buffer.from(canonicalJson(envelope), "utf8");
  const modelVisibleFiles = [
    {
      relative_path: "evaluator/evaluator-only.json",
      sha256: sha256Canonical(staticPlan.evaluator_only),
    },
    {
      relative_path: "evaluator/suite-config.json",
      sha256: sha256Canonical(staticPlan.suite_config),
    },
    ...projections.map((projection) => ({
      relative_path: `dependencies/${projection.source_role}/observation.json`,
      sha256: sha256Canonical(projection),
    })),
  ].sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  return {
    schema_version: 1,
    unit_id: staticPlan.unit_id,
    logical_unit_key: structuredClone(staticPlan.logical_unit_key),
    kind: "evaluator",
    dependencies: staticPlan.dependencies.map((item) => item.unit_id),
    invocation_content: {
      stdin_bytes: stdinBytes,
      output_schema_bytes: schemaBytes,
      cli_options: structuredClone(cliOptions),
    },
    behavior_projection: {
      schema_version: 1,
      kind: "evaluator",
      stdin_sha256: sha256Bytes(stdinBytes),
      model_visible_files: modelVisibleFiles,
      output_schema_sha256: sha256Bytes(schemaBytes),
      cli_behavior_options: structuredClone(cliOptions),
    },
    source_locator: { accepted_results: acceptedResults },
  };
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

function assertCliOptions(value) {
  assertExactKeys(value, [
    "ephemeral", "ignore_rules", "ignore_user_config", "model", "reasoning_effort", "sandbox",
  ], "CLI behavior options");
  if (
    typeof value.model !== "string" || value.model.length === 0 ||
    typeof value.reasoning_effort !== "string" || value.reasoning_effort.length === 0 ||
    typeof value.sandbox !== "string" || value.sandbox.length === 0 ||
    value.ephemeral !== true || value.ignore_rules !== true || value.ignore_user_config !== true
  ) fail("CLI behavior options are not normalized.");
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
