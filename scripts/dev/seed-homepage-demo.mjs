import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Gán ảnh bìa mẫu (public/demo/course-covers) cho các khóa công khai chưa có ảnh ở DB local, để xem trang chủ đầy đủ.
// Chỉ ghi vào root-local API 45321; khóa đã có ảnh thật được giữ nguyên, và --revert chỉ gỡ đúng các ảnh mẫu này.
const root = resolve(import.meta.dirname, "../..");
export const DEMO_COVER_PREFIX = "/demo/course-covers/";
export const DEMO_COVERS = Array.from({ length: 6 }, (_, index) => `${DEMO_COVER_PREFIX}cover-${index + 1}.svg`);

export function assertHomepageDemoTarget(apiUrl) {
  if (new URL(apiUrl).origin !== "http://127.0.0.1:45321") {
    throw new Error("Homepage demo writes only to root-local API 45321; hosted/E2E targets are refused.");
  }
}

function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

export async function applyHomepageDemo(env, mode) {
  assertHomepageDemoTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (mode === "revert") {
    const reverted = checked(
      await service
        .from("courses")
        .update({ thumbnail_url: null })
        .like("thumbnail_url", `${DEMO_COVER_PREFIX}%`)
        .select("id"),
      "Revert demo covers",
    );
    return { reverted: reverted.length };
  }

  const catalog = checked(await service.rpc("get_public_course_catalog"), "Read public catalog");
  const targets = catalog.filter((course) => !course.thumbnail_url).map((course) => course.id);
  let updated = 0;
  for (const [index, id] of targets.entries()) {
    const rows = checked(
      await service
        .from("courses")
        .update({ thumbnail_url: DEMO_COVERS[index % DEMO_COVERS.length] })
        .eq("id", id)
        .is("thumbnail_url", null)
        .select("id"),
      `Set demo cover for ${id}`,
    );
    updated += rows.length;
  }
  return { publicCourses: catalog.length, updated, keptExistingCovers: catalog.length - targets.length };
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--revert") ? "revert" : null;
  if (!mode) throw new Error("Use --apply to add demo covers or --revert to remove them. Real covers are never changed.");
  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  if (!/^project_id\s*=\s*"voca_space"/m.test(config)) throw new Error("Expected root project voca_space.");
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx --no-install supabase status -o env"]
      : ["--no-install", "supabase", "status", "-o", "env"];
  const status = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  });
  if (status.status !== 0) throw new Error("Root Supabase status is unavailable; start the existing local runtime first.");
  const values = Object.fromEntries(
    status.stdout.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const result = await applyHomepageDemo(
    { NEXT_PUBLIC_SUPABASE_URL: values.API_URL, SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY },
    mode,
  );
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
