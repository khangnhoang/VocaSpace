// Bộ giá trị giới tính chuẩn duy nhất (A5 AUTH-016), khớp CHECK `profiles_gender_check`.
// Tiếng Việt chỉ nằm ở nhãn trên UI, không nằm trong giá trị lưu.
export const GENDER_VALUES = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER_VALUES)[number];
