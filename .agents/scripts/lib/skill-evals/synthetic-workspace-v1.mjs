import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ArtifactError,
  artifactSchemaVersion,
  canonicalJson,
  manifestEntry,
  sha256Bytes,
  sha256Canonical,
  suiteOrder,
} from "./artifact-schema-v1.mjs";
import { isSafeRepositoryPath } from "./suite-schema-v1.mjs";

const fixedRootSegments = ["vocaspace-agent-skill-evals", "v1"];
const skillRoot = ".agents/skills";
const evalRoot = ".agents/evals";
const workspaceIdPattern = /^ws-[a-f0-9]{32}$/;

export function prepareSyntheticWorkspace(repoRoot, options, suites) {
  assertExactGitRoot(repoRoot);
  const headCommit = resolveCommit(repoRoot, "HEAD");
  const contextPaths = collectRepositoryContextPaths(suites);
  const controlPaths = [
    ...suiteOrder.map((suite) => `${evalRoot}/${options.skill}/${suite}.json`),
    ...contextPaths,
  ].sort(compareStrings);

  const controlPlane = snapshotCurrentPaths(repoRoot, controlPaths, {
    ignoredRoots: [`${evalRoot}/${options.skill}`],
    explicitIgnored: new Set(contextPaths),
  });
  const candidate =
    options.candidate.kind === "current_tree"
      ? snapshotCurrentBundle(
          repoRoot,
          options.skill,
          headCommit,
          new Set(
            contextPaths.filter((path) =>
              path.startsWith(`${skillRoot}/${options.skill}/`),
            ),
          ),
        )
      : snapshotRefBundle(
          repoRoot,
          options.skill,
          options.candidate.ref,
          resolveCommit(repoRoot, options.candidate.ref),
        );
  const baseline =
    options.baseline === null
      ? null
      : snapshotRefBundle(
          repoRoot,
          options.skill,
          options.baseline,
          resolveCommit(repoRoot, options.baseline),
        );

  const roles = baseline ? ["baseline", "candidate"] : ["candidate"];
  const variantMapping = assignVariants(candidate, baseline);
  const workspaceId = `ws-${randomUUID().replaceAll("-", "")}`;
  const workspaceInputHash = sha256Canonical({
    control_plane_hash: controlPlane.aggregate_sha256,
    control_plane_resolved_commit: headCommit,
    control_plane_working_tree_state: controlPlane.working_tree_state,
    mode: baseline ? "comparison" : "candidate_only",
    skill: options.skill,
    sources: Object.fromEntries(
      roles.map((role) => {
        const source = role === "candidate" ? candidate : baseline;
        return [
          role,
          {
            bundle_hash: source.bundle_hash,
            requested_ref: source.requested_ref,
            resolved_commit: source.resolved_commit,
            selector: source.selector,
          },
        ];
      }),
    ),
    variant_mapping: variantMapping,
  });

  const workspacePath = createWorkspace(workspaceId);
  const inventory = [];
  try {
    writeEvaluatorSuites(workspacePath, suites, inventory);
    for (const variantId of Object.keys(variantMapping).sort(compareStrings)) {
      const role = variantMapping[variantId];
      const source = role === "candidate" ? candidate : baseline;
      writeExecutorVariant(
        workspacePath,
        workspaceId,
        options.skill,
        variantId,
        source,
        suites,
        repoRoot,
        inventory,
      );
    }
    mkdirSafe(join(workspacePath, "evaluator", "observations", "candidate"));
    if (baseline) mkdirSafe(join(workspacePath, "evaluator", "observations", "baseline"));
    mkdirSafe(join(workspacePath, "evaluator", "human-evaluations"));
    mkdirSafe(join(workspacePath, "report"));

    const sources = {
      candidate: sourceProvenance(candidate),
      ...(baseline ? { baseline: sourceProvenance(baseline) } : {}),
    };
    const manifest = {
      schema_version: artifactSchemaVersion,
      artifact_type: "workspace_manifest",
      workspace_id: workspaceId,
      skill: options.skill,
      mode: baseline ? "comparison" : "candidate_only",
      source_roles: roles,
      variant_mapping: variantMapping,
      control_plane: {
        aggregate_sha256: controlPlane.aggregate_sha256,
        files: controlPlane.entries,
        resolved_commit: headCommit,
        working_tree_state: controlPlane.working_tree_state,
      },
      sources,
      workspace_input_hash: workspaceInputHash,
      artifact_inventory: inventory.sort(compareEntries),
    };
    writeCanonical(join(workspacePath, "workspace-manifest.json"), manifest);
    assertSourceFingerprintsStable(
      repoRoot,
      candidate,
      controlPlane,
      options.skill,
      controlPaths,
      headCommit,
    );

    return {
      schema_version: artifactSchemaVersion,
      artifact_type: "prepare_result",
      command: "prepare",
      status: "prepared",
      workspace_id: workspaceId,
      mode: manifest.mode,
      skill: options.skill,
      variants: Object.keys(variantMapping).sort(compareStrings),
      workspace_input_hash: workspaceInputHash,
      artifact_summary: {
        executor_variants: Object.keys(variantMapping).length,
        cases: suiteOrder.reduce((count, suite) => count + suites[suite].cases.length, 0),
        files: inventory.length + 1,
      },
      claim_boundaries: [
        "synthetic packaging is not enforced isolation",
        "the runner did not execute or grade a model",
      ],
    };
  } catch (error) {
    try {
      writeCanonical(join(workspacePath, "incomplete-workspace.json"), {
        schema_version: artifactSchemaVersion,
        artifact_type: "incomplete_workspace",
        workspace_id: workspaceId,
        status: "refuse_reuse",
      });
    } catch {
      // The original error remains authoritative when even the failure marker cannot be written.
    }
    throw error;
  }
}

