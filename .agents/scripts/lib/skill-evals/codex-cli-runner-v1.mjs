import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  ArtifactError,
  assertBundleManifest,
  assertExecutionContextManifest,
  assertObservation,
  assertWorkspaceManifest,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
} from "./artifact-schema-v1.mjs";
import {
  readArtifactBytes,
  resolveWorkspace,
  resolveWorkspacePath,
} from "./synthetic-workspace-v1.mjs";
import { suiteNames, validateSuiteDefinition } from "./suite-schema-v1.mjs";

export const defaultConcurrency = 4;
export const defaultProcessTimeoutMs = 120_000;
export const defaultTerminationGraceMs = 1_000;
export const defaultHardKillGraceMs = 1_000;

export const cliBehaviorOptions = Object.freeze({
  model: "gpt-5.6-sol",
  reasoning_effort: "medium",
  sandbox: "read-only",
  ephemeral: true,
  ignore_user_config: true,
  ignore_rules: true,
});

export const readerOutputSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["raw_response", "observed_access"],
  properties: {
    raw_response: { type: "string" },
    observed_access: {
      type: "object",
      additionalProperties: false,
      required: [
        "basis",
        "credentials",
        "filesystem",
        "model_runtime",
        "mutation",
        "network",
        "process",
        "remote",
        "tools",
      ],
      properties: {
        basis: { type: "string", minLength: 1 },
        credentials: accessStatusSchema(),
        filesystem: accessStatusSchema(),
        model_runtime: accessStatusSchema(),
        mutation: accessStatusSchema(),
        network: accessStatusSchema(),
        process: accessStatusSchema(),
        remote: accessStatusSchema(),
        tools: accessStatusSchema(),
      },
    },
  },
});

export function createReaderLogicalIdentity({ skill, sourceRole, suite, caseId }) {
  const logicalUnitKey = {
    schema_version: 1,
    kind: "reader",
    skill,
    source_role: sourceRole,
    suite,
    case_id: caseId,
  };
  return {
    logicalUnitKey,
    unitId: `reader-${sha256Canonical(logicalUnitKey)}`,
  };
}

export function createExecutionId() {
  return `exec-${randomUUID().replaceAll("-", "")}`;
}

export function loadSelectedWorkspace(workspaceId, selectors) {
  const workspacePath = resolveWorkspace(workspaceId);
  const manifestBytes = readArtifactBytes(
    workspacePath,
    "workspace-manifest.json",
    "workspace manifest",
  );
  const manifestValue = parseStrictJson(manifestBytes, "workspace_manifest");
  assertCanonicalBytes(manifestBytes, manifestValue, "workspace_manifest");
  const manifest = assertWorkspaceManifest(manifestValue, workspaceId);
  const variantByRole = new Map(
    Object.entries(manifest.variant_mapping).map(([variantId, role]) => [role, variantId]),
  );
  const suites = new Map();
  const selected = [];

  for (const selector of selectors) {
    if (!manifest.source_roles.includes(selector.sourceRole)) {
      throw new ArtifactError(
        "UNIT_SELECTOR_INVALID",
        `Source role '${selector.sourceRole}' is unavailable in this workspace.`,
        2,
      );
    }
    let suiteDefinition = suites.get(selector.suite);
    if (!suiteDefinition) {
      const suiteBytes = readArtifactBytes(
        workspacePath,
        `evaluator/suite-definitions/${selector.suite}.json`,
        `${selector.suite} suite definition`,
      );
      const suiteValue = parseStrictJson(suiteBytes, `${selector.suite} suite_definition`);
      assertCanonicalBytes(suiteBytes, suiteValue, `${selector.suite} suite_definition`);
      const diagnostics = validateSuiteDefinition(suiteValue, {
        skill: manifest.skill,
        suite: selector.suite,
      });
      if (diagnostics.length > 0) {
        throw new ArtifactError(
          "SUITE_INVALID",
          `Prepared ${selector.suite} suite is invalid.`,
          3,
        );
      }
      suiteDefinition = suiteValue;
      suites.set(selector.suite, suiteDefinition);
    }
    const selectedCase = suiteDefinition.cases.find(
      (caseValue) => caseValue.case_id === selector.caseId,
    );
    if (!selectedCase) {
      throw new ArtifactError(
        "UNIT_SELECTOR_INVALID",
        `Case '${selector.caseId}' is not present in suite '${selector.suite}'.`,
        2,
      );
    }
    const variantId = variantByRole.get(selector.sourceRole);
    selected.push(
      validateSelectedSource({
        workspacePath,
        manifest,
        selector,
        selectedCase,
        variantId,
      }),
    );
  }

  return { manifest, selected, workspacePath };
}

