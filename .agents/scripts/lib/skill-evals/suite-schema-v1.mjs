export const suiteSchemaVersion = 1;
export const suiteArtifactType = "suite_definition";
export const suiteNames = Object.freeze(["fresh-reader", "regression", "routing"]);

const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const freshReaderModes = new Set([
  "behavior-execution",
  "documentation-comprehension",
  "skill-comprehension",
]);

export function isSkillName(value) {
  return typeof value === "string" && skillNamePattern.test(value);
}

export function isSafeRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    return false;
  }
  if (
    value.includes("\\") ||
    value.includes(":") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith("//") ||
    /[*?[\]{}]/.test(value)
  ) {
    return false;
  }

  const segments = value.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !segment.endsWith(".") &&
      !segment.endsWith(" ") &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
  );
}

export function isRepositoryPathSafetyRefusal(value) {
  if (typeof value !== "string") return false;
  const segments = value.split("/");
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value) ||
    value.includes("\\") ||
    value.includes(":") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    segments.includes("..") ||
    segments.some(
      (segment) =>
        (segment !== "." && segment.endsWith(".")) ||
        segment.endsWith(" ") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    )
  );
}

export function validateSuiteDefinition(value, expectedIdentity) {
  const diagnostics = [];
  const add = (code, jsonPath, message, caseId) => {
    diagnostics.push({ code, json_path: jsonPath, message, case_id: caseId });
  };

  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", "$", "Suite definition must be a JSON object.");
    return diagnostics;
  }

  checkObjectKeys(
    value,
    ["schema_version", "artifact_type", "skill", "suite", "description", "cases"],
    ["schema_version", "artifact_type", "skill", "suite", "description", "cases"],
    "$",
    add,
  );

  if (Number.isInteger(value.schema_version) && value.schema_version !== suiteSchemaVersion) {
    add(
      "SCHEMA_VERSION_UNSUPPORTED",
      "$.schema_version",
      `Schema version ${value.schema_version} is unsupported; only version ${suiteSchemaVersion} is supported.`,
    );
  } else if (value.schema_version !== suiteSchemaVersion) {
    add(
      "SCHEMA_VALUE_INVALID",
      "$.schema_version",
      `schema_version must be integer ${suiteSchemaVersion}.`,
    );
  }

  if (value.artifact_type !== suiteArtifactType) {
    add(
      "SCHEMA_VALUE_INVALID",
      "$.artifact_type",
      `artifact_type must be '${suiteArtifactType}'.`,
    );
  }

  if (!isSkillName(value.skill)) {
    add("SCHEMA_VALUE_INVALID", "$.skill", "skill must be a kebab-case repo-local skill name.");
  } else if (value.skill !== expectedIdentity.skill) {
    add(
      "SUITE_IDENTITY_MISMATCH",
      "$.skill",
      `Suite skill '${value.skill}' does not match directory '${expectedIdentity.skill}'.`,
    );
  }

  if (!suiteNames.includes(value.suite)) {
    add(
      "SCHEMA_VALUE_INVALID",
      "$.suite",
      "suite must be 'regression', 'routing', or 'fresh-reader'.",
    );
  } else if (value.suite !== expectedIdentity.suite) {
    add(
      "SUITE_IDENTITY_MISMATCH",
      "$.suite",
      `Suite identity '${value.suite}' does not match file '${expectedIdentity.suite}.json'.`,
    );
  }

  requireTrimmedString(value.description, "$.description", "description", add);

  if (!Array.isArray(value.cases)) {
    add("SCHEMA_VALUE_INVALID", "$.cases", "cases must be an array.");
  } else {
    const caseIds = new Set();
    for (const [index, caseValue] of value.cases.entries()) {
      const casePath = `$.cases[${index}]`;
      const caseId = isRecord(caseValue) ? caseValue.case_id : undefined;
      if (isSkillName(caseId)) {
        if (caseIds.has(caseId)) {
          add("CASE_ID_DUPLICATE", `${casePath}.case_id`, `case_id '${caseId}' is duplicated.`, caseId);
        }
        caseIds.add(caseId);
      }
      validateCase(caseValue, value.suite, casePath, add, caseId);
    }
  }

  return diagnostics;
}

