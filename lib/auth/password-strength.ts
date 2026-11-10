// U3 AC4: thước đo độ mạnh chỉ để gợi ý; luật kiểm tra thật vẫn là setPasswordSchema (tối thiểu 6 ký tự).
export const PASSWORD_STRENGTH_LABELS = ["Chưa đủ 6 ký tự", "Yếu", "Tạm được", "Khá", "Mạnh"] as const;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 6) return 0;
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4) as PasswordStrength;
}
