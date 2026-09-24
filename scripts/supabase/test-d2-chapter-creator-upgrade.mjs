import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Test plan:
// - Mục tiêu: chạy C1 trên schema/chapter rows trước D2 thay vì giả lập sau migration.
// - Thành công: backfill theo owner → co-owner → editor; cùng tier chọn UUID nhỏ nhất.
// - Thất bại: thiếu candidate phải raise D2_CHAPTER_CREATOR_BACKFILL_NO_CANDIDATE và rollback.
// - Cô lập: chỉ dùng scratch project ID/ports riêng; migration và fixtures không đi vào voca_space.
// - Kết quả verify gần nhất: đạt với `npm.cmd run test:supabase:d2-chapter-creator-upgrade` trên project scratch cục bộ.

const repoRoot = resolve(import.meta.dirname, "..", "..");
const runtimeRootName = ".d2-chapter-creator-upgrade-runtime";
const runtimeRoot = resolve(repoRoot, runtimeRootName);
const workdir = runtimeRootName;
const projectId = "voca_space_d2_chapter_upgrade";
const markerPath = join(runtimeRoot, ".runtime-owner");
const migrationName = "20260924100000_d2_chapter_creator_authority.sql";
const migrationRelativePath = `supabase/migrations/${migrationName}`;
const candidateUserCount = 4;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  let prepared = false;
  let failure;

  try {
    prepareRuntime();
    prepared = true;
    const start = runSupabase(["start", "--yes"], { encoding: "utf8" });
    if (start.status !== 0) {
      const detail = [start.stdout, start.stderr].filter(Boolean).join("\n").trim();
      throw new Error(`Could not start the isolated D2 migration test runtime.${detail ? `\n${detail}` : ""}`);
    }
    const supabaseEnv = readSupabaseEnv();
    assertLocalSupabaseUrl(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL);

    resetScratchDatabase();
    const admin = createAdminClient(supabaseEnv);
    await verifyLegacyUpgrade(admin);

    removeMigrationFromRuntime();
    resetScratchDatabase();
    const failureAdmin = createAdminClient(supabaseEnv);
    await verifyNoCandidateStopsMigration(failureAdmin);
  } catch (error) {
    failure = error;
  } finally {
    if (prepared) {
      const stopped = runSupabase(["stop", "--no-backup", "--yes"]);
      if (stopped.status !== 0) {
        const detail = [stopped.stdout, stopped.stderr].filter(Boolean).join("\n").trim();
        failure = new Error(
          `${failure ? `${failure instanceof Error ? failure.message : failure}\n` : ""}` +
          `Could not remove the isolated Supabase test runtime.${detail ? `\n${detail}` : ""}`,
        );
      } else {
        removeOwnedRuntime();
      }
    }
  }

  if (failure) throw failure;
}

function prepareRuntime() {
  if (existsSync(runtimeRoot)) {
    if (!existsSync(markerPath) || readFileSync(markerPath, "utf8") !== projectId) {
      throw new Error(`Refusing to reuse an unrecognized runtime directory: ${runtimeRoot}`);
    }
    const stopped = runSupabase(["stop", "--no-backup", "--yes"]);
    if (stopped.status !== 0) {
      throw new Error("Could not stop the previous owned D2 migration test runtime.");
    }
    removeOwnedRuntime();
  }

  const sourceSupabaseDir = join(repoRoot, "supabase");
  const runtimeSupabaseDir = join(runtimeRoot, "supabase");
  mkdirSync(runtimeRoot, { recursive: true });
  cpSync(sourceSupabaseDir, runtimeSupabaseDir, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replace(/\\/g, "/");
      return !normalized.includes("/.temp") && !normalized.includes("/.branches");
    },
  });
  writeFileSync(markerPath, projectId, "utf8");

  const migrationsDir = join(runtimeSupabaseDir, "migrations");
  for (const entry of readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"))) {
    if (entry.localeCompare(migrationName) >= 0) {
      rmSync(join(migrationsDir, entry), { force: true });
    }
  }

  const configPath = join(runtimeSupabaseDir, "config.toml");
  let config = readFileSync(configPath, "utf8");
  config = setRootValue(config, "project_id", `"${projectId}"`);
  config = setSectionValue(config, "api", "port", "57321");
  config = setSectionValue(config, "db", "port", "57322");
  config = setSectionValue(config, "db", "shadow_port", "57320");
  config = setSectionValue(config, "db.pooler", "port", "57329");
  config = setSectionValue(config, "studio", "port", "57323");
  config = setSectionValue(config, "inbucket", "port", "57324");
  config = setSectionValue(config, "edge_runtime", "inspector_port", "28084");
  config = setSectionValue(config, "analytics", "port", "57327");
  config = setSectionValue(config, "db.seed", "enabled", "false");
  config = setSectionValue(config, "db.seed", "sql_paths", "[]");
  writeFileSync(configPath, config, "utf8");
}

