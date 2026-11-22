import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { assertIsolatedRuntime, getWorkerScope, workerId } from "./support/worker-scope.mjs";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

test("worker IDs are valid UUIDs, stable, and differ per worker and per name", () => {
  const a = workerId(0, "course");
  assert.match(a, uuidV4);
  assert.equal(a, workerId(0, "course"));
  assert.notEqual(a, workerId(1, "course"));
  assert.notEqual(a, workerId(0, "chapter"));
});

test("worker scopes share no ID, email, username or slug", () => {
  const names = ["course", "chapter", "topic", "collaborator"];
  const values = new Map();
  for (const index of [0, 1, 2, 3]) {
    const scope = getWorkerScope(index);
    const own = [
      ...names.map((name) => scope.id(name)),
      scope.teacher.id,
      scope.teacher.email,
      scope.teacher.username,
      scope.student.id,
      scope.student.email,
      scope.student.username,
      scope.slug("course"),
    ];
    for (const value of own) {
      assert.equal(values.has(value), false, `${value} is used by worker ${values.get(value)} and ${index}`);
      values.set(value, index);
    }
  }
});

test("worker IDs never collide with a seed.sql UUID", () => {
  const seed = readFileSync(resolve(import.meta.dirname, "../../supabase/seed.sql"), "utf8");
  const ids = new Set(seed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)?.map((id) => id.toLowerCase()));
  assert.ok(ids.size > 0);
  for (const id of ids) assert.equal(id.startsWith("e2e"), false, `seed id ${id} uses the worker prefix`);
  for (const index of [0, 1, 2, 3]) {
    const scope = getWorkerScope(index);
    assert.equal(ids.has(scope.teacher.id), false);
    assert.equal(ids.has(scope.student.id), false);
  }
});

test("an invalid parallel index is rejected", () => {
  assert.throws(() => getWorkerScope(-1));
  assert.throws(() => getWorkerScope(1.5));
  assert.throws(() => getWorkerScope(undefined));
});

test("only the isolated runtime passes the guard", () => {
  const ok = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:45441", E2E_SUPABASE_WORKDIR: ".e2e-runtime" };
  assert.doesNotThrow(() => assertIsolatedRuntime(ok));
  assert.throws(() => assertIsolatedRuntime({ ...ok, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:45321" }));
  assert.throws(() => assertIsolatedRuntime({ ...ok, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }));
  assert.throws(() => assertIsolatedRuntime({ ...ok, E2E_SUPABASE_WORKDIR: "supabase" }));
  assert.throws(() => assertIsolatedRuntime({}));
});
