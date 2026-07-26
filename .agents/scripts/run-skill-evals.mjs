import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  ArtifactError,
  assertBundleManifest,
  assertExecutionContextManifest,
  assertHumanEvaluation,
  assertObservation,
  assertWorkspaceManifest,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
  suiteOrder,
} from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  listWorkspaceFiles,
  optionalArtifactBytes,
  prepareSyntheticWorkspace,
  readArtifactBytes,
  resolveWorkspace,
  writeCompleteReport,
} from "./lib/skill-evals/synthetic-workspace-v1.mjs";
import {
  isSafeRepositoryPath,
  isRepositoryPathSafetyRefusal,
  isSkillName,
  suiteNames,
  suiteSchemaVersion,
  validateSuiteDefinition,
} from "./lib/skill-evals/suite-schema-v1.mjs";

const toolName = "run-skill-evals";
const skillsRootPath = ".agents/skills";
const evalsRootPath = ".agents/evals";

class OperationalError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

main();

function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === "--help") {
    console.log(`Usage:
  node .agents/scripts/run-skill-evals.mjs validate --all
  node .agents/scripts/run-skill-evals.mjs validate --skill <skill>
  node .agents/scripts/run-skill-evals.mjs prepare --skill <skill> --isolation synthetic \\
    (--candidate-current-tree | --candidate-ref <ref>) \\
    (--baseline-ref <ref> | --no-baseline)
  node .agents/scripts/run-skill-evals.mjs report --workspace <workspace-id>

Validates suites, prepares deterministic synthetic packages, or aggregates validated evidence.
Synthetic packaging is not enforced isolation. The runner does not execute or grade a model.`);
    return;
  }

  const command = parseCommand(args);
  if (!command) return;

  if (command.command === "prepare") {
    runPrepare(command);
    return;
  }
  if (command.command === "report") {
    runReport(command);
    return;
  }

  const state = createValidationState(command.scope);
  try {
    const result = validateRepository(process.cwd(), command, state);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCodeForStatus(result.status);
  } catch (error) {
    const operationalError =
      error instanceof OperationalError
        ? error
        : new OperationalError(
            "OPERATIONAL_FAILURE",
            "Suite validation could not read the required repository state.",
          );
    addDiagnostic(state, {
      severity: "error",
      code: operationalError.code,
      message: operationalError.message,
    });
    console.log(JSON.stringify(buildResult(state, "operational_error"), null, 2));
    process.exitCode = 3;
  }
}

function parseCommand(args) {
  if (args[0] === "prepare") return parsePrepareCommand(args.slice(1));
  if (args[0] === "report") {
    if (args.length === 3 && args[1] === "--workspace") {
      return { command: "report", workspaceId: args[2] };
    }
    console.error("Usage: run-skill-evals.mjs report --workspace <workspace-id>");
    process.exitCode = 2;
    return undefined;
  }

  if (args[0] !== "validate") {
    console.error(`Unsupported command: ${args[0] ?? "<missing>"}`);
    process.exitCode = 2;
    return undefined;
  }

  if (args.length === 2 && args[1] === "--all") {
    return { command: "validate", scope: { mode: "all" } };
  }

  if (args.length === 3 && args[1] === "--skill" && isSkillName(args[2])) {
    return { command: "validate", scope: { mode: "skill", skill: args[2] } };
  }

  console.error("Usage: run-skill-evals.mjs validate (--all | --skill <kebab-case-skill>)");
  process.exitCode = 2;
  return undefined;
}

function parsePrepareCommand(args) {
  const values = new Map();
  const booleans = new Set();
  const valueFlags = new Set(["--skill", "--isolation", "--candidate-ref", "--baseline-ref"]);
  const booleanFlags = new Set(["--candidate-current-tree", "--no-baseline"]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (valueFlags.has(flag)) {
      if (values.has(flag) || index + 1 >= args.length || args[index + 1].startsWith("--")) {
        return prepareUsageError();
      }
      values.set(flag, args[index + 1]);
      index += 1;
      continue;
    }
    if (booleanFlags.has(flag)) {
      if (booleans.has(flag)) return prepareUsageError();
      booleans.add(flag);
      continue;
    }
    return prepareUsageError();
  }

  const skill = values.get("--skill");
  const isolation = values.get("--isolation");
  const hasCurrentTree = booleans.has("--candidate-current-tree");
  const candidateRef = values.get("--candidate-ref");
  const hasNoBaseline = booleans.has("--no-baseline");
  const baselineRef = values.get("--baseline-ref");
  if (
    !isSkillName(skill) ||
    isolation !== "synthetic" ||
    Number(hasCurrentTree) + Number(candidateRef !== undefined) !== 1 ||
    Number(hasNoBaseline) + Number(baselineRef !== undefined) !== 1
  ) {
    return prepareUsageError();
  }
  return {
    command: "prepare",
    skill,
    candidate: hasCurrentTree
      ? { kind: "current_tree" }
      : { kind: "ref", ref: candidateRef },
    baseline: hasNoBaseline ? null : baselineRef,
  };
}