export function materializePreparedUnits({ executionId, selected, workspacePath }) {
  const executionRoot = resolveWorkspacePath(
    workspacePath,
    `cli-executions/${executionId}`,
  );
  mkdirExclusive(executionRoot);
  return selected.map((source) => materializePreparedUnit(executionRoot, source));
}

export async function preflightCodexCli(options = {}) {
  const executable = options.executable ?? "codex";
  const prefixArgs = options.prefixArgs ?? [];
  const version = await runCapturedProcess(executable, [...prefixArgs, "--version"]);
  if (!version.spawned || version.exitCode !== 0) {
    throw new ArtifactError(
      "CODEX_PREFLIGHT_FAILED",
      "Codex CLI version preflight failed before reader dispatch.",
      3,
    );
  }
  const help = await runCapturedProcess(executable, [...prefixArgs, "exec", "--help"]);
  if (!help.spawned || help.exitCode !== 0) {
    throw new ArtifactError(
      "CODEX_PREFLIGHT_FAILED",
      "Codex CLI exec help preflight failed before reader dispatch.",
      3,
    );
  }
  const requiredFlags = [
    "--ignore-user-config",
    "--strict-config",
    "-c",
    "--model",
    "--sandbox",
    "--ephemeral",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--color",
    "--cd",
    "--output-schema",
    "--output-last-message",
    "--json",
  ];
  if (
    requiredFlags.some((flag) => !hasHelpToken(help.stdout, flag)) ||
    !hasHelpToken(help.stdout, "read-only")
  ) {
    throw new ArtifactError(
      "CODEX_PREFLIGHT_FAILED",
      "Codex CLI exec help is missing a required Stage 1 option.",
      3,
    );
  }
  return version.stdout.trim();
}

