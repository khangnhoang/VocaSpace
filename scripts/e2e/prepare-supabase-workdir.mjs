import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const runtimeRootName = ".e2e-runtime";
export const runtimeSupabaseDirName = "supabase";

export function prepareSupabaseWorkdir(repoRoot) {
  const sourceDir = join(repoRoot, "supabase");
  const runtimeRoot = join(repoRoot, runtimeRootName);
  const supabaseDir = join(runtimeRoot, runtimeSupabaseDirName);

  if (!existsSync(sourceDir)) {
    throw new Error("Cannot find the root supabase source directory.");
  }

  rmSync(runtimeRoot, { recursive: true, force: true });
  mkdirSync(dirname(supabaseDir), { recursive: true });
  cpSync(sourceDir, supabaseDir, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replace(/\\/g, "/");
      return !normalized.includes("/.temp") && !normalized.includes("/.branches");
    },
  });

  const configPath = join(supabaseDir, "config.toml");
  const config = readFileSync(configPath, "utf8");
  writeFileSync(configPath, patchRuntimeConfig(config), "utf8");

  return { runtimeRoot, supabaseDir, workdir: runtimeRootName };
}

function patchRuntimeConfig(config) {
  let patched = setRootValue(config, "project_id", '"voca_space_e2e"');
  patched = setSectionValue(patched, "api", "port", "55441");
  patched = setSectionValue(patched, "db", "port", "55442");
  patched = setSectionValue(patched, "db", "shadow_port", "55440");
  patched = setSectionValue(patched, "db.pooler", "port", "55449");
  patched = setSectionValue(patched, "studio", "port", "55443");
  patched = setSectionValue(patched, "inbucket", "port", "55444");
  patched = setSectionValue(patched, "inbucket", "smtp_port", "55445", { commented: true });
  patched = setSectionValue(patched, "inbucket", "pop3_port", "55446", { commented: true });
  patched = setSectionValue(patched, "auth", "site_url", '"http://127.0.0.1:3100"');
  patched = setSectionValue(patched, "auth", "additional_redirect_urls", '["http://127.0.0.1:3100"]');
  patched = setSectionValue(patched, "edge_runtime", "inspector_port", "18084");
  patched = setSectionValue(patched, "analytics", "port", "55447");
  return patched;
}

function setRootValue(config, key, value) {
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*=.*$`, "m");
  if (!pattern.test(config)) {
    throw new Error(`Cannot patch E2E Supabase config: missing root ${key}.`);
  }
  return config.replace(pattern, `${key} = ${value}`);
}

function setSectionValue(config, section, key, value, options = {}) {
  const lines = config.split(/\r?\n/);
  const header = `[${section}]`;
  const headerIndex = lines.findIndex((line) => line.trim() === header);
  if (headerIndex === -1) {
    throw new Error(`Cannot patch E2E Supabase config: missing [${section}].`);
  }

  const keyPattern = options.commented
    ? new RegExp(`^(\\s*#\\s*)${escapeRegExp(key)}\\s*=.*$`)
    : new RegExp(`^(\\s*)${escapeRegExp(key)}\\s*=.*$`);

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*\[/.test(line)) break;

    const match = line.match(keyPattern);
    if (!match) continue;

    const prefix = options.commented ? match[1].replace(/\s+$/, " ") : match[1];
    lines[index] = `${prefix}${key} = ${value}`;
    return lines.join("\n");
  }

  throw new Error(`Cannot patch E2E Supabase config: missing ${key} in [${section}].`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
