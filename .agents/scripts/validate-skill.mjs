import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";

const schemaVersion = 1;
const toolName = "validate-skill";
const skillsRootPath = ".agents/skills";
const agentsPath = "AGENTS.md";
const coreLengthSignal = 500;
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const disallowedDescriptionStart = "-?:,[]{}#&*!|>'\"%@`";

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
    console.log(`Usage: node .agents/scripts/validate-skill.mjs [--help]

Validates repo-local skills under .agents/skills and explicit skill paths in AGENTS.md.
Validation output is JSON. The validator never modifies repository files.`);
    return;
  }

  if (args.length > 0) {
    console.error(`Unsupported argument: ${args[0]}`);
    process.exitCode = 2;
    return;
  }

  try {
    const result = validateRepository(process.cwd());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "valid" ? 0 : 1;
  } catch (error) {
    const operationalError =
      error instanceof OperationalError
        ? error
        : new OperationalError(
            "OPERATIONAL_FAILURE",
            "Validator could not read the required repository state.",
          );

    console.log(
      JSON.stringify(
        {
          schema_version: schemaVersion,
          tool: toolName,
          status: "operational_error",
          error: {
            code: operationalError.code,
            message: operationalError.message,
          },
        },
        null,
        2,
      ),
    );
    process.exitCode = 3;
  }
}