export function fixedWorkspaceRoot() {
  return join(tmpdir(), ...fixedRootSegments);
}

export function resolveWorkspace(workspaceId) {
  if (!workspaceIdPattern.test(workspaceId)) {
    throw new ArtifactError(
      "WORKSPACE_ID_INVALID",
      "workspace-id must be an opaque runner-generated identifier.",
      2,
    );
  }
  const root = fixedWorkspaceRoot();
  assertExistingPathSafe(root, "runner temporary root", { directory: true });
  const workspace = resolve(root, workspaceId);
  if (!isContained(root, workspace)) {
    throw new ArtifactError("WORKSPACE_PATH_REFUSED", "Workspace resolution escaped the fixed root.", 3);
  }
  assertExistingPathSafe(workspace, "workspace", { directory: true });
  assertPathComponentsSafe(root, workspace);
  if (existsSync(join(workspace, "incomplete-workspace.json"))) {
    throw new ArtifactError(
      "WORKSPACE_INCOMPLETE",
      "Workspace creation did not complete and the workspace cannot be reused.",
      3,
    );
  }
  return workspace;
}

export function readArtifactBytes(workspacePath, relativePath, label) {
  const path = resolveWorkspacePath(workspacePath, relativePath);
  assertExistingPathSafe(path, label, { file: true });
  return readFileSync(path);
}

export function optionalArtifactBytes(workspacePath, relativePath, label) {
  const path = resolveWorkspacePath(workspacePath, relativePath);
  if (!existsSync(path)) return undefined;
  assertExistingPathSafe(path, label, { file: true });
  return readFileSync(path);
}

export function resolveWorkspacePath(workspacePath, relativePath) {
  if (!isNormalizedRelativePath(relativePath)) {
    throw new ArtifactError("WORKSPACE_PATH_REFUSED", "Artifact path is not normalized.", 3);
  }
  const target = resolve(workspacePath, relativePath.replaceAll("/", sep));
  if (!isContained(workspacePath, target)) {
    throw new ArtifactError("WORKSPACE_PATH_REFUSED", "Artifact path escaped the workspace.", 3);
  }
  assertPathComponentsSafe(workspacePath, target, { allowMissingLeaf: true });
  return target;
}