function validateCase(value, suite, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "Each case must be a JSON object.", caseId);
    return;
  }

  checkObjectKeys(
    value,
    ["case_id", "title", "executor_input", "evaluator_only", "suite_config"],
    ["case_id", "title", "executor_input", "evaluator_only", "suite_config"],
    jsonPath,
    add,
    caseId,
  );

  if (!isSkillName(value.case_id)) {
    add("SCHEMA_VALUE_INVALID", `${jsonPath}.case_id`, "case_id must be kebab-case.", caseId);
  }
  requireTrimmedString(value.title, `${jsonPath}.title`, "title", add, caseId);
  validateExecutorInput(value.executor_input, `${jsonPath}.executor_input`, add, caseId);
  validateEvaluatorOnly(value.evaluator_only, suite, `${jsonPath}.evaluator_only`, add, caseId);
  validateSuiteConfig(value.suite_config, suite, `${jsonPath}.suite_config`, add, caseId);
  if (suite === "routing") {
    validateRoutingConsistency(
      value.evaluator_only,
      value.suite_config,
      `${jsonPath}.evaluator_only`,
      add,
      caseId,
    );
  }
}

function validateExecutorInput(value, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "executor_input must be a JSON object.", caseId);
    return;
  }
  checkObjectKeys(
    value,
    ["prompt", "context", "execution_policy"],
    ["prompt", "context", "execution_policy"],
    jsonPath,
    add,
    caseId,
  );
  requireTrimmedString(value.prompt, `${jsonPath}.prompt`, "prompt", add, caseId);

  if (!Array.isArray(value.context)) {
    add("SCHEMA_VALUE_INVALID", `${jsonPath}.context`, "context must be an array.", caseId);
  } else {
    const contextIds = new Set();
    for (const [index, context] of value.context.entries()) {
      const contextPath = `${jsonPath}.context[${index}]`;
      const contextId = isRecord(context) ? context.context_id : undefined;
      if (isSkillName(contextId)) {
        if (contextIds.has(contextId)) {
          add(
            "CONTEXT_ID_DUPLICATE",
            `${contextPath}.context_id`,
            `context_id '${contextId}' is duplicated.`,
            caseId,
          );
        }
        contextIds.add(contextId);
      }
      validateContext(context, contextPath, add, caseId);
    }
  }

  validateExecutionPolicy(value.execution_policy, `${jsonPath}.execution_policy`, add, caseId);
}

function validateContext(value, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "Context entries must be JSON objects.", caseId);
    return;
  }

  const sourceType = value.source_type;
  const allowed =
    sourceType === "repository_file"
      ? ["context_id", "source_type", "path"]
      : sourceType === "inline_text"
        ? ["context_id", "source_type", "content"]
        : ["context_id", "source_type"];
  checkObjectKeys(value, ["context_id", "source_type"], allowed, jsonPath, add, caseId);

  if (!isSkillName(value.context_id)) {
    add("SCHEMA_VALUE_INVALID", `${jsonPath}.context_id`, "context_id must be kebab-case.", caseId);
  }

  if (sourceType === "repository_file") {
    if (!Object.hasOwn(value, "path")) {
      add("SCHEMA_FIELD_MISSING", `${jsonPath}.path`, "Required field 'path' is missing.", caseId);
    } else if (!isSafeRepositoryPath(value.path)) {
      const escape =
        typeof value.path === "string" &&
        (value.path.startsWith("/") || /^[A-Za-z]:/.test(value.path) || value.path.split("/").includes(".."));
      add(
        escape ? "CONTEXT_PATH_ESCAPE" : "CONTEXT_PATH_INVALID",
        `${jsonPath}.path`,
        "Repository context path must be a normalized repo-relative path using '/'.",
        caseId,
      );
    }
    return;
  }

  if (sourceType === "inline_text") {
    if (!Object.hasOwn(value, "content")) {
      add("SCHEMA_FIELD_MISSING", `${jsonPath}.content`, "Required field 'content' is missing.", caseId);
    } else {
      requireTrimmedString(value.content, `${jsonPath}.content`, "content", add, caseId);
    }
    return;
  }

  add(
    "SCHEMA_VALUE_INVALID",
    `${jsonPath}.source_type`,
    "source_type must be 'repository_file' or 'inline_text'.",
    caseId,
  );
}

