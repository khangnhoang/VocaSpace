import { assertRuntimeCredentialFree } from "./harness-schema-v2.mjs";

const maximumFailedTurnMessageBytes = 512;
const categories = new Set([
  "badRequest",
  "contextWindowExceeded",
  "cyberPolicy",
  "internalServerError",
  "misalignmentPolicyViolation",
  "other",
  "sandboxError",
  "serverOverloaded",
  "sessionBudgetExceeded",
  "threadRollbackFailed",
  "unauthorized",
  "usageLimitExceeded",
]);
const httpCategories = new Set([
  "httpConnectionFailed",
  "responseStreamConnectionFailed",
  "responseStreamDisconnected",
  "responseTooManyFailedAttempts",
]);
const turnKinds = new Set(["compact", "review"]);

export function projectCodexFailedTurnReason(value) {
  if (typeof value === "string") return categories.has(value) ? { category: value } : null;
  if (!exactObject(value, 1)) return null;
  const [category] = Object.keys(value);
  const metadata = value[category];
  if (!exactObject(metadata, 1)) return null;
  if (httpCategories.has(category)) {
    const httpStatusCode = metadata.httpStatusCode;
    return Object.hasOwn(metadata, "httpStatusCode") && (httpStatusCode === null || Number.isSafeInteger(httpStatusCode))
      ? { category, http_status_code: httpStatusCode }
      : null;
  }
  if (category === "activeTurnNotSteerable") {
    return Object.hasOwn(metadata, "turnKind") && turnKinds.has(metadata.turnKind)
      ? { category, turn_kind: metadata.turnKind }
      : null;
  }
  return null;
}

export function normalizeCodexFailedTurnReason(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.category !== "string") return null;
  if (categories.has(value.category)) return exactKeys(value, ["category"]) ? { category: value.category } : null;
  if (httpCategories.has(value.category)) {
    return exactKeys(value, ["category", "http_status_code"]) &&
      (value.http_status_code === null || Number.isSafeInteger(value.http_status_code))
      ? { category: value.category, http_status_code: value.http_status_code }
      : null;
  }
  return value.category === "activeTurnNotSteerable" &&
    exactKeys(value, ["category", "turn_kind"]) && turnKinds.has(value.turn_kind)
    ? { category: value.category, turn_kind: value.turn_kind }
    : null;
}

export function isCodexFailedTurnReason(value) {
  return value === null || normalizeCodexFailedTurnReason(value) !== null;
}

export function projectCodexFailedTurnMessage(value) {
  if (typeof value !== "string") return null;
  try {
    assertRuntimeCredentialFree({ failed_turn_message: value });
  } catch {
    return null;
  }
  const sanitized = value.replace(/[\u0000-\u0020\u007f]+/gu, " ").trim();
  if (sanitized.length === 0) return null;
  return truncateUtf8(sanitized, maximumFailedTurnMessageBytes);
}

export function normalizeCodexFailedTurnMessage(value) {
  if (typeof value !== "string") return null;
  const projected = projectCodexFailedTurnMessage(value);
  return projected === value ? value : null;
}

export function isCodexFailedTurnMessage(value) {
  return normalizeCodexFailedTurnMessage(value) !== null;
}

function exactObject(value, keyCount) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keyCount;
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function truncateUtf8(value, maximumBytes) {
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maximumBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result;
}
