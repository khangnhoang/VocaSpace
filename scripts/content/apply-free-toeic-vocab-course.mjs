import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_PATH = fileURLToPath(new URL("./free-toeic-vocab-basics.json", import.meta.url));
const PROJECT_REF = "zmnfsorjuibfjowmjtxo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function keys(value, allowed, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label}: cần object`);
  for (const key of Object.keys(value)) assert(allowed.includes(key), `${label}: field không hỗ trợ ${key}`);
}

function text(value, label) {
  assert(typeof value === "string" && value.trim().length > 0 && !value.includes("\0"), `${label}: thiếu văn bản hợp lệ`);
}

function questions(items, count, label, part5 = false) {
  assert(Array.isArray(items) && items.length === count, `${label}: cần ${count} câu`);
  const seen = new Set();
  for (const question of items) {
    keys(question, ["content", "explanation", "options"], label);
    text(question.content, `${label}.content`);
    text(question.explanation, `${label}.explanation`);
    assert(!seen.has(question.content), `${label}: câu trùng`);
    seen.add(question.content);
    if (part5) assert((question.content.match(/______/g) ?? []).length === 1, `${label}: cần một chỗ trống`);
    assert(Array.isArray(question.options) && question.options.length === 4, `${label}: cần bốn lựa chọn`);
    const choices = new Set();
    for (const option of question.options) {
      keys(option, ["content", "is_correct"], label);
      text(option.content, `${label}.option`);
      assert(typeof option.is_correct === "boolean", `${label}: is_correct phải là boolean`);
      choices.add(option.content.trim().toLowerCase());
    }
    assert(choices.size === 4, `${label}: lựa chọn trùng`);
    assert(question.options.filter((option) => option.is_correct).length === 1, `${label}: cần đúng một đáp án`);
  }
}

export function validateContent(data) {
  keys(data, ["title", "slug", "description", "price", "chapter"], "course");
  for (const field of ["title", "slug", "description"]) text(data[field], `course.${field}`);
  assert(data.title.length >= 5 && data.description.length >= 10, "Metadata course quá ngắn");
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug), "Slug không hợp lệ");
  assert(data.price === 0, "Course phải miễn phí");
  keys(data.chapter, ["title", "topics"], "chapter");
  text(data.chapter.title, "chapter.title");
  assert(data.chapter.title.length >= 3 && data.chapter.title.length <= 100, "Tên chapter không hợp lệ");
  assert(Array.isArray(data.chapter.topics) && data.chapter.topics.length === 3, "Cần ba topics");
  const words = new Set();
  const titles = new Set();
  for (const topic of data.chapter.topics) {
    keys(topic, ["title", "cards", "memory_check", "exercise"], "topic");
    text(topic.title, "topic.title");
    assert(topic.title.length >= 4 && topic.title.length <= 120, "Tên topic không hợp lệ");
    assert(!titles.has(topic.title), "Tên topic trùng");
    titles.add(topic.title);
    assert(Array.isArray(topic.cards) && topic.cards.length === 10, "Mỗi topic cần 10 thẻ");
    for (const card of topic.cards) {
      keys(card, ["front_content", "back_content"], "card");
      keys(card.front_content, ["word", "phonetic", "pos"], "front_content");
      keys(card.back_content, ["translation", "example", "exampleTranslation", "explanation", "hint"], "back_content");
      for (const field of ["word", "phonetic", "pos"]) text(card.front_content[field], `card.${field}`);
      for (const field of ["translation", "example", "exampleTranslation"]) text(card.back_content[field], `card.${field}`);
      assert(/^\/.+\/$/.test(card.front_content.phonetic), "IPA phải nằm giữa / /");
      const word = card.front_content.word.trim().toLowerCase();
      assert(!words.has(word), `Từ vựng trùng: ${word}`);
      words.add(word);
    }
    questions(topic.memory_check, 5, `${topic.title}: memory check`);
    keys(topic.exercise, ["title", "part_type", "questions"], "exercise");
    text(topic.exercise.title, "exercise.title");
    assert(topic.exercise.part_type === "part5", "Chỉ hỗ trợ Part 5 bằng văn bản");
    questions(topic.exercise.questions, 8, `${topic.title}: Part 5`, true);
  }
  return { courses: 1, course_collaborators: 2, chapters: 1, topics: 3, topic_author_review_exclusions: 3,
    cards: 30, exercises: 6, question_groups: 0, questions: 39, question_options: 156, topic_review_submissions: 3 };
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const GUARDS_SQL = `jsonb_build_object(
  'topics_chapters', (select count(*) from public.topics t join public.chapters ch on ch.id=t.chapter_id where t.course_id is distinct from ch.course_id),
  'exercises_topics', (select count(*) from public.exercises e join public.topics t on t.id=e.topic_id where e.course_id is distinct from t.course_id),
  'questions_exercises', (select count(*) from public.questions q join public.exercises e on e.id=q.exercise_id where q.course_id is distinct from e.course_id),
  'questions_groups', (select count(*) from public.questions q join public.question_groups g on g.id=q.group_id where q.exercise_id is distinct from g.exercise_id),
  'answers_options', (select count(*) from public.user_question_answers a join public.question_options o on o.id=a.selected_option_id where a.question_id is distinct from o.question_id)
)`;