export function writeCompleteReport(workspacePath, bytes) {
  const target = resolveWorkspacePath(workspacePath, "report/generated-report.json");
  if (existsSync(target)) {
    const existing = readFileSync(target);
    if (existing.equals(bytes)) return false;
    throw new ArtifactError(
      "REPORT_OVERWRITE_REFUSED",
      "A different complete generated report already exists.",
      3,
    );
  }
  writeExclusive(target, bytes);
  return true;
}

export function listWorkspaceFiles(workspacePath, relativeRoot) {
  const root = resolveWorkspacePath(workspacePath, relativeRoot);
  assertExistingPathSafe(root, relativeRoot, { directory: true });
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      compareStrings(left.name, right.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new ArtifactError(
          "PATH_REPARSE_POINT",
          "Workspace enumeration refused a link or reparse point.",
          3,
        );
      }
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(normalizeRelative(relative(workspacePath, path)));
      else {
        throw new ArtifactError("PATH_TYPE_REFUSED", "Workspace contains an unsupported entry.", 3);
      }
    }
  };
  visit(root);
  return files.sort(compareStrings);
}

function writeExecutorVariant(
  workspacePath,
  workspaceId,
  skill,
  variantId,
  source,
  suites,
  repoRoot,
  inventory,
) {
  const variantRoot = join(workspacePath, "executor", variantId);
  const bundleRoot = join(variantRoot, "bundle");
  mkdirSafe(bundleRoot);
  for (const file of source.presentFiles) {
    const relativeBundlePath = file.path.slice(`${skillRoot}/${skill}/`.length);
    const output = join(bundleRoot, ...relativeBundlePath.split("/"));
    writeExclusive(output, file.bytes);
    inventory.push(inventoryEntry(workspacePath, output, file.bytes));
  }
  const bundleEnvelope = {
    schema_version: artifactSchemaVersion,
    artifact_type: "bundle_manifest",
    workspace_id: workspaceId,
    skill,
    variant_id: variantId,
    files: source.entries,
  };
  const bundleManifest = {
    ...bundleEnvelope,
    aggregate_sha256: sha256Canonical(bundleEnvelope),
  };
  const bundleManifestPath = join(variantRoot, "bundle-manifest.json");
  const bundleManifestBytes = writeCanonical(bundleManifestPath, bundleManifest);
  inventory.push(inventoryEntry(workspacePath, bundleManifestPath, bundleManifestBytes));

  for (const suite of suiteOrder) {
    for (const caseValue of suites[suite].cases) {
      const caseRoot = join(variantRoot, "cases", suite, caseValue.case_id);
      mkdirSafe(caseRoot);
      const promptBytes = Buffer.from(`${caseValue.executor_input.prompt}\n`, "utf8");
      const promptPath = join(caseRoot, "prompt.txt");
      writeExclusive(promptPath, promptBytes);
      inventory.push(inventoryEntry(workspacePath, promptPath, promptBytes));

      const contextEntries = [];
      for (const context of caseValue.executor_input.context) {
        const bytes =
          context.source_type === "inline_text"
            ? Buffer.from(context.content, "utf8")
            : readSafeCurrentFile(repoRoot, context.path);
        const relativeContextPath = `context/${context.context_id}.txt`;
        const contextPath = join(caseRoot, "context", `${context.context_id}.txt`);
        writeExclusive(contextPath, bytes);
        inventory.push(inventoryEntry(workspacePath, contextPath, bytes));
        contextEntries.push(manifestEntry(relativeContextPath, bytes));
      }
      contextEntries.sort(compareEntries);
      const contextEnvelope = {
        schema_version: artifactSchemaVersion,
        artifact_type: "execution_context_manifest",
        workspace_id: workspaceId,
        skill,
        suite,
        case_id: caseValue.case_id,
        variant_id: variantId,
        prompt_sha256: sha256Bytes(promptBytes),
        context: contextEntries,
        requested_execution_policy: caseValue.executor_input.execution_policy,
      };
      const contextManifest = {
        ...contextEnvelope,
        execution_context_hash: sha256Canonical(contextEnvelope),
      };
      const contextManifestPath = join(caseRoot, "execution-context-manifest.json");
      const contextManifestBytes = writeCanonical(contextManifestPath, contextManifest);
      inventory.push(inventoryEntry(workspacePath, contextManifestPath, contextManifestBytes));
      const template = {
        schema_version: artifactSchemaVersion,
        artifact_type: "observation_template",
        workspace_id: workspaceId,
        skill,
        suite,
        case_id: caseValue.case_id,
        variant_id: variantId,
        execution_context_hash: contextManifest.execution_context_hash,
        instructions:
          "Record raw executor output and observed access without adding semantic judgment.",
      };
      const templatePath = join(caseRoot, "observation-template.json");
      const templateBytes = writeCanonical(templatePath, template);
      inventory.push(inventoryEntry(workspacePath, templatePath, templateBytes));
    }
  }
}