function prepareUsageError() {
  console.error(
    "Usage: run-skill-evals.mjs prepare --skill <skill> --isolation synthetic " +
      "(--candidate-current-tree | --candidate-ref <ref>) " +
      "(--baseline-ref <ref> | --no-baseline)",
  );
  process.exitCode = 2;
  return undefined;
}

function runPrepare(command) {
  try {
    const suites = loadConfiguredSuites(process.cwd(), command.skill);
    const output = prepareSyntheticWorkspace(process.cwd(), command, suites);
    process.stdout.write(canonicalJson(output));
  } catch (error) {
    const normalized =
      error instanceof ArtifactError
        ? error
        : new ArtifactError(
            "PREPARE_OPERATION_FAILED",
            "Synthetic preparation failed before producing a valid result.",
            3,
          );
    process.stdout.write(
      canonicalJson({
        schema_version: suiteSchemaVersion,
        artifact_type: "command_error",
        command: "prepare",
        status: "error",
        code: normalized.code,
        message: normalized.message,
      }),
    );
    process.exitCode = normalized.exitCode;
  }
}

function runReport(command) {
  try {
    const workspacePath = resolveWorkspace(command.workspaceId);
    const report = generateReport(workspacePath, command.workspaceId);
    const bytes = Buffer.from(canonicalJson(report), "utf8");
    if (report.evidence_status === "complete") {
      writeCompleteReport(workspacePath, bytes);
    } else if (
      optionalArtifactBytes(
        workspacePath,
        "report/generated-report.json",
        "generated report",
      )
    ) {
      throw new ArtifactError(
        "REPORT_STATE_INCONSISTENT",
        "A persisted complete report exists but required evidence is now absent.",
        3,
      );
    }
    process.stdout.write(bytes);
  } catch (error) {
    const normalized =
      error instanceof ArtifactError
        ? error
        : new ArtifactError(
            "REPORT_OPERATION_FAILED",
            "Report generation failed before producing a valid report.",
            3,
          );
    process.stdout.write(
      canonicalJson({
        schema_version: suiteSchemaVersion,
        artifact_type: "command_error",
        command: "report",
        status: "error",
        code: normalized.code,
        message: normalized.message,
      }),
    );
    process.exitCode = normalized.exitCode;
  }
}

function generateReport(workspacePath, workspaceId) {
  const manifestBytes = readArtifactBytes(
    workspacePath,
    "workspace-manifest.json",
    "workspace manifest",
  );
  const manifestValue = parseStrictJson(manifestBytes, "workspace_manifest");
  assertCanonicalRunnerArtifact(manifestBytes, manifestValue, "workspace_manifest");
  const manifest = assertWorkspaceManifest(manifestValue, workspaceId);
  verifyPreparedInventory(workspacePath, manifest);
  const suites = readWorkspaceSuites(workspacePath, manifest);
  const contextHashes = verifyPreparedPackages(workspacePath, manifest, suites);
  verifyEvidenceLayout(workspacePath, manifest, suites);

  const cases = [];
  let complete = true;
  for (const suite of suiteOrder) {
    for (const caseValue of [...suites[suite].cases].sort((left, right) =>
      compareStrings(left.case_id, right.case_id),
    )) {
      const reportCase = readCaseEvidence(
        workspacePath,
        manifest,
        suite,
        caseValue.case_id,
        contextHashes,
      );
      if (reportCase.evidence_status === "incomplete") complete = false;
      cases.push(reportCase);
    }
  }
  return {
    schema_version: suiteSchemaVersion,
    artifact_type: "generated_report",
    workspace_id: workspaceId,
    skill: manifest.skill,
    mode: manifest.mode,
    workspace_input_hash: manifest.workspace_input_hash,
    evidence_status: complete ? "complete" : "incomplete",
    cases,
    claim_boundaries: [
      "synthetic describes packaging and does not prove isolation",
      "requested execution policy is separate from observed access",
      "the runner did not execute or semantic-grade a model",
      "the report does not prove native routing or automatic skill activation",
      "fixture tests do not establish benchmark, remote, or production quality",
    ],
  };
}