const TABLE_FILTERS = {
  courses: "id=v_course_id",
  course_collaborators: "course_id=v_course_id",
  chapters: "course_id=v_course_id",
  topics: "course_id=v_course_id",
  topic_author_review_exclusions: "topic_id in (select id from public.topics where course_id=v_course_id)",
  cards: "topic_id in (select id from public.topics where course_id=v_course_id)",
  exercises: "course_id=v_course_id",
  question_groups: "exercise_id in (select id from public.exercises where course_id=v_course_id)",
  questions: "course_id=v_course_id",
  question_options: "question_id in (select id from public.questions where course_id=v_course_id)",
  topic_review_submissions: "topic_id in (select id from public.topics where course_id=v_course_id)",
};

function idsSql() {
  return `jsonb_build_object(${Object.entries(TABLE_FILTERS).map(([table, filter]) =>
    `${literal(table)}, (select coalesce(jsonb_agg(id::text order by id), '[]'::jsonb) from public.${table} where ${filter})`).join(",\n")})`;
}

export function validateThumbnailUrl(value, environment) {
  if (value === null) return;
  text(value, "thumbnailUrl");
  const url = new URL(value);
  assert(!url.username && !url.password && !url.search && !url.hash, "Thumbnail URL không được chứa credentials/query/hash");
  const origin = environment === "production" ? `https://${PROJECT_REF}.supabase.co` : "http://127.0.0.1:45321";
  assert(url.origin === origin && url.pathname.startsWith("/storage/v1/object/public/course_thumbnails/"), "Thumbnail phải thuộc bucket course_thumbnails đúng môi trường");
}