function validateExecutionPolicy(value, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "execution_policy must be a JSON object.", caseId);
    return;
  }
  checkObjectKeys(
    value,
    ["packaging_mode", "fresh_context_required", "variant_identity", "requested_access"],
    ["packaging_mode", "fresh_context_required", "variant_identity", "requested_access"],
    jsonPath,
    add,
    caseId,
  );

  requireLiteral(value.packaging_mode, "synthetic", `${jsonPath}.packaging_mode`, add, caseId);
  requireBoolean(value.fresh_context_required, `${jsonPath}.fresh_context_required`, add, caseId);
  requireEnum(value.variant_identity, ["blind", "visible"], `${jsonPath}.variant_identity`, add, caseId);

  const accessPath = `${jsonPath}.requested_access`;
  const access = value.requested_access;
  if (!isRecord(access)) {
    add("SCHEMA_VALUE_INVALID", accessPath, "requested_access must be a JSON object.", caseId);
    return;
  }
  checkObjectKeys(
    access,
    ["filesystem", "tools", "allowed_tools", "network", "credentials", "remote", "mutation"],
    ["filesystem", "tools", "allowed_tools", "network", "credentials", "remote", "mutation"],
    accessPath,
    add,
    caseId,
  );
  requireEnum(access.filesystem, ["none", "package_read_only"], `${accessPath}.filesystem`, add, caseId);
  requireEnum(access.tools, ["allowlisted", "none"], `${accessPath}.tools`, add, caseId);
  validateAllowedTools(access.allowed_tools, access.tools, `${accessPath}.allowed_tools`, add, caseId);
  requireLiteral(access.network, "disabled", `${accessPath}.network`, add, caseId);
  requireLiteral(access.credentials, "excluded", `${accessPath}.credentials`, add, caseId);
  requireLiteral(access.remote, "disabled", `${accessPath}.remote`, add, caseId);
  requireLiteral(access.mutation, "none", `${accessPath}.mutation`, add, caseId);
}

function validateAllowedTools(value, toolsMode, jsonPath, add, caseId) {
  if (!Array.isArray(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "allowed_tools must be an array.", caseId);
    return;
  }
  const values = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0 || item.trim() !== item) {
      add("SCHEMA_VALUE_INVALID", `${jsonPath}[${index}]`, "Tool names must be non-empty strings.", caseId);
      continue;
    }
    if (values.has(item)) {
      add("SCHEMA_VALUE_INVALID", `${jsonPath}[${index}]`, `Tool '${item}' is duplicated.`, caseId);
    }
    values.add(item);
  }
  if (toolsMode === "none" && value.length !== 0) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "allowed_tools must be empty when tools is 'none'.", caseId);
  }
  if (toolsMode === "allowlisted" && value.length === 0) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "allowed_tools must be non-empty when tools is 'allowlisted'.", caseId);
  }
}

function validateEvaluatorOnly(value, suite, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "evaluator_only must be a JSON object.", caseId);
    return;
  }
  const routingFields = suite === "routing" ? ["expected_routes", "forbidden_routes"] : [];
  const fields = ["criteria", "expected_behavior", "forbidden_behavior", "safety_vetoes", ...routingFields];
  checkObjectKeys(value, fields, fields, jsonPath, add, caseId);

  validateCriteria(value.criteria, `${jsonPath}.criteria`, add, caseId);
  validateStringArray(value.expected_behavior, `${jsonPath}.expected_behavior`, add, caseId, { nonEmpty: true });
  validateStringArray(value.forbidden_behavior, `${jsonPath}.forbidden_behavior`, add, caseId);
  validateSafetyVetoes(value.safety_vetoes, `${jsonPath}.safety_vetoes`, add, caseId);

  if (suite === "routing") {
    validateIdentityArray(value.expected_routes, `${jsonPath}.expected_routes`, add, caseId, {
      nonEmpty: true,
      duplicateCode: "SCHEMA_VALUE_INVALID",
    });
    validateIdentityArray(value.forbidden_routes, `${jsonPath}.forbidden_routes`, add, caseId, {
      nonEmpty: false,
      duplicateCode: "SCHEMA_VALUE_INVALID",
    });
  }
}