function verifyEvidenceLayout(workspacePath, manifest, suites) {
  const allowedObservations = [];
  const allowedHumanEvaluations = [];
  for (const suite of suiteOrder) {
    for (const caseValue of suites[suite].cases) {
      for (const role of manifest.source_roles) {
        allowedObservations.push(
          `evaluator/observations/${role}/${suite}/${caseValue.case_id}.json`,
        );
      }
      allowedHumanEvaluations.push(
        `evaluator/human-evaluations/${suite}/${caseValue.case_id}.json`,
      );
    }
  }
  const actualObservations = listWorkspaceFiles(workspacePath, "evaluator/observations");
  const actualHumanEvaluations = listWorkspaceFiles(
    workspacePath,
    "evaluator/human-evaluations",
  );
  for (const path of actualObservations) {
    if (!allowedObservations.includes(path)) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        "Workspace contains an unexpected observation artifact.",
      );
    }
  }
  for (const path of actualHumanEvaluations) {
    if (!allowedHumanEvaluations.includes(path)) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        "Workspace contains an unexpected human_evaluation artifact.",
      );
    }
  }
}

function verifyPreparedInventory(workspacePath, manifest) {
  const expectedPaths = manifest.artifact_inventory.map((entry) => entry.path);
  const actualPaths = [
    ...listWorkspaceFiles(workspacePath, "executor"),
    ...listWorkspaceFiles(workspacePath, "evaluator/suite-definitions"),
  ].sort(compareStrings);
  if (!sameArray(expectedPaths, actualPaths)) {
    throw new ArtifactError(
      "INTEGRITY_MISMATCH",
      "Prepared artifact inventory does not match workspace contents.",
      3,
    );
  }
  for (const entry of manifest.artifact_inventory) {
    const bytes = readArtifactBytes(workspacePath, entry.path, "prepared artifact");
    if (bytes.length !== entry.byte_count || sha256Bytes(bytes) !== entry.sha256) {
      throw new ArtifactError(
        "INTEGRITY_MISMATCH",
        `Prepared artifact '${entry.path}' failed its integrity check.`,
        3,
      );
    }
  }
}

function readWorkspaceSuites(workspacePath, manifest) {
  return Object.fromEntries(
    suiteOrder.map((suite) => {
      const relativePath = `evaluator/suite-definitions/${suite}.json`;
      const bytes = readArtifactBytes(workspacePath, relativePath, "suite definition");
      const value = parseStrictJson(bytes, `${suite} suite_definition`);
      assertCanonicalRunnerArtifact(bytes, value, `${suite} suite_definition`);
      const diagnostics = validateSuiteDefinition(value, { skill: manifest.skill, suite });
      if (diagnostics.length > 0) {
        const unsupported = diagnostics.some(
          (diagnostic) => diagnostic.code === "SCHEMA_VERSION_UNSUPPORTED",
        );
        throw new ArtifactError(
          unsupported ? "SUITE_VERSION_UNSUPPORTED" : "SUITE_INVALID",
          `Prepared ${suite} suite is invalid.`,
          unsupported ? 2 : 1,
        );
      }
      return [suite, value];
    }),
  );
}