function writeEvaluatorSuites(workspacePath, suites, inventory) {
  for (const suite of suiteOrder) {
    const path = join(workspacePath, "evaluator", "suite-definitions", `${suite}.json`);
    const bytes = writeCanonical(path, suites[suite]);
    inventory.push(inventoryEntry(workspacePath, path, bytes));
  }
}

function snapshotCurrentBundle(repoRoot, skill, headCommit, explicitIgnored = new Set()) {
  const prefix = `${skillRoot}/${skill}`;
  const snapshot = snapshotCurrentPaths(repoRoot, [prefix], {
    ignoredRoots: [prefix],
    explicitIgnored,
  });
  const entries = snapshot.entries.filter((entry) => entry.path.startsWith(`${prefix}/`));
  const presentFiles = snapshot.files.filter((file) => file.path.startsWith(`${prefix}/`));
  if (!entries.some((entry) => entry.path === `${prefix}/SKILL.md` && entry.present !== false)) {
    throw new ArtifactError("SKILL_BUNDLE_INVALID", "Candidate skill bundle is missing SKILL.md.");
  }
  return {
    selector: "current_tree",
    requested_ref: null,
    resolved_commit: headCommit,
    working_tree_state: snapshot.working_tree_state,
    entries,
    presentFiles,
    bundle_hash: sha256Canonical(entries),
    fingerprint: sha256Canonical(entries),
  };
}

function snapshotCurrentPaths(repoRoot, pathspecs, options) {
  const tracked = gitPathList(repoRoot, ["ls-files", "-z", "--", ...pathspecs]);
  const untracked = gitPathList(repoRoot, [
    "ls-files",
    "-z",
    "--others",
    "--exclude-standard",
    "--",
    ...pathspecs,
  ]);
  const ignored = gitPathList(repoRoot, [
    "ls-files",
    "-z",
    "--others",
    "-i",
    "--exclude-standard",
    "--",
    ...options.ignoredRoots,
  ]);
  for (const path of new Set([...tracked, ...untracked, ...ignored])) {
    assertSafeSourcePath(path);
  }
  for (const path of ignored) {
    if (!options.explicitIgnored.has(path)) {
      throw new ArtifactError(
        "IGNORED_INPUT_REFUSED",
        `Ignored file '${path}' under a relevant root is not explicitly referenced.`,
        3,
      );
    }
  }
  const ignoredExplicit = [...options.explicitIgnored].filter((path) =>
    gitPathList(repoRoot, [
      "ls-files",
      "-z",
      "--others",
      "-i",
      "--exclude-standard",
      "--",
      path,
    ]).includes(path),
  );
  const statusByPath = new Map([
    ...tracked.map((path) => [path, "tracked"]),
    ...untracked.map((path) => [path, "untracked"]),
    ...ignoredExplicit.map((path) => [path, "ignored_explicit"]),
  ]);
  const porcelain = runGit(repoRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--no-renames",
    "--",
    ...pathspecs,
  ]);
  const gitStatusByPath = parsePorcelainStatus(porcelain.stdout);
  for (const path of ignoredExplicit) gitStatusByPath.set(path, "!!");
  const files = [];
  const entries = [];
  for (const path of [...statusByPath.keys()].sort(compareStrings)) {
    const absolute = resolve(repoRoot, ...path.split("/"));
    if (!existsSync(absolute)) {
      entries.push({
        path,
        present: false,
        status: "deleted",
        git_status: gitStatusByPath.get(path) ?? " D",
      });
      continue;
    }
    const bytes = readSafeCurrentFile(repoRoot, path);
    files.push({ path, bytes });
    entries.push(
      manifestEntry(path, bytes, {
        status: statusByPath.get(path),
        git_status: gitStatusByPath.get(path) ?? null,
      }),
    );
  }
  entries.sort(compareEntries);
  return {
    entries,
    files,
    aggregate_sha256: sha256Canonical(entries),
    working_tree_state:
      porcelain.stdout.length > 0 || ignoredExplicit.length > 0 ? "dirty" : "clean",
  };
}