function validateCriteria(value, jsonPath, add, caseId) {
  if (!Array.isArray(value) || value.length === 0) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "criteria must be a non-empty array.", caseId);
    return;
  }
  const ids = new Set();
  for (const [index, criterion] of value.entries()) {
    const path = `${jsonPath}[${index}]`;
    if (!isRecord(criterion)) {
      add("SCHEMA_VALUE_INVALID", path, "Criteria must be JSON objects.", caseId);
      continue;
    }
    checkObjectKeys(
      criterion,
      ["criterion_id", "description", "material"],
      ["criterion_id", "description", "material"],
      path,
      add,
      caseId,
    );
    if (!isSkillName(criterion.criterion_id)) {
      add("SCHEMA_VALUE_INVALID", `${path}.criterion_id`, "criterion_id must be kebab-case.", caseId);
    } else if (ids.has(criterion.criterion_id)) {
      add(
        "CRITERION_ID_DUPLICATE",
        `${path}.criterion_id`,
        `criterion_id '${criterion.criterion_id}' is duplicated.`,
        caseId,
      );
    }
    ids.add(criterion.criterion_id);
    requireTrimmedString(criterion.description, `${path}.description`, "description", add, caseId);
    requireBoolean(criterion.material, `${path}.material`, add, caseId);
  }
}

function validateSafetyVetoes(value, jsonPath, add, caseId) {
  if (!Array.isArray(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "safety_vetoes must be an array.", caseId);
    return;
  }
  const ids = new Set();
  for (const [index, veto] of value.entries()) {
    const path = `${jsonPath}[${index}]`;
    if (!isRecord(veto)) {
      add("SCHEMA_VALUE_INVALID", path, "Safety vetoes must be JSON objects.", caseId);
      continue;
    }
    checkObjectKeys(veto, ["veto_id", "description"], ["veto_id", "description"], path, add, caseId);
    if (!isSkillName(veto.veto_id)) {
      add("SCHEMA_VALUE_INVALID", `${path}.veto_id`, "veto_id must be kebab-case.", caseId);
    } else if (ids.has(veto.veto_id)) {
      add("VETO_ID_DUPLICATE", `${path}.veto_id`, `veto_id '${veto.veto_id}' is duplicated.`, caseId);
    }
    ids.add(veto.veto_id);
    requireTrimmedString(veto.description, `${path}.description`, "description", add, caseId);
  }
}

function validateSuiteConfig(value, suite, jsonPath, add, caseId) {
  if (!isRecord(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, "suite_config must be a JSON object.", caseId);
    return;
  }

  if (suite === "regression") {
    checkObjectKeys(
      value,
      ["behavior_area", "protected_invariants"],
      ["behavior_area", "protected_invariants"],
      jsonPath,
      add,
      caseId,
    );
    if (!isSkillName(value.behavior_area)) {
      add(
        "SCHEMA_VALUE_INVALID",
        `${jsonPath}.behavior_area`,
        "behavior_area must be a kebab-case identity.",
        caseId,
      );
    }
    validateIdentityArray(value.protected_invariants, `${jsonPath}.protected_invariants`, add, caseId, {
      nonEmpty: true,
      duplicateCode: "SCHEMA_VALUE_INVALID",
    });
    return;
  }

  if (suite === "routing") {
    checkObjectKeys(
      value,
      ["routing_mode", "candidate_skills", "near_miss"],
      ["routing_mode", "candidate_skills", "near_miss"],
      jsonPath,
      add,
      caseId,
    );
    requireLiteral(value.routing_mode, "repository", `${jsonPath}.routing_mode`, add, caseId);
    validateIdentityArray(value.candidate_skills, `${jsonPath}.candidate_skills`, add, caseId, {
      nonEmpty: true,
      duplicateCode: "SCHEMA_VALUE_INVALID",
    });
    requireBoolean(value.near_miss, `${jsonPath}.near_miss`, add, caseId);
    return;
  }

  if (suite === "fresh-reader") {
    checkObjectKeys(
      value,
      ["mode", "independence_required"],
      ["mode", "independence_required"],
      jsonPath,
      add,
      caseId,
    );
    if (!freshReaderModes.has(value.mode)) {
      add("SCHEMA_VALUE_INVALID", `${jsonPath}.mode`, "Fresh-reader mode is unsupported.", caseId);
    }
    requireLiteral(value.independence_required, true, `${jsonPath}.independence_required`, add, caseId);
  }
}