function verifyPreparedPackages(workspacePath, manifest, suites) {
  const contextHashes = new Map();
  const sourceByRole = manifest.sources;
  for (const variantId of Object.keys(manifest.variant_mapping).sort(compareStrings)) {
    const role = manifest.variant_mapping[variantId];
    const bundlePath = `executor/${variantId}/bundle-manifest.json`;
    const bundleBytes = readArtifactBytes(workspacePath, bundlePath, "bundle manifest");
    const bundleValue = parseStrictJson(bundleBytes, "bundle_manifest");
    assertCanonicalRunnerArtifact(bundleBytes, bundleValue, "bundle_manifest");
    const bundle = assertBundleManifest(bundleValue, {
      workspaceId: manifest.workspace_id,
      skill: manifest.skill,
    });
    if (
      bundle.variant_id !== variantId ||
      sha256Canonical(bundle.files) !== sourceByRole[role].bundle_hash
    ) {
      throw new ArtifactError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Bundle manifest does not match its workspace source role.",
      );
    }
    for (const entry of bundle.files) {
      if (entry.present === false) continue;
      const prefix = `.agents/skills/${manifest.skill}/`;
      if (!entry.path.startsWith(prefix)) {
        throw new ArtifactError(
          "ARTIFACT_RELATIONSHIP_INVALID",
          "Bundle manifest contains a path outside the selected skill.",
        );
      }
      const relativeBundlePath = entry.path.slice(prefix.length);
      const bytes = readArtifactBytes(
        workspacePath,
        `executor/${variantId}/bundle/${relativeBundlePath}`,
        "bundle file",
      );
      if (bytes.length !== entry.byte_count || sha256Bytes(bytes) !== entry.sha256) {
        throw new ArtifactError("INTEGRITY_MISMATCH", "Bundle file hash does not match.", 3);
      }
    }

    for (const suite of suiteOrder) {
      for (const caseValue of suites[suite].cases) {
        const caseRoot = `executor/${variantId}/cases/${suite}/${caseValue.case_id}`;
        const contextBytes = readArtifactBytes(
          workspacePath,
          `${caseRoot}/execution-context-manifest.json`,
          "execution context manifest",
        );
        const contextValue = parseStrictJson(contextBytes, "execution_context_manifest");
        assertCanonicalRunnerArtifact(
          contextBytes,
          contextValue,
          "execution_context_manifest",
        );
        const context = assertExecutionContextManifest(contextValue, {
          workspaceId: manifest.workspace_id,
          skill: manifest.skill,
        });
        if (
          context.variant_id !== variantId ||
          context.suite !== suite ||
          context.case_id !== caseValue.case_id
        ) {
          throw new ArtifactError(
            "ARTIFACT_IDENTITY_MISMATCH",
            "Execution context manifest identity does not match its path.",
          );
        }
        const prompt = readArtifactBytes(workspacePath, `${caseRoot}/prompt.txt`, "prompt");
        if (sha256Bytes(prompt) !== context.prompt_sha256) {
          throw new ArtifactError("INTEGRITY_MISMATCH", "Prompt hash does not match.", 3);
        }
        for (const entry of context.context) {
          const bytes = readArtifactBytes(
            workspacePath,
            `${caseRoot}/${entry.path}`,
            "execution context file",
          );
          if (bytes.length !== entry.byte_count || sha256Bytes(bytes) !== entry.sha256) {
            throw new ArtifactError(
              "INTEGRITY_MISMATCH",
              "Execution context file hash does not match.",
              3,
            );
          }
        }
        contextHashes.set(
          `${role}\u0000${suite}\u0000${caseValue.case_id}`,
          context.execution_context_hash,
        );
      }
    }
  }
  return contextHashes;
}

function readCaseEvidence(workspacePath, manifest, suite, caseId, contextHashes) {
  const observations = {};
  const observationValues = {};
  const observationHashes = {};
  let missingObservation = false;
  for (const role of manifest.source_roles) {
    const relativePath = `evaluator/observations/${role}/${suite}/${caseId}.json`;
    const bytes = optionalArtifactBytes(workspacePath, relativePath, `${role} observation`);
    if (!bytes) {
      observations[role] = null;
      missingObservation = true;
      continue;
    }
    const value = parseStrictJson(bytes, `${role}_observation`);
    const variantId = variantForRole(manifest.variant_mapping, role);
    const observation = assertObservation(value, {
      workspaceId: manifest.workspace_id,
      skill: manifest.skill,
      role,
      executionContextHash: contextHashes.get(`${role}\u0000${suite}\u0000${caseId}`),
    });
    if (
      observation.suite !== suite ||
      observation.case_id !== caseId ||
      observation.variant_id !== variantId
    ) {
      throw new ArtifactError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Observation identity does not match its workspace path.",
      );
    }
    const hash = sha256Bytes(bytes);
    observationValues[role] = observation;
    observationHashes[role] = hash;
    observations[role] = {
      artifact_sha256: hash,
      execution_status: observation.execution_status,
      execution_reason: observation.execution_reason,
      raw_response: observation.raw_response,
      observed_access: observation.observed_access,
    };
  }

  const humanPath = `evaluator/human-evaluations/${suite}/${caseId}.json`;
  const humanBytes = optionalArtifactBytes(workspacePath, humanPath, "human evaluation");
  if (missingObservation && humanBytes) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "A human evaluation cannot reference an absent required observation.",
    );
  }
  if (missingObservation || !humanBytes) {
    return {
      suite,
      case_id: caseId,
      evidence_status: "incomplete",
      observations,
      human_evaluation: null,
      case_status: null,
      comparison_status: null,
    };
  }

  const humanValue = parseStrictJson(humanBytes, "human_evaluation");
  const human = assertHumanEvaluation(humanValue, {
    workspaceId: manifest.workspace_id,
    skill: manifest.skill,
    mode: manifest.mode,
    observationHashes,
    candidateExecutionStatus: observationValues.candidate.execution_status,
  });
  if (human.suite !== suite || human.case_id !== caseId) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "human_evaluation identity does not match its workspace path.",
    );
  }
  return {
    suite,
    case_id: caseId,
    evidence_status: "complete",
    observations,
    human_evaluation: {
      artifact_sha256: sha256Bytes(humanBytes),
      rationale: human.rationale,
    },
    case_status: human.case_status,
    comparison_status: human.comparison_status,
  };
}