function snapshotRefBundle(repoRoot, skill, requestedRef, commit) {
  const prefix = `${skillRoot}/${skill}`;
  const result = runGit(repoRoot, ["ls-tree", "-r", "-z", "--full-tree", commit, "--", prefix]);
  const records = splitNull(result.stdout).filter(Boolean);
  const files = [];
  for (const record of records) {
    const tab = record.indexOf("\t");
    const [mode, type] = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    assertSafeSourcePath(path);
    if (type !== "blob" || !["100644", "100755"].includes(mode)) {
      throw new ArtifactError(
        "GIT_TREE_ENTRY_REFUSED",
        `Ref-selected skill bundle contains unsupported entry '${path}'.`,
        3,
      );
    }
    const bytes = runGit(repoRoot, ["show", `${commit}:${path}`], { binary: true }).stdout;
    files.push({ path, bytes });
  }
  files.sort((left, right) => compareStrings(left.path, right.path));
  if (!files.some((file) => file.path === `${prefix}/SKILL.md`)) {
    throw new ArtifactError("SKILL_BUNDLE_INVALID", "Ref-selected skill bundle is missing SKILL.md.");
  }
  const entries = files.map((file) =>
    manifestEntry(file.path, file.bytes, { status: "tracked", git_status: null }),
  );
  return {
    selector: "ref",
    requested_ref: requestedRef,
    resolved_commit: commit,
    working_tree_state: "not_applicable",
    entries,
    presentFiles: files,
    bundle_hash: sha256Canonical(entries),
    fingerprint: sha256Canonical(entries),
  };
}

function sourceProvenance(source) {
  return {
    selector: source.selector,
    requested_ref: source.requested_ref,
    resolved_commit: source.resolved_commit,
    working_tree_state: source.working_tree_state,
    bundle_hash: source.bundle_hash,
    files: source.entries,
  };
}

function assignVariants(candidate, baseline) {
  if (!baseline) return { A: "candidate" };
  const ordered = [
    { role: "candidate", hash: candidate.bundle_hash },
    { role: "baseline", hash: baseline.bundle_hash },
  ].sort((left, right) => compareStrings(left.hash, right.hash) || compareStrings(left.role, right.role));
  return { A: ordered[0].role, B: ordered[1].role };
}

function assertSourceFingerprintsStable(
  repoRoot,
  candidate,
  controlPlane,
  skill,
  controlPaths,
  headCommit,
) {
  if (resolveCommit(repoRoot, "HEAD") !== headCommit) {
    throw new ArtifactError("SOURCE_CHANGED_DURING_SNAPSHOT", "Repository HEAD changed.", 3);
  }
  const controlAfter = snapshotCurrentPaths(repoRoot, controlPaths, {
    ignoredRoots: [`${evalRoot}/${skill}`],
    explicitIgnored: new Set(collectPathsWithStatus(controlPlane.entries, "ignored_explicit")),
  });
  if (controlAfter.aggregate_sha256 !== controlPlane.aggregate_sha256) {
    throw new ArtifactError("SOURCE_CHANGED_DURING_SNAPSHOT", "Control-plane inputs changed.", 3);
  }
  if (candidate.selector === "current_tree") {
    const explicitIgnored = new Set(collectPathsWithStatus(candidate.entries, "ignored_explicit"));
    const candidateAfter = snapshotCurrentBundle(
      repoRoot,
      skill,
      candidate.resolved_commit,
      explicitIgnored,
    );
    if (candidateAfter.fingerprint !== candidate.fingerprint) {
      throw new ArtifactError("SOURCE_CHANGED_DURING_SNAPSHOT", "Candidate inputs changed.", 3);
    }
  }
}