export async function executePreparedUnit(request, options = {}) {
  const executable = options.executable ?? "codex";
  const prefixArgs = options.prefixArgs ?? [];
  const timeoutMs = options.timeoutMs ?? defaultProcessTimeoutMs;
  const terminationGraceMs = options.terminationGraceMs ?? defaultTerminationGraceMs;
  const hardKillGraceMs = options.hardKillGraceMs ?? defaultHardKillGraceMs;
  const cliVersion = options.cliVersion ?? "unknown";
  const preparedUnit = request.prepared_unit;
  const inputPath = preparedUnit.invocation.cwd;
  const outputPath = request.output_path;
  const eventsPath = join(outputPath, "model-events.jsonl");
  const stderrPath = join(outputPath, "model-stderr.txt");
  const lastMessagePath = join(outputPath, "model-last-message.json");
  mkdirExclusive(outputPath);
  writeExclusive(eventsPath, Buffer.alloc(0));
  writeExclusive(stderrPath, Buffer.alloc(0));

  if (options.signal?.aborted) {
    const now = new Date().toISOString();
    const result = failureResult(
      request,
      {
        spawned: false,
        pid: null,
        started_at: now,
        finished_at: now,
        duration_ms: 0,
        events_path: eventsPath,
        stderr_path: stderrPath,
        cli_version: cliVersion,
      },
      null,
      "failed",
      "confirmed_not_started",
      "The CLI process was interrupted before it started.",
    );
    writeExclusive(join(dirname(outputPath), "result.json"), Buffer.from(canonicalJson(result), "utf8"));
    return result;
  }

  const args = [
    ...prefixArgs,
    "exec",
    "--ignore-user-config",
    "--strict-config",
    "-c",
    'model_reasoning_effort="medium"',
    "--model",
    cliBehaviorOptions.model,
    "--sandbox",
    cliBehaviorOptions.sandbox,
    "--ephemeral",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--cd",
    inputPath,
    "--output-schema",
    preparedUnit.invocation.output_schema_path,
    "--output-last-message",
    lastMessagePath,
    "--json",
    "-",
  ];
  const stdinBytes = readFileSync(preparedUnit.invocation.stdin_path);
  const startedAt = new Date();
  const outcome = await spawnReader({
    args,
    eventsPath,
    executable,
    inputPath,
    stderrPath,
    stdinBytes,
    timeoutMs,
    terminationGraceMs,
    hardKillGraceMs,
    signal: options.signal,
  });
  const finishedAt = new Date();
  const metadata = {
    spawned: outcome.spawned,
    pid: outcome.pid,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    events_path: eventsPath,
    stderr_path: stderrPath,
    cli_version: cliVersion,
  };

  let result;
  if (!outcome.spawned) {
    result = failureResult(request, metadata, null, "failed", "confirmed_not_started", "The CLI process did not start.");
  } else if (outcome.terminationReason || outcome.errored || outcome.exitCode === null) {
    result = failureResult(
      request,
      metadata,
      null,
      "outcome_unknown",
      "process_outcome_unknown",
      processOutcomeUnknownMessage(outcome.terminationReason),
    );
  } else if (outcome.exitCode !== 0) {
    result = failureResult(request, metadata, outcome.exitCode, "failed", "terminal_process_failure", "The CLI process exited unsuccessfully.");
  } else {
    try {
      const returnedBytes = readFileSync(lastMessagePath);
      const returned = parseModelOutput(returnedBytes);
      const locator = preparedUnit.source_locator;
      const observation = {
        schema_version: 1,
        artifact_type:
          preparedUnit.logical_unit_key.source_role === "candidate"
            ? "candidate_observation"
            : "baseline_observation",
        workspace_id: locator.workspace_id,
        skill: preparedUnit.logical_unit_key.skill,
        suite: preparedUnit.logical_unit_key.suite,
        case_id: preparedUnit.logical_unit_key.case_id,
        variant_id: locator.variant_id,
        execution_context_hash: locator.execution_context_hash,
        execution_status: "completed",
        execution_reason: null,
        raw_response: returned.raw_response,
        observed_access: returned.observed_access,
      };
      assertObservation(observation, {
        workspaceId: locator.workspace_id,
        skill: preparedUnit.logical_unit_key.skill,
        role: preparedUnit.logical_unit_key.source_role,
        executionContextHash: locator.execution_context_hash,
      });
      const acceptedBytes = Buffer.from(canonicalJson(observation), "utf8");
      const acceptedPath = join(outputPath, "accepted-observation.json");
      writeExclusive(acceptedPath, acceptedBytes);
      result = {
        schema_version: 1,
        unit_id: preparedUnit.unit_id,
        attempt_id: request.attempt_id,
        terminal_status: "succeeded",
        exit_code: 0,
        structured_output_path: acceptedPath,
        structured_output_sha256: sha256Bytes(acceptedBytes),
        process_metadata: metadata,
        failure: null,
      };
    } catch {
      result = failureResult(request, metadata, 0, "failed", "invalid_structured_output", "The CLI process returned invalid structured reader output.");
    }
  }
  writeExclusive(join(dirname(outputPath), "result.json"), Buffer.from(canonicalJson(result), "utf8"));
  return result;
}

export async function runBoundedPool(requests, concurrency, worker) {
  const results = new Array(requests.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, requests.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= requests.length) return;
        results[index] = await worker(requests[index]);
      }
    }),
  );
  return results;
}

export function createCommandSummary({
  executionId,
  workspaceId,
  requestedConcurrency,
  effectiveConcurrency,
  preparedUnits,
  results,
}) {
  const counts = { succeeded: 0, failed: 0, outcome_unknown: 0 };
  for (const result of results) counts[result.terminal_status] += 1;
  return {
    schema_version: 1,
    command: "execute-prepared",
    status:
      counts.outcome_unknown > 0
        ? "outcome_unknown"
        : counts.failed > 0
          ? "partial_failure"
          : "succeeded",
    execution_id: executionId,
    workspace_id: workspaceId,
    requested_concurrency: requestedConcurrency,
    effective_concurrency: effectiveConcurrency,
    selected_unit_ids: preparedUnits.map((unit) => unit.unit_id),
    counts,
    results,
  };
}