function resetScratchDatabase() {
  runSupabaseRequired(["db", "reset", "--local", "--yes"], "Could not initialize the isolated pre-D2 schema.");
}

function createAdminClient(supabaseEnv) {
  return createClient(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL, supabaseEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createUsers(admin, count) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email: `d2-upgrade-${suffix}@example.test`,
      password: randomUUID(),
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Could not create isolated migration fixture user: ${error?.message}`);
    users.push(data.user.id);
  }

  const { data: profiles, error } = await admin.from("profiles")
    .select("id, removed_at")
    .in("id", users);
  if (error) throw new Error(`Could not verify pre-D2 profiles: ${error.message}`);
  assert.equal(profiles?.length, count);
  assert(profiles?.every((profile) => profile.removed_at === null), "Each legacy candidate must have an active profile.");
  return users;
}

async function createLegacyCourse(admin, suffix, roleCandidates) {
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const { error: courseError } = await admin.from("courses").insert({
    id: courseId,
    title: `D2 legacy backfill ${suffix}`,
    slug: `d2-legacy-${suffix}`,
    description: "Isolated pre-D2 chapter creator upgrade fixture.",
    status: "draft",
    price: 0,
  });
  if (courseError) throw new Error(`Could not create legacy course fixture: ${courseError.message}`);

  const collaborators = roleCandidates.map(({ userId, role, addedBy }) => ({
    course_id: courseId,
    user_id: userId,
    role,
    added_by: addedBy,
    can_review_topics: false,
  }));
  if (collaborators.length > 0) {
    const { error } = await admin.from("course_collaborators").insert(collaborators);
    if (error) throw new Error(`Could not create legacy collaborators: ${error.message}`);
  }

  const { error: chapterError } = await admin.from("chapters").insert({
    id: chapterId,
    course_id: courseId,
    title: `Legacy chapter ${suffix}`,
    order_index: 1,
  });
  if (chapterError) throw new Error(`Could not create pre-D2 chapter row: ${chapterError.message}`);
  return { courseId, chapterId };
}

async function verifyLegacyUpgrade(admin) {
  assert.equal(
    queryDatabase("select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'chapters' and column_name = 'created_by_user_id'"),
    "0",
    "The test database must use the pre-D2 chapter schema before fixture creation.",
  );
  const [owner, coOwner, editorA, editorB] = await createUsers(admin, candidateUserCount);
  const fixtures = [
    await createLegacyCourse(admin, randomUUID(), [
      { userId: owner, role: "owner", addedBy: owner },
      { userId: coOwner, role: "co_owner", addedBy: owner },
      { userId: editorA, role: "editor", addedBy: owner },
    ]),
    await createLegacyCourse(admin, randomUUID(), [
      { userId: coOwner, role: "co_owner", addedBy: coOwner },
      { userId: editorA, role: "editor", addedBy: coOwner },
    ]),
    await createLegacyCourse(admin, randomUUID(), [
      { userId: editorA, role: "editor", addedBy: editorA },
      { userId: editorB, role: "editor", addedBy: editorA },
    ]),
  ];
  const expectedByChapter = new Map([
    [fixtures[0].chapterId, owner],
    [fixtures[1].chapterId, coOwner],
    [fixtures[2].chapterId, [editorA, editorB].sort()[0]],
  ]);

  installMigrationInRuntime();
  runSupabaseRequired(["migration", "up", "--local"], "The D2 migration failed to upgrade valid pre-D2 chapter rows.");
  const rows = queryDatabase(
    `select id::text || '|' || created_by_user_id::text from public.chapters where id in (${sqlUuidList(expectedByChapter.keys())}) order by id`,
  );
  const actualByChapter = new Map(rows.split(/\r?\n/).filter(Boolean).map((row) => row.split("|")));
  assert.equal(actualByChapter.size, expectedByChapter.size, "Every pre-D2 chapter should be returned after upgrade.");
  for (const [chapterId, expectedCreator] of expectedByChapter) {
    assert.equal(actualByChapter.get(chapterId), expectedCreator, `Wrong legacy creator assignment for ${chapterId}.`);
  }
  console.log("C1 upgrade path passed: owner, then co-owner, then editor; same-tier editor tie uses the lowest UUID.");
}

async function verifyNoCandidateStopsMigration(admin) {
  assert.equal(
    queryDatabase("select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'chapters' and column_name = 'created_by_user_id'"),
    "0",
    "The stop-path fixture must begin with the pre-D2 chapter schema.",
  );
  await createLegacyCourse(admin, randomUUID(), []);
  installMigrationInRuntime();
  const result = runSupabase(["migration", "up", "--local"], { encoding: "utf8" });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assert.notEqual(result.status, 0, "The migration must stop when a legacy chapter has no valid creator candidate.");
  assert.match(output, /D2_CHAPTER_CREATOR_BACKFILL_NO_CANDIDATE/);

  const rollbackState = queryDatabase(
    `select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'chapters' and column_name = 'created_by_user_id')::text || '|' || (select count(*) from supabase_migrations.schema_migrations where version = '20260924100000')::text`,
  );
  assert.equal(rollbackState, "0|0", "A rejected migration must leave the legacy schema and migration history unchanged.");
  console.log("C1 stop path passed: missing candidate raises D2_CHAPTER_CREATOR_BACKFILL_NO_CANDIDATE and rolls back.");
}

function installMigrationInRuntime() {
  const source = join(repoRoot, migrationRelativePath);
  const destination = join(runtimeRoot, "supabase", "migrations", migrationName);
  cpSync(source, destination);
}

function removeMigrationFromRuntime() {
  rmSync(join(runtimeRoot, "supabase", "migrations", migrationName), { force: true });
}

function queryDatabase(sql) {
  const result = spawnSync("docker", [
    "exec", "-i", `supabase_db_${projectId}`,
    "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", sql,
  ], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Local scratch SQL query failed: ${[result.stdout, result.stderr].filter(Boolean).join("\n").trim()}`);
  }
  return result.stdout.trim();
}

