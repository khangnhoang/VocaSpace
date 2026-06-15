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

  return { runtimeRoot, supabaseDir, workdir: runtimeRoot };
}

function patchRuntimeConfig(config) {
  return config
    .replace(/^project_id = ".*"$/m, 'project_id = "voca_space_e2e"')
    .replace(/^port = 54321$/m, "port = 55441")
    .replace(/^port = 54322$/m, "port = 55442")
    .replace(/^shadow_port = 54320$/m, "shadow_port = 55440")
    .replace(/^port = 54329$/m, "port = 55449")
    .replace(/^port = 54323$/m, "port = 55443")
    .replace(/^port = 54324$/m, "port = 55444")
    .replace(/^# smtp_port = 54325$/m, "# smtp_port = 55445")
    .replace(/^# pop3_port = 54326$/m, "# pop3_port = 55446")
    .replace(/^site_url = "http:\/\/127\.0\.0\.1:3000"$/m, 'site_url = "http://127.0.0.1:3100"')
    .replace(/^additional_redirect_urls = \["https:\/\/127\.0\.0\.1:3000"\]$/m, 'additional_redirect_urls = ["http://127.0.0.1:3100"]')
    .replace(/^inspector_port = 8083$/m, "inspector_port = 18084")
    .replace(/^port = 54327$/m, "port = 55447");
}