function collectRepositoryContextPaths(suites) {
  const paths = new Set();
  for (const suite of suiteOrder) {
    for (const caseValue of suites[suite].cases) {
      for (const context of caseValue.executor_input.context) {
        if (context.source_type === "repository_file") paths.add(context.path);
      }
    }
  }
  return [...paths].sort(compareStrings);
}

function collectPathsWithStatus(entries, status) {
  return entries.filter((entry) => entry.status === status).map((entry) => entry.path);
}

function resolveCommit(repoRoot, ref) {
  if (
    typeof ref !== "string" ||
    ref.length === 0 ||
    ref.length > 512 ||
    ref.startsWith("-") ||
    /[\u0000-\u001f\u007f]/.test(ref)
  ) {
    throw new ArtifactError("GIT_REF_INVALID", "Git ref is invalid.", 2);
  }
  const result = runGit(repoRoot, ["rev-parse", "--verify", `${ref}^{commit}`], {
    allowedFailure: true,
  });
  if (result.status !== 0) {
    throw new ArtifactError("GIT_REF_UNRESOLVED", `Git ref '${ref}' does not resolve to a commit.`, 3);
  }
  const commit = result.stdout.toString("utf8").trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) {
    throw new ArtifactError("GIT_REF_UNRESOLVED", "Git returned an invalid commit identity.", 3);
  }
  return commit;
}

function assertExactGitRoot(repoRoot) {
  const result = runGit(repoRoot, ["rev-parse", "--show-toplevel"], { allowedFailure: true });
  if (result.status !== 0) {
    throw new ArtifactError("GIT_ROOT_INVALID", "Current directory is not a Git worktree root.", 3);
  }
  const actual = normalizeComparablePath(result.stdout.toString("utf8").trim());
  const expected = normalizeComparablePath(realpathSync(repoRoot));
  if (actual !== expected) {
    throw new ArtifactError("GIT_ROOT_INVALID", "prepare must run from the exact Git worktree root.", 3);
  }
}

function createWorkspace(workspaceId) {
  const root = fixedWorkspaceRoot();
  ensureFixedRoot(root);
  const workspace = resolve(root, workspaceId);
  try {
    mkdirSync(workspace, { recursive: false });
  } catch (error) {
    throw new ArtifactError(
      "WORKSPACE_CREATE_REFUSED",
      `Unable to create a new workspace (${error.code ?? "unknown"}).`,
      3,
    );
  }
  assertPathComponentsSafe(root, workspace);
  return workspace;
}

function ensureFixedRoot(root) {
  const osRoot = tmpdir();
  assertExistingPathSafe(osRoot, "OS temporary root", { directory: true });
  let current = osRoot;
  for (const segment of fixedRootSegments) {
    current = join(current, segment);
    if (!existsSync(current)) mkdirSafe(current);
    assertExistingPathSafe(current, "runner temporary root", { directory: true });
  }
  if (normalizeComparablePath(current) !== normalizeComparablePath(root)) {
    throw new ArtifactError("WORKSPACE_PATH_REFUSED", "Fixed workspace root resolution failed.", 3);
  }
}