function readSupabaseEnv() {
  const result = runSupabase(["status", "-o", "env"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read isolated Supabase status: ${result.stderr ?? ""}`);
  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = stripQuotes(match[2]);
  }
  for (const name of ["API_URL", "SERVICE_ROLE_KEY"]) {
    if (!values[name]) throw new Error(`Supabase status did not return ${name}.`);
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  };
}

function assertLocalSupabaseUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "57321") {
    throw new Error(`Refusing to use a non-scratch Supabase URL: ${url}`);
  }
}

function runSupabaseRequired(args, failureMessage) {
  const result = runSupabase(args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(failureMessage);
}

function runSupabase(args, options = {}) {
  const invocation = commandInvocation(npxCommand(), ["supabase", "--workdir", workdir, ...args]);
  return spawnSync(invocation.command, invocation.args, { cwd: repoRoot, shell: false, ...options });
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function commandInvocation(command, args) {
  if (process.platform !== "win32" || !command.endsWith(".cmd")) return { command, args };
  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")],
  };
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function setRootValue(config, key, value) {
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*=.*$`, "m");
  assert.match(config, pattern, `Missing root Supabase setting ${key}.`);
  return config.replace(pattern, `${key} = ${value}`);
}

function setSectionValue(config, section, key, value) {
  const lines = config.split(/\r?\n/);
  const sectionHeader = `[${section}]`;
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionHeader);
  assert.notEqual(sectionIndex, -1, `Missing Supabase section ${section}.`);
  const keyPattern = new RegExp(`^(\\s*)${escapeRegExp(key)}\\s*=.*$`);
  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) break;
    if (keyPattern.test(lines[index])) {
      lines[index] = lines[index].replace(keyPattern, `$1${key} = ${value}`);
      return lines.join("\n");
    }
  }
  throw new Error(`Missing ${key} in Supabase section ${section}.`);
}

function sqlUuidList(values) {
  return [...values].map((value) => `'${value}'::uuid`).join(", ");
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function removeOwnedRuntime() {
  const resolvedRoot = resolve(runtimeRoot);
  const resolvedRepo = resolve(repoRoot);
  if (!resolvedRoot.startsWith(`${resolvedRepo}${sep}`) || resolvedRoot !== resolve(repoRoot, runtimeRootName)) {
    throw new Error(`Refusing to remove an unexpected runtime path: ${resolvedRoot}`);
  }
  if (!existsSync(markerPath) || readFileSync(markerPath, "utf8") !== projectId) {
    throw new Error(`Refusing to remove an unrecognized runtime directory: ${resolvedRoot}`);
  }
  rmSync(resolvedRoot, { recursive: true, force: true });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