function postflightSql(data, expected, thumbnailUrl, receiptAfterCommit) {
  return `
  if not exists (select 1 from public.courses where id=v_course_id and status='published'
    and price=0 and removed_at is null and title=${literal(data.title)} and slug=${literal(data.slug)}
    and description=${literal(data.description)} and thumbnail_url is not distinct from ${thumbnailUrl === null ? "null" : literal(thumbnailUrl)}) then
    raise exception 'POSTFLIGHT_COURSE_METADATA';
  end if;
  v_ids := ${idsSql()};
  v_counts := '{}'::jsonb;
  for v_key, v_value in select key, value from jsonb_each(v_ids) loop
    v_counts := v_counts || jsonb_build_object(v_key, jsonb_array_length(v_value));
  end loop;
  if v_counts <> ${literal(JSON.stringify(expected))}::jsonb then
    raise exception 'POSTFLIGHT_COUNTS: %', v_counts;
  end if;
  if exists (select 1 from public.topics t where t.course_id=v_course_id and
    (t.status is distinct from 'published'::public.item_status or t.removed_at is not null or t.first_approved_at is null
    or t.original_creator_user_id<>v_owner_id or t.responsible_author_user_id<>v_owner_id
    or (select count(*) from public.cards c where c.topic_id=t.id and c.removed_at is null)<>10
    or (select count(*) from public.exercises e where e.topic_id=t.id and e.activity_stage='memory_check' and e.part_type is null and e.removed_at is null)<>1
    or (select count(*) from public.exercises e where e.topic_id=t.id and e.activity_stage='exercise' and e.part_type='part5' and e.removed_at is null)<>1
    or (select count(*) from public.questions q join public.exercises e on e.id=q.exercise_id where e.topic_id=t.id and e.activity_stage='memory_check' and q.group_id is null and q.removed_at is null)<>5
    or (select count(*) from public.questions q join public.exercises e on e.id=q.exercise_id where e.topic_id=t.id and e.activity_stage='exercise' and q.group_id is null and q.removed_at is null)<>8)) then
    raise exception 'POSTFLIGHT_TOPIC_CONTENT';
  end if;
  if exists (select 1 from public.questions q where q.course_id=v_course_id and
    (nullif(btrim(q.explanation),'') is null or q.group_id is not null
    or (select count(*) from public.question_options o where o.question_id=q.id and o.removed_at is null)<>4
    or (select count(*) from public.question_options o where o.question_id=q.id and o.is_correct and o.removed_at is null)<>1)) then
    raise exception 'POSTFLIGHT_QUESTION_OPTIONS';
  end if;
  if (select count(*) from public.course_collaborators where course_id=v_course_id and user_id=v_owner_id and role='owner')<>1
    or (select count(*) from public.course_collaborators where course_id=v_course_id and user_id=v_reviewer_id and role='previewer' and can_review_topics)<>1
    or (select count(*) from public.topic_review_submissions s join public.topics t on t.id=s.topic_id
      where t.course_id=v_course_id and s.status='approved' and s.submitted_by_user_id=v_owner_id and s.reviewed_by_user_id=v_reviewer_id and s.reviewed_at is not null)<>3 then
    raise exception 'POSTFLIGHT_AUTHOR_REVIEW';
  end if;
  v_guards := ${GUARDS_SQL};
  if exists (select 1 from jsonb_each_text(v_guards) where value::bigint<>0) then
    raise exception 'POSTFLIGHT_L1: %', v_guards;
  end if;
  perform set_config('voca.content_course_id',v_course_id::text,true);
  perform set_config('voca.content_manifest',jsonb_build_object(
    'course_id',v_course_id,'owner_id',v_owner_id,'reviewer_id',v_reviewer_id,
    'slug',${literal(data.slug)},'thumbnail_url',${thumbnailUrl === null ? "null" : literal(thumbnailUrl)},'counts',v_counts,'l1_invalid_rows',v_guards,'ids',v_ids)::text,${!receiptAfterCommit});
`;
}

