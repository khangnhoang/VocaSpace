import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import {
  cp9AppServerProtocolSchemaSha256,
  createCodexAppServerStdioTransport,
  resolveCodexExecutable,
} from "./lib/skill-evals/codex-app-server-stdio-transport-v2.mjs";

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("unresolved executable fails before process launch", () => {
  assert.throws(() => resolveCodexExecutable("Z:/missing/codex.exe"), { code: "CODEX_EXECUTABLE_UNRESOLVED" });
});

test("access denial remains runtime_confirmed_not_started", async () => {
  let launches = 0;
  const transport = createCodexAppServerStdioTransport({
    executable: process.execPath,
    spawnProcess: () => {
      launches += 1;
      const child = processSkeleton();
      queueMicrotask(() => Object.assign(new Error("Access is denied"), { code: "EACCES" }) && child.emit("error", Object.assign(new Error("Access is denied"), { code: "EACCES" })));
      return child;
    },
  });
  await assert.rejects(transport.preflight(), (error) => error.code === "APP_SERVER_LAUNCH_DENIED" && error.runtimeStatus === "runtime_confirmed_not_started" && error.osCode === "EACCES");
  assert.equal(launches, 1);
  await assert.rejects(transport.preflight(), { code: "APP_SERVER_LAUNCH_DENIED" });
  assert.equal(launches, 1, "denied executable must not be repeatedly launched");
});

test("protocol readiness failure performs zero turn dispatches", async () => {
  const fake = protocolProcess({ failInitialize: true });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  await assert.rejects(transport.preflight(), { code: "APP_SERVER_RPC_ERROR" });
  assert.equal(fake.methods.filter((method) => method === "turn/start").length, 0);
});

test("preflight proves readiness without thread or turn creation", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const result = await transport.preflight();
  assert.equal(result.protocol_readiness, "ready");
  assert.equal(result.model_calls_dispatched, 0);
  assert.deepEqual(fake.methods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
});