function validateSelectedSource({
  workspacePath,
  manifest,
  selector,
  selectedCase,
  variantId,
}) {
  const variantRoot = `executor/${variantId}`;
  const bundleManifestPath = `${variantRoot}/bundle-manifest.json`;
  const bundleManifestBytes = readArtifactBytes(
    workspacePath,
    bundleManifestPath,
    "bundle manifest",
  );
  const bundleValue = parseStrictJson(bundleManifestBytes, "bundle_manifest");
  assertCanonicalBytes(bundleManifestBytes, bundleValue, "bundle_manifest");
  const bundle = assertBundleManifest(bundleValue, {
    workspaceId: manifest.workspace_id,
    skill: manifest.skill,
  });
  if (
    bundle.variant_id !== variantId ||
    sha256Canonical(bundle.files) !== manifest.sources[selector.sourceRole].bundle_hash
  ) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "Bundle manifest does not match its selected semantic source role.",
      3,
    );
  }
  const bundleFiles = [];
  const skillPrefix = `.agents/skills/${manifest.skill}/`;
  for (const entry of bundle.files) {
    if (entry.present === false) continue;
    if (!entry.path.startsWith(skillPrefix)) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        "Bundle manifest contains a path outside the selected skill.",
        3,
      );
    }
    const relativePath = entry.path.slice(skillPrefix.length);
    const sourcePath = `${variantRoot}/bundle/${relativePath}`;
    const bytes = readArtifactBytes(workspacePath, sourcePath, "bundle file");
    assertEntryBytes(entry, bytes, "bundle file");
    bundleFiles.push({ bytes, relativePath: `bundle/${relativePath}`, sourcePath });
  }
  if (!bundleFiles.some((file) => file.relativePath === "bundle/SKILL.md")) {
    throw new ArtifactError("SKILL_BUNDLE_INVALID", "Selected bundle is missing SKILL.md.", 3);
  }

  const caseRoot = `${variantRoot}/cases/${selector.suite}/${selector.caseId}`;
  const contextManifestPath = `${caseRoot}/execution-context-manifest.json`;
  const contextManifestBytes = readArtifactBytes(
    workspacePath,
    contextManifestPath,
    "execution context manifest",
  );
  const contextValue = parseStrictJson(
    contextManifestBytes,
    "execution_context_manifest",
  );
  assertCanonicalBytes(
    contextManifestBytes,
    contextValue,
    "execution_context_manifest",
  );
  const context = assertExecutionContextManifest(contextValue, {
    workspaceId: manifest.workspace_id,
    skill: manifest.skill,
  });
  if (
    context.variant_id !== variantId ||
    context.suite !== selector.suite ||
    context.case_id !== selector.caseId
  ) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "Execution context manifest identity does not match the selected case.",
      3,
    );
  }
  if (
    canonicalJson(context.requested_execution_policy) !==
    canonicalJson(selectedCase.executor_input.execution_policy)
  ) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "Prepared execution policy does not match the selected suite case.",
      3,
    );
  }
  const promptPath = `${caseRoot}/prompt.txt`;
  const promptBytes = readArtifactBytes(workspacePath, promptPath, "case prompt");
  if (sha256Bytes(promptBytes) !== context.prompt_sha256) {
    throw new ArtifactError("INTEGRITY_MISMATCH", "Case prompt hash does not match.", 3);
  }
  const expectedPromptBytes = Buffer.from(`${selectedCase.executor_input.prompt}\n`, "utf8");
  if (!promptBytes.equals(expectedPromptBytes)) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "Prepared prompt bytes do not match the selected suite case.",
      3,
    );
  }
  const expectedContextPaths = selectedCase.executor_input.context
    .map((entry) => `context/${entry.context_id}.txt`)
    .sort(compareStrings);
  const actualContextPaths = context.context.map((entry) => entry.path);
  if (
    expectedContextPaths.length !== actualContextPaths.length ||
    expectedContextPaths.some((path, index) => path !== actualContextPaths[index])
  ) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "Prepared context membership does not match the selected suite case.",
      3,
    );
  }
  const controlFiles = new Map(manifest.control_plane.files.map((entry) => [entry.path, entry]));
  const contextFiles = context.context.map((entry) => {
    const sourcePath = `${caseRoot}/${entry.path}`;
    const bytes = readArtifactBytes(workspacePath, sourcePath, "case context file");
    assertEntryBytes(entry, bytes, "case context file");
    const contextId = entry.path.slice("context/".length, -".txt".length);
    const suiteContext = selectedCase.executor_input.context.find(
      (value) => value.context_id === contextId,
    );
    if (suiteContext.source_type === "inline_text") {
      if (!bytes.equals(Buffer.from(suiteContext.content, "utf8"))) {
        throw new ArtifactError(
          "ARTIFACT_RELATIONSHIP_INVALID",
          "Prepared inline context bytes do not match the selected suite case.",
          3,
        );
      }
    } else {
      const sourceEntry = controlFiles.get(suiteContext.path);
      if (!sourceEntry || sourceEntry.present === false || sourceEntry.sha256 !== entry.sha256) {
        throw new ArtifactError(
          "ARTIFACT_RELATIONSHIP_INVALID",
          "Prepared repository context does not match the selected control-plane source.",
          3,
        );
      }
    }
    return { bytes, relativePath: `case/${entry.path}`, sourcePath };
  });
  const identity = createReaderLogicalIdentity({
    skill: manifest.skill,
    sourceRole: selector.sourceRole,
    suite: selector.suite,
    caseId: selector.caseId,
  });
  const compiledInput = compileReaderInput({
    bundleFiles,
    caseId: selector.caseId,
    contextFiles,
    policy: context.requested_execution_policy,
    promptBytes,
    skill: manifest.skill,
    suite: selector.suite,
  });
  return {
    ...identity,
    bundleFiles,
    contextFiles,
    modelVisibleFiles: compiledInput.modelVisibleFiles,
    promptBytes,
    policy: context.requested_execution_policy,
    stdinBytes: compiledInput.stdinBytes,
    sourceLocator: {
      workspace_id: manifest.workspace_id,
      workspace_path: workspacePath,
      variant_id: variantId,
      bundle_manifest_path: bundleManifestPath,
      bundle_manifest_hash: bundle.aggregate_sha256,
      execution_context_manifest_path: contextManifestPath,
      execution_context_hash: context.execution_context_hash,
      prompt_path: promptPath,
      context_paths: contextFiles.map((file) => file.sourcePath),
    },
  };
}