function assertCanonicalRunnerArtifact(bytes, value, label) {
  if (!bytes.equals(Buffer.from(canonicalJson(value), "utf8"))) {
    throw new ArtifactError(
      "INTEGRITY_MISMATCH",
      `${label} is not the canonical runner-produced artifact.`,
      3,
    );
  }
}

function variantForRole(mapping, role) {
  const match = Object.entries(mapping).find(([, mappedRole]) => mappedRole === role);
  if (!match) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      `Workspace has no variant for role '${role}'.`,
    );
  }
  return match[0];
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function loadConfiguredSuites(repoRoot, skill) {
  const state = createValidationState({ mode: "skill", skill });
  let result;
  try {
    result = validateRepository(repoRoot, { command: "validate", scope: state.scope }, state);
  } catch (error) {
    if (error instanceof OperationalError) {
      throw new ArtifactError(error.code, error.message, 3);
    }
    throw error;
  }
  if (result.status !== "valid") {
    const unsupported = result.status === "unsupported_schema";
    throw new ArtifactError(
      unsupported ? "SUITE_VERSION_UNSUPPORTED" : "SUITE_INVALID",
      `Configured suite validation failed: ${result.diagnostics.map((item) => item.code).join(", ")}.`,
      unsupported ? 2 : 1,
    );
  }
  return Object.fromEntries(
    suiteNames.map((suite) => {
      const path = resolve(repoRoot, evalsRootPath, skill, `${suite}.json`);
      return [suite, JSON.parse(readFileSync(path, "utf8"))];
    }),
  );
}

function validateRepository(repoRoot, command, state) {
  const absoluteSkillsRoot = resolve(repoRoot, skillsRootPath);
  assertRepositoryPathNoReparse(repoRoot, skillsRootPath);
  assertDirectory(absoluteSkillsRoot, skillsRootPath, "SKILLS_ROOT_UNAVAILABLE");

  if (command.scope.mode === "skill" && !skillCoreExists(repoRoot, command.scope.skill)) {
    addDiagnostic(state, {
      severity: "error",
      code: "SKILL_NOT_FOUND",
      skill: command.scope.skill,
      path: `${skillsRootPath}/${command.scope.skill}/SKILL.md`,
      message: "Requested repo-local skill does not exist.",
    });
    return buildResult(state, "invalid");
  }

  const absoluteEvalsRoot = resolve(repoRoot, evalsRootPath);
  const evalsRootStat = optionalStat(absoluteEvalsRoot, evalsRootPath);
  if (!evalsRootStat) {
    return buildResult(
      state,
      command.scope.mode === "skill" ? "not_configured" : "valid",
    );
  }
  assertRepositoryPathNoReparse(repoRoot, evalsRootPath);
  if (evalsRootStat.isSymbolicLink()) {
    throw new OperationalError(
      "PATH_REPARSE_POINT",
      `${evalsRootPath} must not be a symbolic link, junction, or reparse point.`,
    );
  }
  if (!evalsRootStat.isDirectory()) {
    throw new OperationalError("EVAL_ROOT_UNREADABLE", `${evalsRootPath} must be a directory.`);
  }

  if (command.scope.mode === "skill") {
    const absoluteSkillEvals = resolve(absoluteEvalsRoot, command.scope.skill);
    const skillEvalsStat = optionalStat(
      absoluteSkillEvals,
      `${evalsRootPath}/${command.scope.skill}`,
    );
    if (!skillEvalsStat) return buildResult(state, "not_configured");
    if (skillEvalsStat.isSymbolicLink()) {
      throw new OperationalError(
        "PATH_REPARSE_POINT",
        `Eval directory for '${command.scope.skill}' must not be a symbolic link or junction.`,
      );
    }
    if (!skillEvalsStat.isDirectory()) {
      addDiagnostic(state, {
        severity: "error",
        code: "SUITE_ENTRY_UNSUPPORTED",
        skill: command.scope.skill,
        path: `${evalsRootPath}/${command.scope.skill}`,
        message: "Configured skill eval entry must be a directory.",
      });
    } else {
      validateConfiguredSkill(repoRoot, absoluteSkillEvals, command.scope.skill, state);
    }
    return buildResult(state, statusFromDiagnostics(state.diagnostics));
  }

  const entries = readDirectory(absoluteEvalsRoot, evalsRootPath);
  for (const entry of entries.sort(compareNames)) {
    const entryPath = `${evalsRootPath}/${entry.name}`;
    const absoluteEntry = resolve(absoluteEvalsRoot, entry.name);
    if (entry.isSymbolicLink()) {
      throw new OperationalError(
        "PATH_REPARSE_POINT",
        `${entryPath} must not be a symbolic link, junction, or reparse point.`,
      );
    }
    if (!entry.isDirectory()) {
      addDiagnostic(state, {
        severity: "error",
        code: "SUITE_ENTRY_UNSUPPORTED",
        path: entryPath,
        message: "Only per-skill eval directories are supported under .agents/evals.",
      });
      continue;
    }
    validateConfiguredSkill(repoRoot, absoluteEntry, entry.name, state);
  }

  return buildResult(state, statusFromDiagnostics(state.diagnostics));
}