test("App Server wire omits jsonrpc and follows thread/start then turn/start", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-1", method: "thread/start", params: threadParams() }) });
  const events = [];
  const turn = await transport.startTurn({ onEvent: (event) => events.push(event), requestBytes: jsonl({ id: "turn-1", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.deepEqual(fake.messages.map((message) => Object.hasOwn(message, "jsonrpc")), Array(fake.messages.length).fill(false));
  assert.deepEqual(fake.methods.slice(-2), ["thread/start", "turn/start"]);
  const threadRequest = fake.messages.find((message) => message.method === "thread/start");
  const turnRequest = fake.messages.find((message) => message.method === "turn/start");
  assert.equal(threadRequest.params.sandbox, undefined, "direct transport preserves already-compiled request bytes");
  assert.equal(turnRequest.params.sandboxPolicy, "read-only", "direct transport does not rewrite adapter-owned request bytes");
  assert.equal(events.filter((event) => event.event_type === "turn_start_write_completed").length, 1);
  assert.deepEqual(turn.output, { observation: "ok" });
});

test("instructionSources paths are locally hash-bound before turn dispatch", async () => {
  const fake = protocolProcess({ instructionSourcePath: process.execPath });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-sources", method: "thread/start", params: threadParams() }) });
  assert.equal(thread.instruction_sources[0].path.replaceAll("\\", "/"), process.execPath.replaceAll("\\", "/"));
  assert.match(thread.instruction_sources[0].sha256, /^[a-f0-9]{64}$/);
});

test("early notifications retain exact observed usage", async () => {
  const fake = protocolProcess({ usage: { inputTokens: 11, outputTokens: 7 } });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-usage", method: "thread/start", params: threadParams() }) });
  const turn = await transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-usage", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.equal(turn.measurement.token_usage.status, "observed");
  assert.equal(turn.measurement.token_usage.event_count, 1);
  assert.match(turn.measurement.token_usage.event_json, /inputTokens/);
});

test("missing usage is reported unavailable", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-no-usage", method: "thread/start", params: threadParams() }) });
  const turn = await transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-no-usage", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.deepEqual(turn.measurement.token_usage, { status: "unavailable" });
});

test("mismatched early notification ownership fails closed", async () => {
  const fake = protocolProcess({ wrongThread: true });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-owner", method: "thread/start", params: threadParams() }) });
  await assert.rejects(
    transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-owner", method: "turn/start", params: turnParams(thread.thread_id) }) }),
    { code: "APP_SERVER_PROTOCOL_OWNERSHIP_INVALID" },
  );
  assert.equal(fake.methods.filter((method) => method === "turn/start").length, 1);
});

test("wire messages carrying jsonrpc are rejected before write", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  await assert.rejects(transport.startThread({ requestBytes: jsonl({ id: "bad", jsonrpc: "2.0", method: "thread/start", params: threadParams() }) }), { code: "APP_SERVER_PROTOCOL_INVALID" });
  assert.equal(fake.methods.includes("thread/start"), false);
});

test("protocol identity is a stable SHA-256", () => assert.match(cp9AppServerProtocolSchemaSha256, /^[a-f0-9]{64}$/));

for (const entry of tests) {
  try {
    await entry.run();
    process.stdout.write(`ok - ${entry.name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${entry.name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

function processSkeleton() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => true;
  return child;
}

function protocolProcess({ failInitialize = false, instructionSourcePath = null, usage = null, wrongThread = false } = {}) {
  const child = processSkeleton();
  child.pid = 9001;
  const messages = [];
  const methods = [];
  child.stdin = new Writable({
    write(chunk, _encoding, done) {
      const message = JSON.parse(Buffer.from(chunk).toString("utf8"));
      messages.push(message);
      methods.push(message.method);
      queueMicrotask(() => respond(message));
      done();
    },
  });
  function send(value) { child.stdout.write(jsonl(value)); }
  function respond(message) {
    if (message.method === "initialized") return;
    if (message.method === "initialize") return send(failInitialize ? { error: { message: "not ready" }, id: message.id } : { id: message.id, result: { platformFamily: "windows", platformOs: "windows", userAgent: "codex-test/1" } });
    if (message.method === "account/read") return send({ id: message.id, result: { account: { type: "chatgpt" } } });
    if (message.method === "model/list") return send({ id: message.id, result: { data: [{ id: "gpt-5.6-sol", supportedReasoningEfforts: [{ reasoningEffort: "high" }] }] } });
    if (message.method === "config/read") return send({ id: message.id, result: { config: { approval_policy: "never" } } });
    if (message.method === "thread/start") return send({ id: message.id, result: { instructionSources: instructionSourcePath ? [instructionSourcePath] : [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }], thread: { id: `server-${message.id}` } } });
    if (message.method === "turn/start") {
      const threadId = message.params.threadId;
      const turnId = `server-${message.id}`;
      send({ id: message.id, result: { turn: { id: turnId, items: [], status: "inProgress" } } });
      send({ method: "item/completed", params: { item: { id: "agent-1", text: JSON.stringify({ observation: "ok" }), type: "agentMessage" }, threadId: wrongThread ? "wrong-thread" : threadId, turnId } });
      if (usage) send({ method: "thread/tokenUsage/updated", params: { threadId, tokenUsage: usage, turnId } });
      send({ method: "turn/completed", params: { threadId, turn: { id: turnId, items: [], status: "completed" }, turnId } });
    }
  }
  return { child, messages, methods };
}

function jsonl(value) { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function threadParams() { return { approvalPolicy: "never", cwd: "C:/VocaSpace", ephemeral: false, model: "gpt-5.6-sol", sandboxPolicy: "read-only", settings: {} }; }
function turnParams(threadId) { return { approvalPolicy: "never", cwd: "C:/VocaSpace", effort: "high", input: [{ text: "compiled harness input", type: "text" }], model: "gpt-5.6-sol", outputSchema: { type: "object" }, sandboxPolicy: "read-only", settings: {}, threadId }; }
