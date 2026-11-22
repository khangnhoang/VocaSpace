import { describe, expect, it } from "vitest";
import baseIssues from "@/__tests__/fixtures/u2-base-schema-issues.json";
import { runProbe, type ProbeRecord } from "@/__tests__/support/schema-issue-probe";
import enValidation from "@/messages/en/validation.json";
import viValidation from "@/messages/vi/validation.json";
import { createTranslator } from "next-intl";
import { asTranslate, staticTranslate, translateIssueMessage } from "@/lib/i18n/translate";

// Test plan:
// - Mục tiêu: English localization U2 G2/AC1 - schema đổi message thành khóa catalog nhưng danh sách issue (path + số lượng + văn bản
//   tiếng Việt sau khi dịch) phải đúng như trước khi đổi; mọi khóa phải có ở cả vi và en.
// - Loại test: schema thuần so với bản ghi gốc `__tests__/fixtures/u2-base-schema-issues.json` (chụp trên schema chưa đổi,
//   commit 20fadd25) và catalog thật.
// - Đối tượng: loginSchema, setPasswordSchema, resendSignupConfirmationSchema, passwordRecoveryRequestSchema.
// - Case chính: toàn bộ đầu vào thiếu/sai kiểu của cả object và từng trường (probe), cùng nhánh mật khẩu không khớp.
// - Case biên: issue wrong-type giữ văn bản Zod mặc định (`zodType.*` kèm kiểu nhận được); issue đã dịch ra tiếng Anh không còn
//   chữ tiếng Việt.
// - Giới hạn: schema profile và passwordSchema (CP4) chưa nằm trong test này; bản ghi gốc đã có sẵn phần của chúng.

const CP1_SCHEMAS = new Set([
  "loginSchema",
  "setPasswordSchema",
  "resendSignupConfirmationSchema",
  "passwordRecoveryRequestSchema",
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
  return records.filter((record) => CP1_SCHEMAS.has(record.schema));
}

describe("U2 auth schema issues keep their Vietnamese output", () => {
  it("matches the pre-change recording for every probe input (path, count and text)", () => {
    const candidate = pick(runProbe((message) => translateIssueMessage(viTranslate, message), CP1_SCHEMAS));
    const base = pick(baseIssues as ProbeRecord[]);
    expect(candidate.length).toBeGreaterThan(40);
    expect(candidate).toEqual(base);
  });

  it("resolves every emitted message key in both vi and en", () => {
    const keys = new Set<string>();
    for (const record of pick(runProbe(undefined, CP1_SCHEMAS))) for (const issue of record.issues) keys.add(issue.message.split("|")[0]);
    expect(keys.size).toBeGreaterThan(5);
    for (const key of keys) {
      expect(viTranslate(key, { received: "null" }), `vi ${key}`).toBeTruthy();
      expect(enTranslate(key, { received: "null" }), `en ${key}`).toBeTruthy();
    }
  });

  it("emits no Vietnamese text in the English translation of any issue", () => {
    // Dấu thanh/mũ sau khi tách NFD, cộng đ/Đ: bắt cả chữ dựng sẵn như ớ, ế, ệ.
    const vietnamese = { test: (value: string) => /[\u0300-\u036f\u0111\u0110]/.test(value.normalize("NFD")) };
    for (const record of pick(runProbe((message) => translateIssueMessage(enTranslate, message), CP1_SCHEMAS))) {
      for (const issue of record.issues) expect(vietnamese.test(issue.message), `${record.schema} ${record.input}: ${issue.message}`).toBe(false);
    }
  });
});