function validateRepository(repoRoot) {
  const diagnostics = [];
  const diagnosticKeys = new Set();
  const addDiagnostic = (diagnostic) => {
    const { identity, ...visibleDiagnostic } = diagnostic;
    const normalized = Object.fromEntries(
      Object.entries(visibleDiagnostic).filter(([, value]) => value !== undefined),
    );
    const key = [
      normalized.severity,
      normalized.code,
      normalized.skill ?? "",
      normalized.path ?? "",
      identity ?? normalized.message ?? "",
    ].join("\u0000");
    if (diagnosticKeys.has(key)) return;
    diagnosticKeys.add(key);
    diagnostics.push(normalized);
  };

  const absoluteSkillsRoot = resolve(repoRoot, skillsRootPath);
  const absoluteAgentsPath = resolve(repoRoot, agentsPath);
  assertRequiredDirectory(absoluteSkillsRoot, "SKILLS_ROOT_UNAVAILABLE", skillsRootPath);
  const agentsText = readRequiredText(
    absoluteAgentsPath,
    "AGENTS_FILE_UNAVAILABLE",
    agentsPath,
  );

  const entries = readDirectory(absoluteSkillsRoot, skillsRootPath);
  const skills = [];

  for (const entry of entries.sort(compareNames)) {
    const absoluteSkillDirectory = resolve(absoluteSkillsRoot, entry.name);
    const skillDirectoryPath = toRepoPath(repoRoot, absoluteSkillDirectory);

    if (entry.isSymbolicLink()) {
      addDiagnostic({
        severity: "error",
        code: "PATH_REPARSE_POINT",
        skill: entry.name,
        path: skillDirectoryPath,
        message: "Skill directories must not be symbolic links or junctions.",
      });
      continue;
    }

    if (!entry.isDirectory()) continue;

    const record = validateSkill({
      repoRoot,
      folderName: entry.name,
      absoluteSkillDirectory,
      addDiagnostic,
    });
    skills.push(record);
  }

  reportDuplicateNames(skills, addDiagnostic);
  validateExplicitRoutes({
    repoRoot,
    agentsText,
    skills,
    addDiagnostic,
  });

  diagnostics.sort(compareDiagnostics);
  const errors = diagnostics.filter((item) => item.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return {
    schema_version: schemaVersion,
    tool: toolName,
    status: errors === 0 ? "valid" : "invalid",
    summary: {
      skills: skills.length,
      errors,
      warnings,
    },
    diagnostics,
  };
}

function validateSkill({ repoRoot, folderName, absoluteSkillDirectory, addDiagnostic }) {
  const skillFile = resolve(absoluteSkillDirectory, "SKILL.md");
  const skillPath = toRepoPath(repoRoot, skillFile);
  const skillStat = optionalStat(skillFile, skillPath);
  const record = {
    folderName,
    metadataName: undefined,
    skillPath,
  };

  if (skillStat?.isSymbolicLink()) {
    addDiagnostic({
      severity: "error",
      code: "PATH_REPARSE_POINT",
      skill: folderName,
      path: skillPath,
      message: "SKILL.md must not be a symbolic link or junction.",
    });
    return record;
  }

  if (!skillStat || !skillStat.isFile()) {
    addDiagnostic({
      severity: "error",
      code: "SKILL_FILE_MISSING",
      skill: folderName,
      path: skillPath,
      message: "Each repo-local skill directory must contain a SKILL.md file.",
    });
    reportBundleStructure({
      repoRoot,
      folderName,
      absoluteSkillDirectory,
      routedResources: new Set(),
      addDiagnostic,
    });
    return record;
  }

  const source = readSkillSource(skillFile, skillPath, folderName, addDiagnostic);
  if (!source) return record;

  const lineCount = countLines(source.text);
  if (lineCount > coreLengthSignal) {
    addDiagnostic({
      severity: "warning",
      code: "CORE_LENGTH_SIGNAL",
      skill: folderName,
      path: skillPath,
      message: `SKILL.md has ${lineCount} lines; ${coreLengthSignal} lines is a non-blocking review signal.`,
    });
  }

  const metadata = parseFrontmatter(source.text, folderName, skillPath, addDiagnostic);
  if (metadata?.name) {
    record.metadataName = metadata.name;
    if (metadata.name !== folderName) {
      addDiagnostic({
        severity: "error",
        code: "SKILL_NAME_MISMATCH",
        skill: folderName,
        path: skillPath,
        message: `Frontmatter name '${metadata.name}' does not match folder '${folderName}'.`,
      });
    }
  }

  const routedResources = parseResourceRouting(
    source.text,
    folderName,
    skillPath,
    addDiagnostic,
  );
  const localLinks = parseLocalMarkdownLinks(source.text);

  for (const target of localLinks) {
    validateResourceTarget({
      repoRoot,
      folderName,
      absoluteSkillDirectory,
      target,
      skillPath,
      addDiagnostic,
    });
  }

  reportBundleStructure({
    repoRoot,
    folderName,
    absoluteSkillDirectory,
    routedResources,
    addDiagnostic,
  });

  return record;
}

function readSkillSource(skillFile, skillPath, folderName, addDiagnostic) {
  let bytes;
  try {
    bytes = readFileSync(skillFile);
  } catch {
    throw new OperationalError(
      "SKILL_FILE_UNREADABLE",
      `Unable to read required skill file ${skillPath}.`,
    );
  }

  if (bytes.length === 0 || bytes.at(-1) !== 0x0a) {
    addDiagnostic({
      severity: "error",
      code: "FINAL_NEWLINE_MISSING",
      skill: folderName,
      path: skillPath,
      message: "SKILL.md must end with a newline.",
    });
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    addDiagnostic({
      severity: "error",
      code: "FILE_ENCODING_INVALID",
      skill: folderName,
      path: skillPath,
      message: "SKILL.md must contain valid UTF-8.",
    });
    return undefined;
  }
}

function parseFrontmatter(text, folderName, skillPath, addDiagnostic) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    addFrontmatterUnsupported(folderName, skillPath, addDiagnostic);
    return undefined;
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    addFrontmatterUnsupported(folderName, skillPath, addDiagnostic);
    return undefined;
  }

  const fields = new Map();
  for (const line of lines.slice(1, closingIndex)) {
    const match = line.match(/^([a-z][a-z0-9_-]*): (.+)$/);
    if (!match) {
      addFrontmatterUnsupported(folderName, skillPath, addDiagnostic);
      continue;
    }

    const [, key, value] = match;
    if (key !== "name" && key !== "description") {
      addDiagnostic({
        severity: "error",
        code: "FRONTMATTER_FIELD_UNSUPPORTED",
        skill: folderName,
        path: skillPath,
        message: `Frontmatter field '${key}' is not supported by VocaSpace frontmatter v1.`,
      });
      continue;
    }

    if (fields.has(key)) {
      addDiagnostic({
        severity: "error",
        code: "FRONTMATTER_FIELD_DUPLICATE",
        skill: folderName,
        path: skillPath,
        message: `Frontmatter field '${key}' must appear exactly once.`,
      });
      continue;
    }

    fields.set(key, value);
  }

  for (const requiredField of ["name", "description"]) {
    if (fields.has(requiredField)) continue;
    addDiagnostic({
      severity: "error",
      code: "FRONTMATTER_FIELD_MISSING",
      skill: folderName,
      path: skillPath,
      message: `Frontmatter field '${requiredField}' is required.`,
    });
  }

  const name = fields.get("name");
  if (name && !skillNamePattern.test(name)) {
    const code = name.startsWith("\"") || name.startsWith("'") || name.includes(" #")
      ? "FRONTMATTER_UNSUPPORTED"
      : "SKILL_NAME_INVALID";
    addDiagnostic({
      severity: "error",
      code,
      identity: "frontmatter:name",
      skill: folderName,
      path: skillPath,
      message:
        code === "SKILL_NAME_INVALID"
          ? "Frontmatter name must be unquoted kebab-case."
          : "VocaSpace frontmatter v1 requires an unquoted name.",
    });
  }

  const description = fields.get("description");
  if (description && !isSupportedDescription(description)) {
    addDiagnostic({
      severity: "error",
      code: "FRONTMATTER_UNSUPPORTED",
      identity: "frontmatter:description",
      skill: folderName,
      path: skillPath,
      message: "Description uses syntax unsupported by VocaSpace frontmatter v1.",
    });
  }

  return {
    name: name && skillNamePattern.test(name) ? name : undefined,
  };
}

