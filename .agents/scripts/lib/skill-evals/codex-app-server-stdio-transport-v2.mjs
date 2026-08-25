import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join, resolve } from "node:path";
import { canonicalJson, canonicalJsonLine, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import { HarnessError, assertRuntimeCredentialFree } from "./harness-schema-v2.mjs";

const maximumJsonlBytes = 262_144;
const maximumStderrBytes = 16_384;
const defaultTimeoutMs = 15_000;

export const cp9AppServerProtocolContract = Object.freeze({
  framing: "jsonl",
  initialize: "initialize/initialized",
  requests: ["account/read", "config/read", "model/list", "thread/start", "turn/interrupt", "turn/start"],
  retained_notifications: ["item/completed", "thread/tokenUsage/updated", "turn/completed"],
  transport: "stdio",
  wire_header: "jsonrpc-omitted",
});

export const cp9AppServerProtocolSchemaSha256 = sha256Canonical(cp9AppServerProtocolContract);

export function resolveCodexExecutable(
  executable,
  {
    environment = process.env,
    platform = process.platform,
  } = {},
) {
  if (typeof executable !== "string" || executable.trim() !== executable || executable.length === 0) {
    fail("CODEX_EXECUTABLE_UNRESOLVED", "A non-empty explicit Codex executable path or name is required.", 4);
  }
  const candidates = [];
  if (isAbsolute(executable) || executable.includes("/") || executable.includes("\\")) {
    candidates.push(resolve(executable));
  } else {
    const extensions = platform === "win32"
      ? [...new Set(["", ...(environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((value) => value.toLowerCase())])]
      : [""];
    for (const directory of (environment.PATH ?? "").split(delimiter).filter(Boolean)) {
      for (const extension of extensions) {
        const suffix = extname(executable) === "" ? extension : "";
        candidates.push(resolve(directory, `${executable}${suffix}`));
      }
    }
  }
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    let selected;
    try {
      selected = realpathSync(candidate);
      if (!statSync(selected).isFile()) continue;
      accessSync(selected, platform === "win32" ? constants.F_OK : constants.X_OK);
    } catch {
      continue;
    }
    const bytes = readFileSync(selected);
    return Object.freeze({
      executable_path: selected.replaceAll("\\", "/"),
      executable_sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  fail("CODEX_EXECUTABLE_UNRESOLVED", `Unable to resolve the exact Codex executable '${executable}'.`, 4);
}

export function createCodexAppServerStdioTransport({
  executable,
  expectedRuntime = null,
  now = () => new Date().toISOString(),
  requestTimeoutMs = defaultTimeoutMs,
  spawnProcess = spawn,
  startupTimeoutMs = defaultTimeoutMs,
} = {}) {
  const resolution = resolveCodexExecutable(executable);
  assertPositiveTimeout(startupTimeoutMs, "startupTimeoutMs");
  assertPositiveTimeout(requestTimeoutMs, "requestTimeoutMs");
  if (expectedRuntime !== null) assertExpectedRuntime(expectedRuntime, resolution);

  let child = null;
  let launchFailure = null;
  let ready = null;
  let stdoutBuffer = Buffer.alloc(0);
  let stderrText = "";
  let activeTurn = null;
  let pendingTurnOwner = null;
  let earlyTurnNotifications = [];
  let earlyTurnFailure = null;
  const pending = new Map();
  const state = {
    executable_resolution: "resolved",
    process_launch: "not_started",
    protocol_readiness: "not_started",
    thread_creation: "not_started",
    turn_dispatch: "not_started",
  };

  const launch = async () => {
    if (launchFailure) throw launchFailure;
    if (child) return child;
    state.process_launch = "starting";
    try {
      child = spawnProcess(resolution.executable_path, ["app-server", "--listen", "stdio://"], {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      launchFailure = launchError(error);
      state.process_launch = "denied";
      throw launchFailure;
    }
    bindProcess(child);
    try {
      await waitForSpawn(child, startupTimeoutMs);
    } catch (error) {
      launchFailure = launchError(error);
      state.process_launch = launchFailure.code === "APP_SERVER_LAUNCH_DENIED" ? "denied" : "failed";
      throw launchFailure;
    }
    state.process_launch = "started";
    return child;
  };

  const ensureReady = async () => {
    if (ready) return ready;
    await launch();
    state.protocol_readiness = "initializing";
    try {
      const initialize = await request({
        id: "cp9-initialize",
        method: "initialize",
        params: { clientInfo: { name: "vocaspace_skill_eval_harness", title: "VocaSpace Skill Eval Harness", version: "2" } },
      }, startupTimeoutMs);
      const initializedAt = now();
      await notify({ method: "initialized", params: {} });
      const account = await request({
        id: "cp9-account-read",
        method: "account/read",
        params: { refreshToken: false },
      }, startupTimeoutMs);
      if (account?.account?.type !== "chatgpt") {
        fail("APP_SERVER_AUTH_MODE_FORBIDDEN", "CP9 requires active ChatGPT-managed authentication; no fallback is permitted.", 4);
      }
      const models = await request({
        id: "cp9-model-list",
        method: "model/list",
        params: { includeHidden: true, limit: 100 },
      }, startupTimeoutMs);
      const config = await request({
        id: "cp9-config-read",
        method: "config/read",
        params: { includeLayers: false },
      }, startupTimeoutMs);
      assertRuntimeCredentialFree(config?.config ?? {});
      const model = expectedRuntime?.model ?? "gpt-5.6-sol";
      const effort = expectedRuntime?.effort ?? "medium";
      const modelEntry = models?.data?.find((entry) => entry?.id === model || entry?.model === model);
      if (!modelEntry) fail("APP_SERVER_MODEL_UNAVAILABLE", `Configured CP9 model '${model}' is unavailable.`, 4);
      const efforts = modelEntry.supportedReasoningEfforts?.map((entry) => entry.reasoningEffort) ?? [];
      if (efforts.length > 0 && !efforts.includes(effort)) {
        fail("APP_SERVER_EFFORT_UNAVAILABLE", `Configured CP9 effort '${effort}' is unavailable for '${model}'.`, 4);
      }
      const configSha256 = sha256Canonical(config?.config ?? {});
      if (expectedRuntime && configSha256 !== expectedRuntime.config_sha256) {
        fail("APP_SERVER_RUNTIME_MISMATCH", "Effective App Server config hash differs from the compiled runtime.", 4);
      }
      ready = Object.freeze({
        account_type: "chatgpt",
        codex_version: normalizeUserAgent(initialize?.userAgent),
        config_sha256: configSha256,
        initialized_at: initializedAt,
        model,
        effort,
        platform: normalizePlatform(initialize),
      });
      state.protocol_readiness = "ready";
      return ready;
    } catch (error) {
      state.protocol_readiness = "failed";
      const failure = asRuntimeFailure(error, "APP_SERVER_PROTOCOL_NOT_READY", "Codex App Server protocol readiness failed.");
      failure.runtimeStatus ??= "runtime_confirmed_not_started";
      throw failure;
    }
  };

  function bindProcess(processHandle) {
    if (!processHandle?.stdin || !processHandle?.stdout || !processHandle?.stderr) {
      throw new HarnessError("APP_SERVER_LAUNCH_INVALID", "Launched App Server process lacks piped stdio.", 4);
    }
    processHandle.stdout.on("data", (chunk) => receiveStdout(Buffer.from(chunk)));
    processHandle.stderr.on("data", (chunk) => {
      stderrText = `${stderrText}${Buffer.from(chunk).toString("utf8")}`.slice(-maximumStderrBytes);
    });
    processHandle.on("error", (error) => rejectAll(launchError(error)));
    processHandle.on("exit", (code, signal) => {
      rejectAll(runtimeFailure(
        "APP_SERVER_PROCESS_EXITED",
        `Codex App Server exited before the active protocol operation completed (code=${code}, signal=${signal}).`,
        { stderr: stderrText },
      ));
    });
  }

  function receiveStdout(chunk) {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    if (stdoutBuffer.length > maximumJsonlBytes * 2) {
      rejectAll(runtimeFailure("APP_SERVER_PROTOCOL_INVALID", "App Server JSONL buffer exceeded its bound."));
      return;
    }
    while (true) {
      const newline = stdoutBuffer.indexOf(0x0a);
      if (newline < 0) break;
      const line = stdoutBuffer.subarray(0, newline + 1);
      stdoutBuffer = stdoutBuffer.subarray(newline + 1);
      if (line.length <= 1 || line.length > maximumJsonlBytes) {
        rejectAll(runtimeFailure("APP_SERVER_PROTOCOL_INVALID", "App Server emitted an invalid JSONL record."));
        continue;
      }
      let message;
      try {
        message = parseStrictJson(line, "App Server message");
        assertRuntimeCredentialFree(message);
      } catch (error) {
        rejectAll(asRuntimeFailure(error, "APP_SERVER_PROTOCOL_INVALID", "App Server emitted invalid JSON."));
        continue;
      }
      if (Object.hasOwn(message, "id")) settleResponse(message);
      else handleNotification(message, line);
    }
  }

  function settleResponse(message) {
    const entry = pending.get(message.id);
    if (!entry) {
      rejectAll(runtimeFailure("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server response has no exact outstanding request owner."));
      return;
    }
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (Object.hasOwn(message, "error")) {
      entry.reject(runtimeFailure("APP_SERVER_RPC_ERROR", `App Server ${entry.method} failed: ${message.error?.message ?? "unknown error"}.`));
      return;
    }
    if (!Object.hasOwn(message, "result")) {
      entry.reject(runtimeFailure("APP_SERVER_PROTOCOL_INVALID", `App Server ${entry.method} response has no result.`));
      return;
    }
    entry.resolve(message.result);
  }

  function handleNotification(message, bytes) {
    if (typeof message?.method !== "string") return;
    if (!activeTurn) {
      if (
        pendingTurnOwner &&
        ["item/completed", "thread/tokenUsage/updated", "turn/completed"].includes(message.method)
      ) {
        if (Object.hasOwn(message.params ?? {}, "threadId") && message.params.threadId !== pendingTurnOwner.threadId) {
          earlyTurnFailure = runtimeFailure("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "Early App Server notification substituted another thread.");
          return;
        }
        if (earlyTurnNotifications.length >= 128) {
          rejectAll(runtimeFailure("APP_SERVER_PROTOCOL_INVALID", "Early App Server turn notifications exceeded their bound."));
          return;
        }
        earlyTurnNotifications.push({ bytes: Buffer.from(bytes), message });
      }
      return;
    }
    const { threadId, turnId } = activeTurn;
    if (message.method === "item/completed") {
      assertOptionalOwner(message.params, threadId, turnId);
      if (message.params?.item?.type === "agentMessage" && typeof message.params.item.text === "string") {
        activeTurn.agentText = message.params.item.text;
      }
      return;
    }
    if (message.method === "thread/tokenUsage/updated") {
      assertOptionalOwner(message.params, threadId, turnId);
      activeTurn.usageEvents.push(Buffer.from(bytes));
      return;
    }
    if (message.method !== "turn/completed") return;
    assertOptionalOwner(message.params, threadId, turnId);
    const turn = message.params?.turn;
    if (!turn || turn.id !== turnId || !["completed", "interrupted", "failed"].includes(turn.status)) {
      activeTurn.reject(runtimeFailure("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "turn/completed substituted the active turn owner or status."));
      activeTurn = null;
      return;
    }
    const completed = activeTurn;
    activeTurn = null;
    completed.resolve({
      agentText: completed.agentText,
      bytes: Buffer.from(bytes),
      turn,
      usageEvents: completed.usageEvents,
    });
  }

  async function request(message, timeoutMs = requestTimeoutMs, onWritten = null) {
    await launch();
    assertOutboundMessage(message, true);
    if (pending.has(message.id)) fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server request id is already active.", 4);
    const response = new Promise((resolveValue, rejectValue) => {
      const timer = setTimeout(() => {
        pending.delete(message.id);
        rejectValue(runtimeFailure("APP_SERVER_PROTOCOL_TIMEOUT", `App Server ${message.method} timed out.`));
      }, timeoutMs);
      pending.set(message.id, { method: message.method, reject: rejectValue, resolve: resolveValue, timer });
    });
    try {
      await writeBytes(Buffer.from(canonicalJsonLine(message), "utf8"));
      if (onWritten) onWritten();
    } catch (error) {
      const entry = pending.get(message.id);
      if (entry) clearTimeout(entry.timer);
      pending.delete(message.id);
      throw asRuntimeFailure(error, "APP_SERVER_WRITE_FAILED", `App Server ${message.method} write failed.`);
    }
    return response;
  }

  async function requestExact(bytes, timeoutMs, onWritten) {
    const message = parseExactRequest(bytes);
    await launch();
    if (pending.has(message.id)) fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server request id is already active.", 4);
    const response = new Promise((resolveValue, rejectValue) => {
      const timer = setTimeout(() => {
        pending.delete(message.id);
        rejectValue(runtimeFailure("APP_SERVER_PROTOCOL_TIMEOUT", `App Server ${message.method} timed out.`));
      }, timeoutMs);
      pending.set(message.id, { method: message.method, reject: rejectValue, resolve: resolveValue, timer });
    });
    try {
      await writeBytes(bytes);
      onWritten?.(message);
    } catch (error) {
      const entry = pending.get(message.id);
      if (entry) clearTimeout(entry.timer);
      pending.delete(message.id);
      throw asRuntimeFailure(error, "APP_SERVER_WRITE_FAILED", `App Server ${message.method} write failed.`);
    }
    return { message, response };
  }

  async function notify(message) {
    assertOutboundMessage(message, false);
    await writeBytes(Buffer.from(canonicalJsonLine(message), "utf8"));
  }

  async function writeBytes(bytes) {
    if (!child?.stdin?.writable) throw runtimeFailure("APP_SERVER_WRITE_FAILED", "App Server stdin is not writable.");
    await new Promise((resolveValue, rejectValue) => {
      const onError = (error) => {
        child.stdin.off("drain", onDrain);
        rejectValue(error);
      };
      const onDrain = () => {
        child.stdin.off("error", onError);
        resolveValue();
      };
      child.stdin.once("error", onError);
      const accepted = child.stdin.write(bytes, () => {
        if (accepted) {
          child.stdin.off("error", onError);
          resolveValue();
        }
      });
      if (!accepted) child.stdin.once("drain", onDrain);
    });
  }

  function rejectAll(error) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
    if (activeTurn) {
      activeTurn.reject(error);
      activeTurn = null;
    }
  }

  return {
    kind: "codex_app_server_stdio",
    resolution,
    async abortAttempt() {
      return { confirmed_not_started: activeTurn === null && state.turn_dispatch !== "writing" };
    },
    async close() {
      if (!child) return;
      child.kill();
      child = null;
    },
    getLaunchState() {
      return structuredClone(state);
    },
    async preflight() {
      const readiness = await ensureReady();
      return { ...structuredClone(state), ...structuredClone(readiness), ...structuredClone(resolution), model_calls_dispatched: 0 };
    },
    async inspectRuntime() {
      const readiness = await ensureReady();
      if (!expectedRuntime) fail("APP_SERVER_RUNTIME_MISMATCH", "A compiled runtime is required before CP8A dispatch.", 4);
      return {
        authMode: "chatgpt",
        codexVersion: readiness.codex_version,
        configSha256: readiness.config_sha256,
        effectivePolicy: structuredClone(expectedRuntime.effective_policy),
        effort: readiness.effort,
        executablePath: resolution.executable_path,
        executableSha256: resolution.executable_sha256,
        instructionSources: structuredClone(expectedRuntime.instruction_sources),
        model: readiness.model,
        platform: readiness.platform,
        protocolSchemaSha256: cp9AppServerProtocolSchemaSha256,
        runtimeIdentity: `codex-app-server-${resolution.executable_sha256.slice(0, 24)}`,
      };
    },
    async startThread({ requestBytes }) {
      await ensureReady();
      state.thread_creation = "starting";
      const { message, response } = await requestExact(requestBytes, requestTimeoutMs);
      if (message.method !== "thread/start") fail("APP_SERVER_PROTOCOL_INVALID", "startThread requires thread/start bytes.", 4);
      let result;
      try {
        result = await response;
      } catch (error) {
        state.thread_creation = "failed";
        throw error;
      }
      const thread = result?.thread;
      const instructionSources = result?.instructionSources ?? thread?.instructionSources;
      if (!thread || typeof thread.id !== "string" || !Array.isArray(instructionSources)) {
        state.thread_creation = "failed";
        fail("APP_SERVER_THREAD_INVALID", "thread/start returned an invalid thread or instructionSources set.", 4);
      }
      state.thread_creation = "created";
      return {
        instruction_sources: instructionSources.map(normalizeInstructionSource),
        request_id: message.id,
        session_id: typeof thread.sessionId === "string" ? thread.sessionId : thread.id,
        thread_id: thread.id,
      };
    },
    async startTurn({ onEvent, requestBytes }) {
      await ensureReady();
      if (activeTurn) fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "Only one exact CP9 turn may be active per transport.", 4);
      const startedAt = now();
      state.turn_dispatch = "writing";
      const parsedRequest = parseExactRequest(requestBytes);
      pendingTurnOwner = { requestId: parsedRequest.id, threadId: parsedRequest.params.threadId };
      earlyTurnNotifications = [];
      earlyTurnFailure = null;
      const { message, response } = await requestExact(requestBytes, requestTimeoutMs);
      if (message.method !== "turn/start") fail("APP_SERVER_PROTOCOL_INVALID", "startTurn requires turn/start bytes.", 4);
      state.turn_dispatch = "written";
      const result = await response;
      const turn = result?.turn;
      if (earlyTurnFailure) throw earlyTurnFailure;
      if (!turn || typeof turn.id !== "string" || turn.status !== "inProgress") {
        fail("APP_SERVER_TURN_INVALID", "turn/start returned an invalid active turn.", 4);
      }
      const threadId = parsedRequest.params.threadId;
      const turnId = turn.id;
      const writeEventBytes = syntheticEvent({ bytes_written: true, requestId: message.id, threadId, turnId });
      const ackEventBytes = syntheticEvent({ requestId: message.id, threadId, turnId });
      onEvent({ event_bytes: writeEventBytes, event_type: "turn_start_write_completed", status: "written", turn_id: turnId });
      onEvent({ event_bytes: ackEventBytes, event_type: "turn_start_acknowledged", status: "acknowledged", turn_id: turnId });
      const terminalPromise = new Promise((resolveValue, rejectValue) => {
        const timer = setTimeout(() => {
          if (activeTurn?.turnId === turnId) activeTurn = null;
          rejectValue(runtimeFailure("APP_SERVER_TURN_TIMEOUT", "App Server turn completion timed out."));
        }, requestTimeoutMs);
        activeTurn = {
          agentText: finalAgentText(turn.items),
          reject: (error) => { clearTimeout(timer); rejectValue(error); },
          resolve: (value) => { clearTimeout(timer); resolveValue(value); },
          threadId,
          turnId,
          usageEvents: [],
        };
      });
      const queued = earlyTurnNotifications;
      earlyTurnNotifications = [];
      pendingTurnOwner = null;
      for (const notification of queued) handleNotification(notification.message, notification.bytes);
      const terminal = await terminalPromise;
      state.turn_dispatch = terminal.turn.status;
      if (terminal.turn.status !== "completed") {
        throw runtimeFailure("APP_SERVER_TURN_FAILED", `App Server turn finished with status '${terminal.turn.status}'.`);
      }
      const text = terminal.agentText ?? finalAgentText(terminal.turn.items);
      const outputText = text ?? terminal.turn.items?.filter((item) => item?.type === "agentMessage").at(-1)?.text;
      if (typeof outputText !== "string") fail("APP_SERVER_OUTPUT_INVALID", "Completed turn lacks an authoritative agentMessage output.", 4);
      let output;
      try {
        output = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(outputText, "utf8")));
      } catch (error) {
        throw asRuntimeFailure(error, "APP_SERVER_OUTPUT_INVALID", "App Server structured output is invalid JSON.");
      }
      const usageEvents = terminal.usageEvents ?? [];
      const usage = usageEvents.length === 0
        ? { status: "unavailable" }
        : {
            event_count: usageEvents.length,
            event_json: usageEvents.at(-1).toString("utf8"),
            event_sha256: sha256Bytes(usageEvents.at(-1)),
            status: "observed",
          };
      const completedEventBytes = syntheticEvent({ status: "completed", threadId, turnId });
      return {
        ack_event_bytes: ackEventBytes,
        completed_event_bytes: completedEventBytes,
        measurement: {
          dispatch_started_at: startedAt,
          input_bytes: Buffer.byteLength(canonicalJson(message.params.input), "utf8"),
          request_bytes: requestBytes.length,
          semantic_output_bytes: Buffer.byteLength(outputText, "utf8"),
          terminal_at: now(),
          token_usage: usage,
        },
        output,
        request_id: message.id,
        terminal_status: "completed",
        thread_id: threadId,
        turn_id: turnId,
        wire_request_sha256: sha256Bytes(requestBytes),
        write_event_bytes: writeEventBytes,
      };
    },
    async interruptTurn({ requestBytes }) {
      const { message, response } = await requestExact(requestBytes, requestTimeoutMs);
      if (message.method !== "turn/interrupt") fail("APP_SERVER_PROTOCOL_INVALID", "interruptTurn requires turn/interrupt bytes.", 4);
      await response;
      return {
        accepted: true,
        ack_event_bytes: syntheticEvent({ accepted: true, requestId: message.id, threadId: message.params.threadId, turnId: message.params.turnId }),
        terminal_status: "accepted",
      };
    },
  };
}

function waitForSpawn(child, timeoutMs) {
  if (Number.isInteger(child.pid) && child.pid > 0) return Promise.resolve();
  return new Promise((resolveValue, rejectValue) => {
    const timer = setTimeout(() => rejectValue(new Error("App Server process launch timed out.")), timeoutMs);
    child.once("spawn", () => { clearTimeout(timer); resolveValue(); });
    child.once("error", (error) => { clearTimeout(timer); rejectValue(error); });
  });
}

function parseExactRequest(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maximumJsonlBytes || bytes.at(-1) !== 0x0a || bytes.subarray(0, -1).includes(0x0a)) {
    fail("APP_SERVER_PROTOCOL_INVALID", "Outbound App Server request must be one bounded JSONL record.", 4);
  }
  const message = parseStrictJson(bytes, "App Server request");
  assertOutboundMessage(message, true);
  return message;
}

function assertOutboundMessage(message, request) {
  if (message?.method === "account/read") {
    if (canonicalJson(message.params) !== canonicalJson({ refreshToken: false })) {
      fail("APP_SERVER_PROTOCOL_INVALID", "account/read may only request a non-refreshing account view.", 4);
    }
    assertRuntimeCredentialFree({ ...message, params: {} });
  } else {
    assertRuntimeCredentialFree(message);
  }
  if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.method !== "string" || !message.params || typeof message.params !== "object") {
    fail("APP_SERVER_PROTOCOL_INVALID", "Outbound App Server message is invalid.", 4);
  }
  if (Object.hasOwn(message, "jsonrpc")) fail("APP_SERVER_PROTOCOL_INVALID", "Codex App Server wire messages must omit jsonrpc.", 4);
  if (request !== Object.hasOwn(message, "id")) fail("APP_SERVER_PROTOCOL_INVALID", "App Server request/notification id ownership is invalid.", 4);
}

function assertExpectedRuntime(runtime, resolution) {
  const fields = ["config_sha256", "effective_policy", "effort", "executable_sha256", "instruction_sources", "model"];
  if (!runtime || typeof runtime !== "object" || fields.some((field) => !Object.hasOwn(runtime, field))) {
    fail("APP_SERVER_RUNTIME_MISMATCH", "Compiled CP9 behavior runtime is incomplete.", 4);
  }
  if (runtime.executable_sha256 !== resolution.executable_sha256) {
    fail("APP_SERVER_RUNTIME_MISMATCH", "Resolved Codex executable bytes differ from the compiled runtime.", 4);
  }
  if (runtime.protocol_schema_sha256 !== cp9AppServerProtocolSchemaSha256) {
    fail("APP_SERVER_RUNTIME_MISMATCH", "Compiled App Server protocol schema differs from the CP9 client contract.", 4);
  }
}

function normalizeInstructionSource(source) {
  if (typeof source === "string") {
    let path;
    try {
      path = realpathSync(source);
      if (!statSync(path).isFile()) throw new Error("not a regular file");
    } catch {
      fail("APP_SERVER_THREAD_INVALID", "instructionSources contains an unreadable or non-regular local path.", 4);
    }
    return { path: path.replaceAll("\\", "/"), sha256: sha256Bytes(readFileSync(path)) };
  }
  if (!source || typeof source.path !== "string" || typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) {
    fail("APP_SERVER_THREAD_INVALID", "instructionSources contains an invalid deterministic path/hash binding.", 4);
  }
  return { path: source.path.replaceAll("\\", "/"), sha256: source.sha256 };
}

function normalizeUserAgent(value) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    fail("APP_SERVER_PROTOCOL_NOT_READY", "initialize did not expose a valid userAgent.", 4);
  }
  return value;
}

function normalizePlatform(value) {
  if (typeof value?.platformFamily !== "string" || typeof value?.platformOs !== "string") {
    fail("APP_SERVER_PROTOCOL_NOT_READY", "initialize did not expose platformFamily/platformOs.", 4);
  }
  return `${value.platformFamily}-${value.platformOs}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function assertOptionalOwner(params, threadId, turnId) {
  if (!params || typeof params !== "object") fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server notification params are missing.", 4);
  if (Object.hasOwn(params, "threadId") && params.threadId !== threadId) {
    fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server notification substituted another thread.", 4);
  }
  if (Object.hasOwn(params, "turnId") && params.turnId !== turnId) {
    fail("APP_SERVER_PROTOCOL_OWNERSHIP_INVALID", "App Server notification substituted another turn.", 4);
  }
}

function finalAgentText(items) {
  if (!Array.isArray(items)) return null;
  const messages = items.filter((item) => item?.type === "agentMessage" && typeof item.text === "string");
  return messages.at(-1)?.text ?? null;
}

function syntheticEvent(value) {
  return Buffer.from(canonicalJsonLine(value), "utf8");
}

function launchError(error) {
  const denied = error?.code === "EACCES" || /access is denied|permission denied/i.test(error?.message ?? "");
  const osCode = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "UNKNOWN";
  return runtimeFailure(
    denied ? "APP_SERVER_LAUNCH_DENIED" : "APP_SERVER_LAUNCH_FAILED",
    denied
      ? `Codex App Server process launch was denied by the current environment (os_code=${osCode}).`
      : `Codex App Server process launch failed (os_code=${osCode}).`,
    { cause: error, osCode, runtimeStatus: "runtime_confirmed_not_started" },
  );
}

function asRuntimeFailure(error, code, message) {
  if (error instanceof HarnessError) return error;
  return runtimeFailure(code, message, { cause: error });
}

function runtimeFailure(code, message, fields = {}) {
  const error = new HarnessError(code, message, 4);
  Object.assign(error, { callCertainty: "confirmed_not_started", ...fields });
  return error;
}

function assertPositiveTimeout(value, label) {
  if (!Number.isInteger(value) || value <= 0 || value > 300_000) fail("APP_SERVER_TIMEOUT_INVALID", `${label} is invalid.`, 4);
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
