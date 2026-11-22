import type { ZodType } from "zod";
import { loginSchema, passwordRecoveryRequestSchema, resendSignupConfirmationSchema, setPasswordSchema } from "@/lib/schemas/auth";
import { passwordSchema, profileSchema } from "@/lib/schemas/profile";

// Bộ đầu vào dùng để ghi lại và so sánh danh sách issue của các schema U2 (English localization U2 G2): cả object bị thiếu hoặc
// sai kiểu, và từng trường bị thiếu/sai kiểu/ngắn/rỗng. `undefined` nghĩa là xoá trường khỏi object.
const WHOLE_INPUTS: unknown[] = [undefined, null, "x", 1, [], {}];
const FIELD_VALUES: unknown[] = [undefined, null, 1, "", " ", "a", "abcdefg"];

type Case = { schema: string; input: string; value: unknown };

const SCHEMAS: Record<string, { schema: ZodType; valid: Record<string, unknown> }> = {
  loginSchema: { schema: loginSchema, valid: { email: "a@b.co", password: "secret1" } },
  setPasswordSchema: { schema: setPasswordSchema, valid: { password: "secret1", confirmPassword: "secret1" } },
  resendSignupConfirmationSchema: { schema: resendSignupConfirmationSchema, valid: { email: "a@b.co" } },
  passwordRecoveryRequestSchema: { schema: passwordRecoveryRequestSchema, valid: { email: "a@b.co" } },
  profileSchema: {
    schema: profileSchema,
    valid: { full_name: "An Nguyen", username: "annguyen", dob: "2000-01-01", gender: "male" },
  },
  passwordSchema: {
    schema: passwordSchema,
    valid: { currentPassword: "secret1", newPassword: "secret2", confirmPassword: "secret2" },
  },
};

export function buildProbeCases(): Case[] {
  const cases: Case[] = [];
  for (const [schema, { valid }] of Object.entries(SCHEMAS)) {
    for (const value of WHOLE_INPUTS) cases.push({ schema, input: "whole", value });
    cases.push({ schema, input: "valid", value: valid });
    for (const field of Object.keys(valid)) {
      for (const fieldValue of FIELD_VALUES) {
        const value = { ...valid };
        if (fieldValue === undefined) delete value[field];
        else value[field] = fieldValue;
        cases.push({ schema, input: `field:${field}=${describe(fieldValue)}`, value });
      }
    }
    // Hai ô mật khẩu khác nhau: issue của refine nằm ở confirmPassword.
    if ("confirmPassword" in valid) cases.push({ schema, input: "mismatch", value: { ...valid, confirmPassword: "different1" } });
  }
  return cases;
}

function describe(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  return JSON.stringify(value);
}

export type ProbeRecord = { schema: string; input: string; issues: { path: string; message: string }[] };

// `translate` đổi message của issue sang văn bản hiển thị; bản gốc (trước khi chuyển sang khóa) dùng nguyên message.
export function runProbe(
  translate: (message: string) => string = (message) => message,
  only?: ReadonlySet<string>,
): ProbeRecord[] {
  return buildProbeCases()
    .filter(({ schema }) => !only || only.has(schema))
    .map(({ schema, input, value }) => {
      const result = SCHEMAS[schema].schema.safeParse(value);
      return {
        schema,
        input,
        issues: result.success
          ? []
          : result.error.issues.map((issue) => ({ path: issue.path.join("."), message: translate(issue.message) })),
      };
    });
}