function isSupportedDescription(value) {
  if (value.startsWith("\"")) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" && parsed.length > 0 && parsed.trim() === parsed;
    } catch {
      return false;
    }
  }

  return (
    value.length > 0 &&
    value.trim() === value &&
    !disallowedDescriptionStart.includes(value[0]) &&
    !value.includes(": ") &&
    !value.includes(" #")
  );
}

function addFrontmatterUnsupported(folderName, skillPath, addDiagnostic) {
  addDiagnostic({
    severity: "error",
    code: "FRONTMATTER_UNSUPPORTED",
    skill: folderName,
    path: skillPath,
    message: "SKILL.md must use supported VocaSpace frontmatter v1 syntax.",
  });
}

function parseResourceRouting(text, folderName, skillPath, addDiagnostic) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === "## Resource routing");
  const targets = new Set();
  if (headingIndex === -1) return targets;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{1,2}\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;

    const cells = splitMarkdownRow(line);
    if (cells.length >= 2 && isTableHeader(cells)) continue;
    if (cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

    const linkMatch = cells[0]?.match(/^\[[^\]]+\]\(([^)]+)\)$/);
    const condition = cells[1]?.trim();
    const resourceTarget = linkMatch ? parseResourceTarget(linkMatch[1]) : undefined;
    if (!linkMatch || !condition) {
      addDiagnostic({
        severity: "error",
        code: "RESOURCE_ROUTING_ENTRY_INVALID",
        skill: folderName,
        path: skillPath,
        message: "Resource routing rows require a local relative Markdown path and a non-empty read condition.",
      });
      continue;
    }
    if (resourceTarget.kind !== "local") {
      addDiagnostic({
        severity: "error",
        code: "RESOURCE_ROUTING_ENTRY_INVALID",
        skill: folderName,
        path: skillPath,
        message: `Resource routing target '${resourceTarget.rawTarget}' must be a local relative path.`,
      });
      continue;
    }

    targets.add(resourceTarget.canonicalPath);
  }

  return targets;
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function isTableHeader(cells) {
  return cells[0]?.toLowerCase() === "resource" && cells[1]?.toLowerCase() === "read condition";
}

function parseLocalMarkdownLinks(text) {
  const targets = new Set();
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    targets.add(target);
  }
  return targets;
}