function materializePreparedUnit(executionRoot, source) {
  const attemptRoot = join(
    executionRoot,
    "units",
    source.unitId,
    "attempts",
    "1",
  );
  const inputPath = join(attemptRoot, "input");
  mkdirExclusive(inputPath);
  for (const file of source.bundleFiles) {
    const path = join(inputPath, ...file.relativePath.split("/"));
    writeExclusive(path, file.bytes);
  }
  writeExclusive(join(inputPath, "case", "prompt.txt"), source.promptBytes);
  for (const file of source.contextFiles) {
    writeExclusive(join(inputPath, ...file.relativePath.split("/")), file.bytes);
  }
  const schemaBytes = Buffer.from(canonicalJson(readerOutputSchema), "utf8");
  const stdinPath = join(inputPath, "stdin.txt");
  const schemaPath = join(inputPath, "reader-output-schema.json");
  writeExclusive(stdinPath, source.stdinBytes);
  writeExclusive(schemaPath, schemaBytes);
  const behaviorProjection = {
    schema_version: 1,
    kind: "reader",
    stdin_sha256: sha256Bytes(source.stdinBytes),
    model_visible_files: source.modelVisibleFiles.map((entry) => ({ ...entry })),
    output_schema_sha256: sha256Bytes(schemaBytes),
    cli_behavior_options: { ...cliBehaviorOptions },
  };
  return {
    schema_version: 1,
    unit_id: source.unitId,
    logical_unit_key: source.logicalUnitKey,
    kind: "reader",
    dependencies: [],
    invocation: {
      stdin_path: stdinPath,
      output_schema_path: schemaPath,
      cwd: inputPath,
      cli_options: { ...cliBehaviorOptions },
    },
    behavior_projection: behaviorProjection,
    source_locator: source.sourceLocator,
  };
}