function validateRoutingConsistency(evaluatorOnly, suiteConfig, jsonPath, add, caseId) {
  if (!isRecord(evaluatorOnly) || !isRecord(suiteConfig)) return;
  if (!Array.isArray(suiteConfig.candidate_skills)) return;
  const candidates = new Set(suiteConfig.candidate_skills);
  const expected = Array.isArray(evaluatorOnly.expected_routes)
    ? evaluatorOnly.expected_routes
    : [];
  const forbidden = Array.isArray(evaluatorOnly.forbidden_routes)
    ? evaluatorOnly.forbidden_routes
    : [];

  for (const [field, routes] of [
    ["expected_routes", expected],
    ["forbidden_routes", forbidden],
  ]) {
    for (const [index, route] of routes.entries()) {
      if (isSkillName(route) && !candidates.has(route)) {
        add(
          "ROUTING_IDENTITY_INCONSISTENT",
          `${jsonPath}.${field}[${index}]`,
          `Route '${route}' is not listed in candidate_skills.`,
          caseId,
        );
      }
    }
  }

  const forbiddenSet = new Set(forbidden);
  for (const [index, route] of expected.entries()) {
    if (isSkillName(route) && forbiddenSet.has(route)) {
      add(
        "ROUTING_IDENTITY_INCONSISTENT",
        `${jsonPath}.expected_routes[${index}]`,
        `Route '${route}' cannot be both expected and forbidden.`,
        caseId,
      );
    }
  }
}

function checkObjectKeys(value, required, allowed, jsonPath, add, caseId) {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      add("SCHEMA_FIELD_MISSING", `${jsonPath}.${key}`, `Required field '${key}' is missing.`, caseId);
    }
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      add("SCHEMA_FIELD_UNSUPPORTED", `${jsonPath}.${key}`, `Field '${key}' is unsupported.`, caseId);
    }
  }
}

function validateIdentityArray(value, jsonPath, add, caseId, options) {
  if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) {
    add(
      "SCHEMA_VALUE_INVALID",
      jsonPath,
      `${jsonPath.split(".").at(-1)} must be ${options.nonEmpty ? "a non-empty" : "an"} array.`,
      caseId,
    );
    return;
  }
  const values = new Set();
  for (const [index, item] of value.entries()) {
    if (!isSkillName(item)) {
      add("SCHEMA_VALUE_INVALID", `${jsonPath}[${index}]`, "Identity values must be kebab-case.", caseId);
    } else if (values.has(item)) {
      add(options.duplicateCode, `${jsonPath}[${index}]`, `Identity '${item}' is duplicated.`, caseId);
    }
    values.add(item);
  }
}

function validateStringArray(value, jsonPath, add, caseId, options = {}) {
  if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) {
    add(
      "SCHEMA_VALUE_INVALID",
      jsonPath,
      `${jsonPath.split(".").at(-1)} must be ${options.nonEmpty ? "a non-empty" : "an"} array.`,
      caseId,
    );
    return;
  }
  for (const [index, item] of value.entries()) {
    requireTrimmedString(item, `${jsonPath}[${index}]`, "array item", add, caseId);
  }
}

function requireTrimmedString(value, jsonPath, label, add, caseId) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    add("SCHEMA_VALUE_INVALID", jsonPath, `${label} must be a non-empty trimmed string.`, caseId);
  }
}

function requireEnum(value, allowed, jsonPath, add, caseId) {
  if (!allowed.includes(value)) {
    add("SCHEMA_VALUE_INVALID", jsonPath, `Value must be one of: ${allowed.join(", ")}.`, caseId);
  }
}

function requireLiteral(value, expected, jsonPath, add, caseId) {
  if (value !== expected) {
    add("SCHEMA_VALUE_INVALID", jsonPath, `Value must be ${JSON.stringify(expected)}.`, caseId);
  }
}

function requireBoolean(value, jsonPath, add, caseId) {
  if (typeof value !== "boolean") {
    add("SCHEMA_VALUE_INVALID", jsonPath, "Value must be a boolean.", caseId);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