function validateResourceTarget({
  repoRoot,
  folderName,
  absoluteSkillDirectory,
  target,
  skillPath,
  addDiagnostic,
}) {
  const resourceTarget = parseResourceTarget(target);
  if (resourceTarget.kind === "external" || resourceTarget.kind === "same-document") return;

  if (resourceTarget.kind === "absolute") {
    addDiagnostic({
      severity: "error",
      code: "RESOURCE_PATH_ESCAPE",
      skill: folderName,
      path: skillPath,
      message: `Resource path '${target}' must stay inside the skill directory.`,
    });
    return;
  }

  const resolvedTarget = resolve(
    absoluteSkillDirectory,
    resourceTarget.canonicalPath.replace(/[\\/]+/g, sep),
  );
  if (!isContainedPath(absoluteSkillDirectory, resolvedTarget)) {
    addDiagnostic({
      severity: "error",
      code: "RESOURCE_PATH_ESCAPE",
      skill: folderName,
      path: skillPath,
      message: `Resource path '${target}' must stay inside the skill directory.`,
    });
    return;
  }

  const pathParts = relative(absoluteSkillDirectory, resolvedTarget).split(sep).filter(Boolean);
  let current = absoluteSkillDirectory;
  for (const part of pathParts) {
    current = resolve(current, part);
    const currentPath = toRepoPath(repoRoot, current);
    const expectedPath = toRepoPath(repoRoot, resolvedTarget);
    const stat = optionalStat(current, currentPath);
    if (!stat) {
      addDiagnostic({
        severity: "error",
        code: "RESOURCE_MISSING",
        skill: folderName,
        path: expectedPath,
        message: `Referenced resource '${target}' does not exist.`,
      });
      return;
    }
    if (stat.isSymbolicLink()) {
      addDiagnostic({
        severity: "error",
        code: "PATH_REPARSE_POINT",
        skill: folderName,
        path: currentPath,
        message: "Skill bundles must not contain or traverse symbolic links or junctions.",
      });
      return;
    }
  }

  const finalStat = optionalStat(resolvedTarget, toRepoPath(repoRoot, resolvedTarget));
  if (!finalStat?.isFile()) {
    addDiagnostic({
      severity: "error",
      code: "RESOURCE_MISSING",
      skill: folderName,
      path: toRepoPath(repoRoot, resolvedTarget),
      message: `Referenced resource '${target}' must be a file.`,
    });
  }
}