function compileReaderInput({ bundleFiles, caseId, contextFiles, policy, promptBytes, skill, suite }) {
  const embeddedBundleFiles = bundleFiles
    .map((file) => embeddedTextFile(file, "bundle file"))
    .sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  const embeddedContextFiles = contextFiles
    .map((file) => embeddedTextFile(file, "case context file"))
    .sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  const casePrompt = {
    relative_path: "case/prompt.txt",
    sha256: sha256Bytes(promptBytes),
    content_utf8: decodeTextPayload(promptBytes, "case prompt"),
  };
  const envelope = {
    schema_version: 1,
    kind: "fresh_reader_input",
    instruction: {
      task: "Apply the supplied skill bundle to the supplied case prompt and context under the requested execution policy.",
      resources: "Treat bundle/SKILL.md as the skill entrypoint and consult relevant bundled resources from bundle_files; all required content is already embedded in this input.",
      tool_use: "Follow requested_execution_policy.requested_access exactly. Do not invoke any tool or process to acquire package content because all required package content is already embedded.",
      identity: "Do not infer or state any hidden variant identity or mapping.",
      response: "Return exactly one JSON object matching the output schema enforced by the CLI, with no prose outside that object.",
    },
    identity: { skill, suite, case_id: caseId },
    requested_execution_policy: policy,
    bundle_files: embeddedBundleFiles,
    case_prompt: casePrompt,
    context_files: embeddedContextFiles,
  };
  const stdinBytes = Buffer.from(canonicalJson(envelope), "utf8");
  return {
    stdinBytes,
    modelVisibleFiles: [
      ...embeddedBundleFiles,
      casePrompt,
      ...embeddedContextFiles,
    ]
      .map(({ relative_path, sha256 }) => ({ relative_path, sha256 }))
      .sort((left, right) => compareStrings(left.relative_path, right.relative_path)),
  };
}

function embeddedTextFile(file, label) {
  return {
    relative_path: file.relativePath,
    sha256: sha256Bytes(file.bytes),
    content_utf8: decodeTextPayload(file.bytes, label),
  };
}

function decodeTextPayload(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new ArtifactError(
      "MODEL_INPUT_TEXT_INVALID",
      `${label} must be valid UTF-8 for stdin embedding.`,
      3,
    );
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new ArtifactError(
      "MODEL_INPUT_TEXT_INVALID",
      `${label} does not round-trip through UTF-8 unchanged.`,
      3,
    );
  }
  return text;
}

function parseModelOutput(bytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ArtifactError("MODEL_OUTPUT_INVALID", "Model output must be valid UTF-8 JSON.");
  }
  if (!isRecord(value) || !hasExactKeys(value, ["observed_access", "raw_response"])) {
    throw new ArtifactError("MODEL_OUTPUT_INVALID", "Model output shape is invalid.");
  }
  if (typeof value.raw_response !== "string") {
    throw new ArtifactError("MODEL_OUTPUT_INVALID", "raw_response must be a string.");
  }
  const access = value.observed_access;
  const accessKeys = [
    "basis",
    "credentials",
    "filesystem",
    "model_runtime",
    "mutation",
    "network",
    "process",
    "remote",
    "tools",
  ];
  if (!isRecord(access) || !hasExactKeys(access, accessKeys)) {
    throw new ArtifactError("MODEL_OUTPUT_INVALID", "observed_access shape is invalid.");
  }
  if (typeof access.basis !== "string" || access.basis.length === 0 || access.basis.trim() !== access.basis) {
    throw new ArtifactError("MODEL_OUTPUT_INVALID", "observed_access.basis is invalid.");
  }
  const allowed = new Set(["observed", "not_observed", "unknown"]);
  for (const key of accessKeys.filter((key) => key !== "basis")) {
    if (!allowed.has(access[key])) {
      throw new ArtifactError("MODEL_OUTPUT_INVALID", `observed_access.${key} is invalid.`);
    }
  }
  return value;
}

function spawnReader({
  args,
  eventsPath,
  executable,
  hardKillGraceMs,
  inputPath,
  signal,
  stderrPath,
  stdinBytes,
  terminationGraceMs,
  timeoutMs,
}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: inputPath,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let spawned = false;
    let errored = false;
    let settled = false;
    let terminationReason = null;
    let terminationTimer;
    let hardKillTimer;
    let timeoutTimer;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(terminationTimer);
      clearTimeout(hardKillTimer);
      signal?.removeEventListener("abort", abort);
      resolve({
        exitCode,
        pid: spawned ? child.pid ?? null : null,
        spawned,
        errored,
        terminationReason,
      });
    };
    const terminateSpawnedChild = () => {
      if (settled || !spawned || terminationTimer || hardKillTimer) return;
      try {
        child.kill("SIGTERM");
      } catch {}
      terminationTimer = setTimeout(() => {
        if (settled) return;
        try {
          child.kill("SIGKILL");
        } catch {}
        hardKillTimer = setTimeout(() => {
          child.stdin.destroy();
          child.stdout.destroy();
          child.stderr.destroy();
          child.unref();
          finish(null);
        }, hardKillGraceMs);
      }, terminationGraceMs);
    };
    const requestTermination = (reason) => {
      if (settled || terminationReason) return;
      terminationReason = reason;
      terminateSpawnedChild();
    };
    const abort = () => requestTermination("interrupted");
    child.once("spawn", () => {
      spawned = true;
      if (terminationReason || signal?.aborted) {
        if (!terminationReason) terminationReason = "interrupted";
        terminateSpawnedChild();
        return;
      }
      child.stdin.end(stdinBytes);
    });
    child.stdin.on("error", () => {});
    child.stdout.on("data", (chunk) => appendBytes(eventsPath, chunk));
    child.stderr.on("data", (chunk) => appendBytes(stderrPath, chunk));
    child.once("error", () => {
      errored = true;
      if (!spawned) {
        finish(null);
        return;
      }
      if (!terminationReason) terminationReason = "process_error";
      terminateSpawnedChild();
    });
    child.once("close", (code) => finish(Number.isInteger(code) ? code : null));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    timeoutTimer = setTimeout(() => {
      if (settled) return;
      requestTermination("timeout");
    }, timeoutMs);
  });
}