export function buildSql({ data, owner, reviewer, mode, environment, manifest, thumbnailUrl = null, receiptAfterCommit = false }) {
  const expected = validateContent(data);
  validateThumbnailUrl(thumbnailUrl, environment);
  assert(!receiptAfterCommit || mode !== "rehearse", "Receipt sau COMMIT không áp dụng cho rehearsal");
  text(owner, "owner");
  text(reviewer, "reviewer");
  assert(["dry-run", "rehearse", "apply", "postflight"].includes(mode), "Mode không hợp lệ");
  const postflight = mode === "postflight";
  if (postflight) assert(UUID.test(manifest?.course_id), "Manifest thiếu course_id hợp lệ");
  const creates = mode === "apply" || mode === "rehearse";
  const body = creates ? `
    perform pg_advisory_xact_lock(hashtextextended(${literal(data.slug)},0));
  ` : "";
  const create = creates ? `
  perform set_config('request.jwt.claim.sub',v_owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner_id,'role','authenticated')::text,true);
  v_course_id := public.create_course_with_owner(${literal(data.title)},${literal(data.slug)},${literal(data.description)},0,${thumbnailUrl === null ? "null" : literal(thumbnailUrl)});

  -- RPC collaborator hiện có cần vòng mời/chấp nhận riêng. Owner đã chỉ định reviewer;
  -- chỉ thêm quyền review cho course vừa tạo, không sửa profile hoặc collaborator cũ.
  insert into public.course_collaborators(course_id,user_id,role,added_by,can_review_topics)
  values(v_course_id,v_reviewer_id,'previewer',v_owner_id,true);
  v_chapter_id := (public.create_chapter_ordered(v_course_id,${literal(data.chapter.title)})->'chapter'->>'id')::uuid;
  for v_topic in select value from jsonb_array_elements(v_data->'chapter'->'topics') loop
    v_topic_id := (public.create_topic_ordered(v_course_id,v_chapter_id,v_topic->>'title')->'topic'->>'id')::uuid;
    perform public.d1_bulk_create_cards(v_topic_id,v_topic->'cards',false);
    for v_question in select value from jsonb_array_elements(v_topic->'memory_check') loop
      perform public.d3_add_memory_check_question(v_topic_id,v_question,false);
    end loop;
    perform public.create_exercise_with_content(v_topic_id,v_topic->'exercise',false);
    v_submission_id := (public.request_topic_review(v_topic_id)->>'submission_id')::uuid;
    perform set_config('request.jwt.claim.sub',v_reviewer_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_reviewer_id,'role','authenticated')::text,true);
    perform public.approve_topic_review(v_submission_id);
    perform set_config('request.jwt.claim.sub',v_owner_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner_id,'role','authenticated')::text,true);
  end loop;
  -- Course publication chưa có Server Action/RPC thực thi. Cập nhật đúng ID vừa
  -- nhận từ create_course_with_owner, sau khi mọi topic đã qua review D1.
  update public.courses set status='published',submitted_at=now(),reviewed_by=v_reviewer_id,reviewed_at=now()
  where id=v_course_id and status='draft';
  if not found then raise exception 'COURSE_PUBLICATION_FAILED'; end if;
  ${postflightSql(data, expected, thumbnailUrl, receiptAfterCommit)}
` : postflight ? `
  v_course_id := ${literal(manifest.course_id)}::uuid;
  ${postflightSql(data, expected, thumbnailUrl, receiptAfterCommit)}
  if v_ids <> ${literal(JSON.stringify(manifest.ids))}::jsonb then raise exception 'POSTFLIGHT_MANIFEST_IDS_CHANGED'; end if;
` : `
  perform set_config('voca.content_manifest',jsonb_build_object('slug',${literal(data.slug)},
    'owner_id',v_owner_id,'reviewer_id',v_reviewer_id,'planned_counts',${literal(JSON.stringify(expected))}::jsonb,
    'l1_invalid_rows',v_guards)::text,${!receiptAfterCommit});
`;
  const publicRead = creates || postflight ? `
-- Xác minh public read model bằng role anon, không dùng đặc quyền postgres để kết luận hiển thị công khai.
set local role anon;
do $public_read$
declare v_id uuid := current_setting('voca.content_course_id')::uuid; v_detail jsonb;
begin
  if not exists(select 1 from public.get_public_course_catalog() where id=v_id and price=0) then
    raise exception 'POSTFLIGHT_PUBLIC_CATALOG';
  end if;
  v_detail := public.get_public_course_detail(${literal(data.slug)});
  if (v_detail->>'id')::uuid is distinct from v_id or jsonb_array_length(v_detail->'syllabus')<>1
    or jsonb_array_length(v_detail->'syllabus'->0->'topics')<>3 then
    raise exception 'POSTFLIGHT_PUBLIC_DETAIL';
  end if;
end $public_read$;
reset role;
` : "";
  return `begin${creates ? "" : " read only"};
set local statement_timeout='60s';
set local lock_timeout='5s';
set local client_encoding='UTF8';
set local standard_conforming_strings=on;
do $course_task$
declare
  v_data jsonb := ${literal(JSON.stringify(data))}::jsonb;
  v_owner_id uuid; v_reviewer_id uuid; v_course_id uuid; v_chapter_id uuid;
  v_topic_id uuid; v_submission_id uuid; v_topic jsonb; v_question jsonb;
  v_ids jsonb; v_counts jsonb; v_guards jsonb; v_key text; v_value jsonb;
begin
  ${body}
  if (select count(*) from auth.users u join public.profiles p on p.id=u.id
      where lower(u.email)=lower(${literal(owner)}) and p.role='teacher' and p.removed_at is null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))<>1 then
    raise exception 'PREFLIGHT_OWNER_MISSING_OR_NOT_TEACHER';
  end if;
  select p.id into strict v_owner_id from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(${literal(owner)});
  if (select count(*) from auth.users u join public.profiles p on p.id=u.id
      where lower(u.email)=lower(${literal(reviewer)}) and p.removed_at is null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))<>1 then
    raise exception 'PREFLIGHT_REVIEWER_MISSING';
  end if;
  select p.id into strict v_reviewer_id from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(${literal(reviewer)});
  if v_owner_id=v_reviewer_id then raise exception 'PREFLIGHT_SELF_REVIEW'; end if;
  ${postflight ? "" : `if exists(select 1 from public.courses where slug=${literal(data.slug)}) then raise exception 'PREFLIGHT_SLUG_EXISTS'; end if;`}
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261008130544')
    or not exists(select 1 from supabase_migrations.schema_migrations where version='20261010090000') then
    raise exception 'PREFLIGHT_L1_LF1_MIGRATIONS_REQUIRED';
  end if;
  v_guards := ${GUARDS_SQL};
  if exists(select 1 from jsonb_each_text(v_guards) where value::bigint<>0) then raise exception 'PREFLIGHT_L1: %',v_guards; end if;
  ${create}
end $course_task$;
${publicRead}
${receiptAfterCommit ? "" : `select current_setting('voca.content_manifest')::jsonb || jsonb_build_object('environment',${literal(environment)},'mode',${literal(mode)});`}
${mode === "rehearse" ? "rollback" : "commit"};
select ${receiptAfterCommit ? "current_setting('voca.content_manifest')::jsonb || jsonb_build_object('environment'," + literal(environment) + ",'mode'," + literal(mode) + ") || " : ""}jsonb_build_object('outcome',${literal(mode === "apply" ? "committed" : mode === "rehearse" ? "rolled_back" : "read_only")}) as result;
`;
}

