import { viAuthText } from "./vi-auth-text";

// U3 AC4: thước đo độ mạnh chỉ để gợi ý; luật kiểm tra thật vẫn là setPasswordSchema (tối thiểu 6 ký tự).
// Nhãn nằm trong catalog `auth.strength`; PASSWORD_STRENGTH_LABELS là bản tiếng Việt cho code/test không có provider.
export const PASSWORD_STRENGTH_KEYS = ["strength.level0", "strength.level1", "strength.level2", "strength.level3", "strength.level4"] as const;
export const PASSWORD_STRENGTH_LABELS = PASSWORD_STRENGTH_KEYS.map((key) => viAuthText(key));

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 6) return 0;
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4) as PasswordStrength;
}