function validateConfiguredSkill(repoRoot, absoluteSkillEvals, skill, state) {
  state.summary.configured_skills += 1;
  const skillEvalsPath = `${evalsRootPath}/${skill}`;

  if (!isSkillName(skill)) {
    addDiagnostic(state, {
      severity: "error",
      code: "SKILL_NAME_INVALID",
      skill,
      path: skillEvalsPath,
      message: "Configured eval directory name must be a kebab-case skill identity.",
    });
  } else if (!skillCoreExists(repoRoot, skill)) {
    addDiagnostic(state, {
      severity: "error",
      code: "EVAL_SKILL_NOT_FOUND",
      skill,
      path: skillEvalsPath,
      message: "Configured eval directory must match an existing repo-local skill.",
    });
  }

  const entries = readDirectory(absoluteSkillEvals, skillEvalsPath).sort(compareNames);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const expectedNames = new Set(suiteNames.map((suite) => `${suite}.json`));
  const missing = [...expectedNames].filter((name) => !byName.has(name)).sort(compareStrings);
  if (missing.length > 0) {
    addDiagnostic(state, {
      severity: "error",
      code: "SUITE_SET_INCOMPLETE",
      skill,
      path: skillEvalsPath,
      message: `Configured eval skill is missing required suite files: ${missing.join(", ")}.`,
    });
  }

  for (const entry of entries) {
    const entryPath = `${skillEvalsPath}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      throw new OperationalError(
        "PATH_REPARSE_POINT",
        `${entryPath} must not be a symbolic link, junction, or reparse point.`,
      );
    }
    if (!expectedNames.has(entry.name) || !entry.isFile()) {
      addDiagnostic(state, {
        severity: "error",
        code: "SUITE_ENTRY_UNSUPPORTED",
        skill,
        path: entryPath,
        message: "Eval directory contains an entry unsupported by suite schema v1.",
      });
    }
  }

  for (const suite of suiteNames) {
    const fileName = `${suite}.json`;
    const entry = byName.get(fileName);
    if (!entry?.isFile() || entry.isSymbolicLink()) continue;
    state.summary.suite_files += 1;
    validateSuiteFile(repoRoot, resolve(absoluteSkillEvals, fileName), skill, suite, state);
  }
}

function validateSuiteFile(repoRoot, absolutePath, skill, suite, state) {
  const suitePath = `${evalsRootPath}/${skill}/${suite}.json`;
  const suiteStat = optionalStat(absolutePath, suitePath);
  if (!suiteStat || suiteStat.isSymbolicLink() || !suiteStat.isFile()) {
    throw new OperationalError(
      "PATH_REPARSE_POINT",
      `${suitePath} must be a regular file and must not be a symbolic link or reparse point.`,
    );
  }
  let bytes;
  try {
    bytes = readFileSync(absolutePath);
  } catch {
    throw new OperationalError("SUITE_FILE_UNREADABLE", `Unable to read ${suitePath}.`);
  }

  if (bytes.length === 0 || bytes.at(-1) !== 0x0a) {
    addDiagnostic(state, {
      severity: "error",
      code: "SUITE_FINAL_NEWLINE_MISSING",
      skill,
      suite,
      path: suitePath,
      message: "Suite JSON must end with a newline.",
    });
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    addDiagnostic(state, {
      severity: "error",
      code: "SUITE_FILE_ENCODING_INVALID",
      skill,
      suite,
      path: suitePath,
      message: "Suite JSON must contain valid UTF-8.",
    });
    return;
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    addDiagnostic(state, {
      severity: "error",
      code: "SUITE_JSON_INVALID",
      skill,
      suite,
      path: suitePath,
      message: "Suite definition must contain valid JSON.",
    });
    return;
  }

  if (Array.isArray(value?.cases)) state.summary.cases += value.cases.length;
  assertSuiteContextPathsSafe(value, suitePath);

  for (const diagnostic of validateSuiteDefinition(value, { skill, suite })) {
    addDiagnostic(state, {
      severity: "error",
      code: diagnostic.code,
      skill,
      suite,
      case_id: diagnostic.case_id,
      path: suitePath,
      json_path: diagnostic.json_path,
      message: diagnostic.message,
    });
  }

  validateRepositoryContexts(repoRoot, value, skill, suite, suitePath, state);
}

function assertSuiteContextPathsSafe(value, suitePath) {
  if (!Array.isArray(value?.cases)) return;
  for (const caseValue of value.cases) {
    if (!Array.isArray(caseValue?.executor_input?.context)) continue;
    for (const context of caseValue.executor_input.context) {
      if (
        context?.source_type === "repository_file" &&
        isRepositoryPathSafetyRefusal(context.path)
      ) {
        throw new OperationalError(
          "CONTEXT_PATH_REFUSED",
          `${suitePath} contains a repository context path that is unsafe to resolve.`,
        );
      }
    }
  }
}

function validateRepositoryContexts(repoRoot, value, skill, suite, suitePath, state) {
  if (!Array.isArray(value?.cases)) return;
  for (const caseValue of value.cases) {
    if (!Array.isArray(caseValue?.executor_input?.context)) continue;
    for (const context of caseValue.executor_input.context) {
      if (context?.source_type !== "repository_file" || !isSafeRepositoryPath(context.path)) {
        continue;
      }
      validateRepositoryContextPath(
        repoRoot,
        context.path,
        { skill, suite, caseId: caseValue.case_id, suitePath },
        state,
      );
    }
  }
}

function validateRepositoryContextPath(repoRoot, path, identity, state) {
  const absoluteTarget = resolve(repoRoot, path.replace(/\//g, sep));
  if (!isContainedPath(repoRoot, absoluteTarget)) {
    addDiagnostic(state, {
      severity: "error",
      code: "CONTEXT_PATH_ESCAPE",
      skill: identity.skill,
      suite: identity.suite,
      case_id: identity.caseId,
      path: identity.suitePath,
      message: `Repository context '${path}' escapes the repository root.`,
    });
    return;
  }

  let current = repoRoot;
  for (const part of relative(repoRoot, absoluteTarget).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    const stat = optionalStat(current, path);
    if (!stat) {
      addDiagnostic(state, {
        severity: "error",
        code: "CONTEXT_FILE_MISSING",
        skill: identity.skill,
        suite: identity.suite,
        case_id: identity.caseId,
        path: identity.suitePath,
        message: `Repository context '${path}' does not exist.`,
      });
      return;
    }
    if (stat.isSymbolicLink()) {
      throw new OperationalError(
        "PATH_REPARSE_POINT",
        `Repository context '${path}' must not traverse a symbolic link, junction, or reparse point.`,
      );
    }
  }

  const finalStat = optionalStat(absoluteTarget, path);
  if (!finalStat?.isFile()) {
    addDiagnostic(state, {
      severity: "error",
      code: "CONTEXT_FILE_MISSING",
      skill: identity.skill,
      suite: identity.suite,
      case_id: identity.caseId,
      path: identity.suitePath,
      message: `Repository context '${path}' must be a regular file.`,
    });
  }
}

function skillCoreExists(repoRoot, skill) {
  const directoryPath = resolve(repoRoot, skillsRootPath, skill);
  const directoryStat = optionalStat(directoryPath, `${skillsRootPath}/${skill}`);
  if (!directoryStat) return false;
  if (directoryStat.isSymbolicLink()) {
    throw new OperationalError(
      "PATH_REPARSE_POINT",
      `Skill directory '${skill}' must not be a symbolic link or junction.`,
    );
  }
  if (!directoryStat.isDirectory()) return false;

  const corePath = resolve(directoryPath, "SKILL.md");
  const coreStat = optionalStat(corePath, `${skillsRootPath}/${skill}/SKILL.md`);
  if (!coreStat) return false;
  if (coreStat.isSymbolicLink()) {
    throw new OperationalError(
      "PATH_REPARSE_POINT",
      `SKILL.md for '${skill}' must not be a symbolic link or junction.`,
    );
  }
  return coreStat.isFile();
}

function createValidationState(scope) {
  return {
    scope,
    diagnostics: [],
    diagnosticKeys: new Set(),
    summary: {
      configured_skills: 0,
      suite_files: 0,
      cases: 0,
      errors: 0,
      warnings: 0,
    },
  };
}

function addDiagnostic(state, diagnostic) {
  const normalized = Object.fromEntries(
    Object.entries(diagnostic).filter(([, value]) => value !== undefined),
  );
  const key = [
    normalized.severity,
    normalized.code,
    normalized.path ?? "",
    normalized.skill ?? "",
    normalized.suite ?? "",
    normalized.case_id ?? "",
    normalized.json_path ?? "",
    normalized.message,
  ].join("\u0000");
  if (state.diagnosticKeys.has(key)) return;
  state.diagnosticKeys.add(key);
  state.diagnostics.push(normalized);
}

function buildResult(state, status) {
  state.diagnostics.sort(compareDiagnostics);
  state.summary.errors = state.diagnostics.filter((item) => item.severity === "error").length;
  state.summary.warnings = state.diagnostics.length - state.summary.errors;
  return {
    schema_version: suiteSchemaVersion,
    artifact_type: "validation_result",
    tool: toolName,
    command: "validate",
    status,
    scope: state.scope,
    summary: state.summary,
    diagnostics: state.diagnostics,
  };
}

function statusFromDiagnostics(diagnostics) {
  if (diagnostics.some((item) => item.code === "SCHEMA_VERSION_UNSUPPORTED")) {
    return "unsupported_schema";
  }
  return diagnostics.some((item) => item.severity === "error") ? "invalid" : "valid";
}

function exitCodeForStatus(status) {
  if (status === "unsupported_schema") return 2;
  if (status === "invalid") return 1;
  if (status === "operational_error") return 3;
  return 0;
}

function assertDirectory(path, displayPath, code) {
  const stat = optionalStat(path, displayPath);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new OperationalError(code, `Required directory ${displayPath} is missing or unreadable.`);
  }
}

function readDirectory(path, displayPath) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    throw new OperationalError("DIRECTORY_UNREADABLE", `Required directory ${displayPath} is unreadable.`);
  }
}

function optionalStat(path, displayPath) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error && typeof error === "object" && ["ENOENT", "ENOTDIR"].includes(error.code)) {
      return undefined;
    }
    throw new OperationalError("PATH_UNREADABLE", `Required path ${displayPath} is unreadable.`);
  }
}

function isContainedPath(parent, child) {
  const fromParent = relative(parent, child);
  return (
    fromParent === "" ||
    (!fromParent.startsWith(`..${sep}`) && fromParent !== ".." && !isAbsolute(fromParent))
  );
}

function assertRepositoryPathNoReparse(repoRoot, repositoryPath) {
  let current = repoRoot;
  for (const part of repositoryPath.split("/")) {
    current = resolve(current, part);
    const stat = optionalStat(current, repositoryPath);
    if (!stat) return;
    if (stat.isSymbolicLink()) {
      throw new OperationalError(
        "PATH_REPARSE_POINT",
        `${repositoryPath} must not traverse a symbolic link, junction, or reparse point.`,
      );
    }
  }
}

function compareNames(a, b) {
  return compareStrings(a.name, b.name);
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDiagnostics(a, b) {
  const severityOrder = { error: 0, warning: 1 };
  return (
    severityOrder[a.severity] - severityOrder[b.severity] ||
    compareStrings(a.path ?? "", b.path ?? "") ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.skill ?? "", b.skill ?? "") ||
    compareStrings(a.suite ?? "", b.suite ?? "") ||
    compareStrings(a.case_id ?? "", b.case_id ?? "") ||
    compareStrings(a.json_path ?? "", b.json_path ?? "") ||
    compareStrings(a.message, b.message)
  );
}