function reportBundleStructure({
  repoRoot,
  folderName,
  absoluteSkillDirectory,
  routedResources,
  addDiagnostic,
}) {
  const resources = [];
  walkBundle(absoluteSkillDirectory, absoluteSkillDirectory, resources, {
    repoRoot,
    folderName,
    addDiagnostic,
  });

  for (const resource of resources.sort(compareStrings)) {
    if (resource === "SKILL.md" || routedResources.has(resource)) continue;
    addDiagnostic({
      severity: "warning",
      code: "RESOURCE_NOT_ROUTED",
      skill: folderName,
      path: toRepoPath(repoRoot, resolve(absoluteSkillDirectory, resource.replace(/\//g, sep))),
      message: `Bundled resource '${resource}' is not listed in the standardized Resource routing table.`,
    });
  }
}

function walkBundle(root, directory, resources, context) {
  const directoryPath = toRepoPath(context.repoRoot, directory);
  for (const entry of readDirectory(directory, directoryPath).sort(compareNames)) {
    const absoluteEntry = resolve(directory, entry.name);
    const entryPath = toRepoPath(context.repoRoot, absoluteEntry);

    if (entry.isSymbolicLink()) {
      context.addDiagnostic({
        severity: "error",
        code: "PATH_REPARSE_POINT",
        skill: context.folderName,
        path: entryPath,
        message: "Skill bundles must not contain or traverse symbolic links or junctions.",
      });
      continue;
    }

    if (entry.isDirectory()) {
      walkBundle(root, absoluteEntry, resources, context);
      continue;
    }

    if (entry.isFile()) {
      resources.push(normalizeSlashes(relative(root, absoluteEntry)));
    }
  }
}

function reportDuplicateNames(skills, addDiagnostic) {
  const byName = new Map();
  for (const skill of skills) {
    if (!skill.metadataName) continue;
    const matches = byName.get(skill.metadataName) ?? [];
    matches.push(skill);
    byName.set(skill.metadataName, matches);
  }

  for (const [name, matches] of [...byName.entries()].sort(([a], [b]) => compareStrings(a, b))) {
    if (matches.length < 2) continue;
    for (const skill of matches.sort((a, b) => compareStrings(a.skillPath, b.skillPath))) {
      addDiagnostic({
        severity: "error",
        code: "SKILL_NAME_DUPLICATE",
        skill: skill.folderName,
        path: skill.skillPath,
        message: `Repo-local frontmatter name '${name}' is duplicated.`,
      });
    }
  }
}

function validateExplicitRoutes({ repoRoot, agentsText, skills, addDiagnostic }) {
  const routePattern = /\.agents[\\/]+skills[\\/]+([^\\/\r\n]+?)[\\/]+SKILL\.md/g;
  const routedSkills = new Set();

  for (const match of agentsText.matchAll(routePattern)) {
    if (!isRouteTokenStart(agentsText, match.index)) continue;
    if (!isRouteTokenEnd(agentsText, match.index + match[0].length)) continue;

    const name = match[1];
    if (/[*?[\]{}]/.test(name)) continue;
    const routePath = normalizeSlashes(match[0]).replace(/\/{2,}/g, "/");
    routedSkills.add(name);
    const absoluteRoute = resolve(repoRoot, routePath.replace(/\//g, sep));
    const stat = optionalStat(absoluteRoute, routePath);
    if (stat?.isFile()) continue;

    addDiagnostic({
      severity: "error",
      code: "EXPLICIT_ROUTE_MISSING",
      skill: name,
      path: routePath,
      message: "AGENTS.md contains an explicit repo-skill path that does not exist.",
    });
  }

  for (const skill of skills.sort((a, b) => compareStrings(a.folderName, b.folderName))) {
    if (routedSkills.has(skill.folderName)) continue;
    addDiagnostic({
      severity: "warning",
      code: "SKILL_NOT_EXPLICITLY_ROUTED",
      skill: skill.folderName,
      path: skill.skillPath,
      message: "Repo-local skill is not referenced by an explicit path in AGENTS.md.",
    });
  }
}

function isRouteTokenStart(text, index) {
  if (index === 0) return true;
  return /[\s`'"(\[<{,:;]/.test(text[index - 1]);
}

function isRouteTokenEnd(text, index) {
  if (index >= text.length) return true;
  if (/[\s`'")\]}>,;:!?]/.test(text[index])) return true;
  return text[index] === "." && (index + 1 >= text.length || /\s/.test(text[index + 1]));
}

function assertRequiredDirectory(path, code, displayPath) {
  const stat = optionalStat(path, displayPath);
  if (stat?.isDirectory() && !stat.isSymbolicLink()) return;
  throw new OperationalError(code, `Required directory ${displayPath} is missing or unreadable.`);
}

function readRequiredText(path, code, displayPath) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new OperationalError(code, `Required file ${displayPath} is missing or unreadable.`);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new OperationalError(code, `Required file ${displayPath} is not valid UTF-8.`);
  }
}

function readDirectory(path, displayPath) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    throw new OperationalError(
      "DIRECTORY_UNREADABLE",
      `Required directory ${displayPath} is unreadable.`,
    );
  }
}

function optionalStat(path, displayPath) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      ["ENOENT", "ENOTDIR"].includes(error.code)
    ) {
      return undefined;
    }
    throw new OperationalError(
      "PATH_UNREADABLE",
      `Required path ${displayPath} is unreadable.`,
    );
  }
}

function countLines(text) {
  if (!text) return 0;
  const newlineCount = text.match(/\n/g)?.length ?? 0;
  return newlineCount + (text.endsWith("\n") ? 0 : 1);
}

function isCrossPlatformAbsolute(path) {
  return (
    isAbsolute(path) ||
    /^[A-Za-z]:[\\/]/.test(path) ||
    /^[\\/]{2}/.test(path)
  );
}

function isContainedPath(parent, child) {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== ".." && !isAbsolute(pathFromParent))
  );
}

function parseResourceTarget(rawTarget) {
  if (rawTarget.startsWith("#") || rawTarget.startsWith("?")) {
    return { kind: "same-document", rawTarget };
  }

  const pathOnly = rawTarget.split(/[?#]/, 1)[0];
  if (isCrossPlatformAbsolute(pathOnly)) {
    return { kind: "absolute", rawTarget };
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawTarget)) {
    return { kind: "external", rawTarget };
  }

  const slashNormalizedPath = normalizeSlashes(pathOnly).replace(/\/{2,}/g, "/");
  const canonicalPath = slashNormalizedPath
    ? posix.normalize(slashNormalizedPath).replace(/^(?:\.\/)+/, "")
    : "";
  if (!canonicalPath) return { kind: "same-document", rawTarget };
  return { kind: "local", rawTarget, canonicalPath };
}

function normalizeSlashes(path) {
  return path.replace(/\\/g, "/");
}

function toRepoPath(repoRoot, path) {
  return normalizeSlashes(relative(repoRoot, path));
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
    compareStrings(a.message, b.message)
  );
}