function readSafeCurrentFile(repoRoot, repositoryPath) {
  assertSafeSourcePath(repositoryPath);
  const absolute = resolve(repoRoot, ...repositoryPath.split("/"));
  if (!isContained(repoRoot, absolute)) {
    throw new ArtifactError("SOURCE_PATH_REFUSED", "Source path escaped the repository.", 3);
  }
  assertPathComponentsSafe(repoRoot, absolute);
  assertExistingPathSafe(absolute, repositoryPath, { file: true });
  return readFileSync(absolute);
}

function assertExistingPathSafe(path, label, expected) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new ArtifactError("PATH_UNAVAILABLE", `${label} is missing or unreadable.`, 3);
  }
  if (stat.isSymbolicLink()) {
    throw new ArtifactError("PATH_REPARSE_POINT", `${label} must not be a link or reparse point.`, 3);
  }
  if (expected.directory && !stat.isDirectory()) {
    throw new ArtifactError("PATH_TYPE_REFUSED", `${label} must be a directory.`, 3);
  }
  if (expected.file && !stat.isFile()) {
    throw new ArtifactError("PATH_TYPE_REFUSED", `${label} must be a regular file.`, 3);
  }
}

function assertPathComponentsSafe(parent, target, options = {}) {
  let current = parent;
  const parts = relative(parent, target).split(sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    if (options.allowMissingLeaf && index === parts.length - 1 && !existsSync(current)) return;
    if (!existsSync(current)) continue;
    assertExistingPathSafe(current, "workspace path component", {});
  }
}

function mkdirSafe(path) {
  mkdirSync(path, { recursive: true });
  assertExistingPathSafe(path, "created directory", { directory: true });
}

function writeCanonical(path, value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  writeExclusive(path, bytes);
  return bytes;
}

function writeExclusive(path, bytes) {
  mkdirSafe(dirname(path));
  try {
    writeFileSync(path, bytes, { flag: "wx" });
  } catch (error) {
    throw new ArtifactError(
      "ARTIFACT_OVERWRITE_REFUSED",
      `Refused to overwrite artifact '${basename(path)}' (${error.code ?? "unknown"}).`,
      3,
    );
  }
}

function inventoryEntry(workspacePath, absolutePath, bytes) {
  return manifestEntry(normalizeRelative(relative(workspacePath, absolutePath)), bytes);
}

function gitPathList(repoRoot, args) {
  return splitNull(runGit(repoRoot, args).stdout)
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"))
    .sort(compareStrings);
}

function runGit(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: options.binary ? null : "buffer",
    shell: false,
    windowsHide: true,
  });
  if (result.error) {
    throw new ArtifactError("GIT_OPERATION_FAILED", "Git could not be executed.", 3);
  }
  if (result.status !== 0 && !options.allowedFailure) {
    throw new ArtifactError("GIT_OPERATION_FAILED", "A required read-only Git operation failed.", 3);
  }
  return result;
}

function splitNull(buffer) {
  return buffer.toString("utf8").split("\0");
}

function parsePorcelainStatus(buffer) {
  const statuses = new Map();
  for (const record of splitNull(buffer).filter(Boolean)) {
    if (record.length < 4 || record[2] !== " ") {
      throw new ArtifactError("GIT_STATUS_INVALID", "Git returned malformed porcelain status.", 3);
    }
    statuses.set(record.slice(3).replaceAll("\\", "/"), record.slice(0, 2));
  }
  return statuses;
}

function normalizeRelative(path) {
  return path.split(sep).join("/");
}

function normalizeComparablePath(path) {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isContained(parent, child) {
  const fromParent = relative(parent, child);
  return (
    fromParent === "" ||
    (!fromParent.startsWith(`..${sep}`) && fromParent !== ".." && !isAbsolute(fromParent))
  );
}

function isNormalizedRelativePath(path) {
  return isSafeRepositoryPath(path);
}

function assertSafeSourcePath(path) {
  if (!isSafeRepositoryPath(path)) {
    throw new ArtifactError(
      "SOURCE_PATH_REFUSED",
      "Source path is not safe to materialize.",
      3,
    );
  }
}

function compareEntries(left, right) {
  return compareStrings(left.path, right.path);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