function processOutcomeUnknownMessage(reason) {
  if (reason === "timeout") {
    return "The spawned CLI process exceeded its timeout; provider-call outcome is unknown.";
  }
  if (reason === "interrupted") {
    return "The spawned CLI process was interrupted; provider-call outcome is unknown.";
  }
  return "The spawned CLI process ended without a trustworthy terminal outcome; provider-call outcome is unknown.";
}

function runCapturedProcess(executable, args) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let spawned = false;
    let stdout = "";
    let stderr = "";
    let settled = false;
    child.once("spawn", () => {
      spawned = true;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, spawned, stderr, stdout });
    };
    child.once("error", () => finish(null));
    child.once("close", (code) => finish(Number.isInteger(code) ? code : null));
  });
}

function failureResult(request, metadata, exitCode, terminalStatus, code, message) {
  return {
    schema_version: 1,
    unit_id: request.prepared_unit.unit_id,
    attempt_id: request.attempt_id,
    terminal_status: terminalStatus,
    exit_code: exitCode,
    structured_output_path: null,
    structured_output_sha256: null,
    process_metadata: metadata,
    failure: { code, message },
  };
}

function accessStatusSchema() {
  return { enum: ["observed", "not_observed", "unknown"] };
}

function assertCanonicalBytes(bytes, value, label) {
  if (!bytes.equals(Buffer.from(canonicalJson(value), "utf8"))) {
    throw new ArtifactError("ARTIFACT_CANONICAL_INVALID", `${label} must use canonical JSON.`, 3);
  }
}

function assertEntryBytes(entry, bytes, label) {
  if (bytes.length !== entry.byte_count || sha256Bytes(bytes) !== entry.sha256) {
    throw new ArtifactError("INTEGRITY_MISMATCH", `${label} hash does not match.`, 3);
  }
}

function mkdirExclusive(path) {
  try {
    mkdirSync(path, { recursive: false });
  } catch {
    if (existsSync(path)) {
      throw new ArtifactError("EXECUTION_OVERWRITE_REFUSED", "Execution destination already exists.", 3);
    }
    mkdirSync(dirname(path), { recursive: true });
    try {
      mkdirSync(path, { recursive: false });
    } catch {
      throw new ArtifactError("EXECUTION_OVERWRITE_REFUSED", "Execution destination could not be created exclusively.", 3);
    }
  }
}

function writeExclusive(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(path, "wx");
    writeFileSync(descriptor, bytes);
  } catch (error) {
    throw new ArtifactError("EXECUTION_OVERWRITE_REFUSED", `Refused to overwrite '${path}'.`, 3);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function appendBytes(path, bytes) {
  writeFileSync(path, bytes, { flag: "a" });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...expectedKeys].sort(compareStrings);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasHelpToken(text, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s,])${escaped}(?=[\\s,]|$)`, "m").test(text);
}

export function parseUnitSelector(value) {
  if (typeof value !== "string") return null;
  const parts = value.split(":");
  if (parts.length !== 3) return null;
  const [sourceRole, suite, caseId] = parts;
  if (
    !["candidate", "baseline"].includes(sourceRole) ||
    !suiteNames.includes(suite) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caseId)
  ) {
    return null;
  }
  return { sourceRole, suite, caseId, raw: value };
}