function argumentsFor(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    assert(argv[i].startsWith("--") && !flags.has(argv[i]), `Tham số không hợp lệ: ${argv[i]}`);
    if (["--owner", "--reviewer", "--manifest", "--thumbnail-url"].includes(argv[i])) {
      const key = argv[i];
      assert(argv[i + 1] && !argv[i + 1].startsWith("--"), `${key}: thiếu giá trị`);
      flags.set(key, argv[++i]);
    } else {
      assert(["--local", "--production", "--validate", "--dry-run", "--rehearse", "--apply", "--postflight", "--owner-approved-production"].includes(argv[i]), `Tham số không hỗ trợ: ${argv[i]}`);
      flags.set(argv[i], true);
    }
  }
  return flags;
}

export function run(argv = process.argv.slice(2)) {
  const flags = argumentsFor(argv);
  const data = JSON.parse(readFileSync(CONTENT_PATH, "utf8"));
  const counts = validateContent(data);
  if (flags.has("--validate")) {
    assert(flags.size === 1, "--validate không nhận tham số database");
    console.log(JSON.stringify({ status: "valid", counts }, null, 2));
    return;
  }
  const environments = ["local", "production"].filter((name) => flags.has(`--${name}`));
  const modes = ["dry-run", "rehearse", "apply", "postflight"].filter((name) => flags.has(`--${name}`));
  assert(environments.length === 1 && modes.length === 1, "Chọn --local|--production và --dry-run|--rehearse|--apply|--postflight");
  const environment = environments[0];
  const mode = modes[0];
  const owner = flags.get("--owner");
  const reviewer = flags.get("--reviewer");
  let manifest;
  let receiptPath;
  if (mode === "apply" || mode === "rehearse" || mode === "postflight") {
    text(flags.get("--manifest"), "--manifest");
    receiptPath = resolve(flags.get("--manifest"));
    if (mode === "postflight") {
      const entries = readFileSync(receiptPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
      assert(entries.at(-1)?.outcome === "committed", "Manifest không có xác nhận commit");
      manifest = entries[0];
      assert(manifest.environment === environment && manifest.slug === data.slug, "Manifest sai môi trường hoặc slug");
    }
  }
  if (environment === "production") {
    assert(mode !== "rehearse", "Rehearsal chỉ được chạy local");
    if (mode === "apply") assert(flags.has("--owner-approved-production"), "Dừng: production apply cần Owner duyệt riêng trong chat");
    const direct = process.env.PGHOST === `db.${PROJECT_REF}.supabase.co` && process.env.PGUSER === "postgres";
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(process.env.PGHOST ?? "")
      && process.env.PGUSER === `postgres.${PROJECT_REF}` && process.env.PGPORT === "5432";
    assert(direct || pooler, "PGHOST/PGUSER phải trỏ đúng project; chỉ dùng direct hoặc session pooler 5432");
    assert(process.env.PGDATABASE === "postgres" && ["require", "verify-full"].includes(process.env.PGSSLMODE), "Production cần PGDATABASE=postgres và PGSSLMODE=require|verify-full");
  }
  const thumbnailUrl = flags.get("--thumbnail-url") ?? manifest?.thumbnail_url ?? null;
  const sql = buildSql({ data, owner, reviewer, mode, environment, manifest, thumbnailUrl });
  let fd;
  try {
    if (mode === "apply" || mode === "rehearse") {
      mkdirSync(dirname(receiptPath), { recursive: true });
      // stdout của psql đi thẳng vào file, ghi đủ ID trước COMMIT. Không ghi đè receipt cũ;
      // mất kết nối lúc COMMIT phải được đối soát read-only, tuyệt đối không tự chạy apply lại.
      fd = openSync(receiptPath, "wx", 0o600);
    }
    const psqlArgs = ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", "-"];
    const result = spawnSync(environment === "local" ? "docker" : "psql",
      environment === "local" ? ["exec", "-i", "supabase_db_voca_space", "psql", "-U", "postgres", "-d", "postgres", ...psqlArgs] : psqlArgs,
      { input: sql, encoding: "utf8", windowsHide: true, env: { ...process.env, PGCLIENTENCODING: "UTF8" },
        stdio: ["pipe", fd ?? "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 });
    if (fd !== undefined) { closeSync(fd); fd = undefined; }
    if (result.error || result.status !== 0) {
      let message = result.error?.message ?? result.stderr?.trim() ?? `psql exit ${result.status}`;
      if (process.env.PGPASSWORD) message = message.replaceAll(process.env.PGPASSWORD, "[REDACTED]");
      throw new Error(`${message}\nKhông retry. Transaction không commit sẽ rollback; lỗi kết nối quanh COMMIT cần đối soát trước. Receipt: ${receiptPath ?? "không có"}`);
    }
    const output = receiptPath && mode !== "postflight" ? readFileSync(receiptPath, "utf8") : result.stdout;
    console.log(output.trim());
    if (receiptPath) console.log(`Receipt IDs: ${receiptPath}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
