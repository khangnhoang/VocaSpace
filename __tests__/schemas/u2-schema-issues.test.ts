import { describe, expect, it } from "vitest";
import { z } from "zod";
import { passwordSchema, profileSchema } from "@/lib/schemas/profile";
import baseIssues from "@/__tests__/fixtures/u2-base-schema-issues.json";
import { runProbe, type ProbeRecord } from "@/__tests__/support/schema-issue-probe";
import enValidation from "@/messages/en/validation.json";
import viValidation from "@/messages/vi/validation.json";
import { createTranslator } from "next-intl";
import { asTranslate, staticTranslate, translateIssueMessage } from "@/lib/i18n/translate";

// Test plan:
// - Mục tiêu: English localization U2 G2/AC1 - schema đổi message thành khóa catalog nhưng danh sách issue (path + số lượng + văn bản
//   tiếng Việt sau khi dịch) phải đúng như trước khi đổi; mọi khóa phải có ở cả vi và en. Từ CP4 gồm cả schema profile và đổi mật khẩu.
// - Loại test: schema thuần so với bản ghi gốc `__tests__/fixtures/u2-base-schema-issues.json` (chụp trên schema chưa đổi,
//   commit 20fadd25) và catalog thật.
// - Đối tượng: loginSchema, setPasswordSchema, resendSignupConfirmationSchema, passwordRecoveryRequestSchema, profileSchema, passwordSchema.
// - Case chính: toàn bộ đầu vào thiếu/sai kiểu của cả object và từng trường (probe), cùng nhánh mật khẩu không khớp.
// - Case biên: issue wrong-type giữ văn bản Zod mặc định (`zodType.*` kèm kiểu nhận được); issue đã dịch ra tiếng Anh không còn
//   chữ tiếng Việt.
// - Giới hạn: chỉ so danh sách issue; văn bản hiển thị ở form và action được kiểm riêng trong test render/action của từng màn hình.

const U2_SCHEMAS = new Set([
  "loginSchema",
  "setPasswordSchema",
  "resendSignupConfirmationSchema",
  "passwordRecoveryRequestSchema",
  "profileSchema",
  "passwordSchema",
]);

const viTranslate = staticTranslate("validation", viValidation);
// Thiếu khóa thì ném lỗi thay vì trả chuỗi khóa, để test không lọt khóa thiếu.
const enTranslate = asTranslate(
  createTranslator({
    locale: "en",
    messages: { validation: enValidation },
    namespace: "validation",
    onError: (error: Error) => {
      throw error;
    },
  } as never),
);

function pick(records: ProbeRecord[]) {
  return records.filter((record) => U2_SCHEMAS.has(record.schema));
}

describe("U2 auth and profile schema issues keep their Vietnamese output", () => {
  it("matches the pre-change recording for every probe input (path, count and text)", () => {
    const candidate = pick(runProbe((message) => translateIssueMessage(viTranslate, message), U2_SCHEMAS));
    const base = pick(baseIssues as ProbeRecord[]);
    expect(candidate.length).toBeGreaterThan(40);
    expect(candidate).toEqual(base);
  });

  it("resolves every emitted message key in both vi and en", () => {
    const keys = new Set<string>();
    for (const record of pick(runProbe(undefined, U2_SCHEMAS))) for (const issue of record.issues) keys.add(issue.message.split("|")[0]);
    expect(keys.size).toBeGreaterThan(5);
    for (const key of keys) {
      expect(viTranslate(key, { received: "null" }), `vi ${key}`).toBeTruthy();
      expect(enTranslate(key, { received: "null" }), `en ${key}`).toBeTruthy();
    }
  });

  it("emits no Vietnamese text in the English translation of any issue", () => {
    // Dấu thanh/mũ sau khi tách NFD, cộng đ/Đ: bắt cả chữ dựng sẵn như ớ, ế, ệ.
    const vietnamese = { test: (value: string) => /[\u0300-\u036f\u0111\u0110]/.test(value.normalize("NFD")) };
    for (const record of pick(runProbe((message) => translateIssueMessage(enTranslate, message), U2_SCHEMAS))) {
      for (const issue of record.issues) expect(vietnamese.test(issue.message), `${record.schema} ${record.input}: ${issue.message}`).toBe(false);
    }
  });
});

// Kiểu nhận được ngoài null/undefined: Zod mặc định ghi File, Date, NaN, Infinity theo bộ định dạng riêng của nó, khác getParsedType.
describe("wrong-type issues quote Zod's default text for every received type", () => {
  function translatedIssues(result: { error?: { issues: { message: string; path: PropertyKey[] }[] } }) {
    return (result.error?.issues ?? []).map((issue) => ({
      path: issue.path.join("."),
      message: translateIssueMessage(viTranslate, issue.message),
    }));
  }

  it.each([
    ["a File", new File(["x"], "a.txt"), "File"],
    ["a Date", new Date(0), "Date"],
    ["NaN", Number.NaN, "NaN"],
    ["Infinity", Number.POSITIVE_INFINITY, "Infinity"],
    ["a Map", new Map(), "Map"],
    ["an array", [], "array"],
    ["a number", 12, "number"],
  ] as const)("keeps the base text for %s sent as a string field", (_label, input, received) => {
    const text = `Invalid input: expected string, received ${received}`;
    // Văn bản gốc chính là message mặc định của Zod khi chưa có khóa catalog.
    expect(z.string().safeParse(input).error?.issues[0]?.message).toBe(text);

    const profile = translatedIssues(profileSchema.safeParse({ full_name: input, gender: "male" }));
    expect(profile).toContainEqual({ path: "full_name", message: text });

    const password = translatedIssues(
      passwordSchema.safeParse({ currentPassword: input, newPassword: "abcdef", confirmPassword: "abcdef" }),
    );
    expect(password).toContainEqual({ path: "currentPassword", message: text });
  });

  it.each([
    ["NaN", Number.NaN, "NaN"],
    ["Infinity", Number.POSITIVE_INFINITY, "Infinity"],
    ["a number", 12, "number"],
    ["an array", [], "array"],
  ] as const)("keeps the base text for %s sent as the whole object", (_label, input, received) => {
    const text = `Invalid input: expected object, received ${received}`;
    expect(z.object({}).safeParse(input).error?.issues[0]?.message).toBe(text);
    expect(translatedIssues(profileSchema.safeParse(input))).toEqual([{ path: "", message: text }]);
    expect(translatedIssues(passwordSchema.safeParse(input))).toEqual([{ path: "", message: text }]);
  });
});
