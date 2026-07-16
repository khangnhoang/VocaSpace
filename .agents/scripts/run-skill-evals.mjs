import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
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

Validates committed repo-local skill suite definitions under .agents/evals.
PR 3A does not implement prepare, report, model execution, or repository mutation.`);
    return;
  }

  const command = parseCommand(args);
  if (!command) return;

  try {
    const result = validateRepository(process.cwd(), command);
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
    console.log(
      JSON.stringify(
        {
          schema_version: suiteSchemaVersion,
          artifact_type: "validation_result",
          tool: toolName,
          command: "validate",
          status: "operational_error",
          scope: command.scope,
          summary: {
            configured_skills: 0,
            suite_files: 0,
            cases: 0,
            errors: 1,
            warnings: 0,
          },
          diagnostics: [
            {
              severity: "error",
              code: operationalError.code,
              message: operationalError.message,
            },
          ],
        },
        null,
        2,
      ),
    );
    process.exitCode = 3;
  }
}

function parseCommand(args) {
  if (args[0] !== "validate") {
    console.error(`Unsupported command: ${args[0] ?? "<missing>"}`);
    process.exitCode = 2;
    return undefined;
  }

  if (args.length === 2 && args[1] === "--all") {
    return { scope: { mode: "all" } };
  }

  if (args.length === 3 && args[1] === "--skill" && isSkillName(args[2])) {
    return { scope: { mode: "skill", skill: args[2] } };
  }

  console.error("Usage: run-skill-evals.mjs validate (--all | --skill <kebab-case-skill>)");
  process.exitCode = 2;
  return undefined;
}

function validateRepository(repoRoot, command) {
  const state = createValidationState(command.scope);
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

  if (!isSkillName(skill) || !skillCoreExists(repoRoot, skill)) {
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

  assertSuiteContextPathsSafe(value, suitePath);

  if (Array.isArray(value?.cases)) state.summary.cases += value.cases.length;
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
