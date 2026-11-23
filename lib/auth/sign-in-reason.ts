// Nguồn duy nhất cho lý do "cần đăng nhập" khi redirect về /login (G1, open redirect/phishing).
// Chỉ literal cố định này được ghi vào URL; trang login tra khóa message từ map, không bao giờ dùng giá trị thô.
export const SIGN_IN_REASON_PARAM = "reason";
export const SIGN_IN_REQUIRED_REASON = "signin_required";

export const SIGN_IN_REQUIRED_LOGIN_PATH = `/login?${SIGN_IN_REASON_PARAM}=${SIGN_IN_REQUIRED_REASON}`;

// Khóa trong catalog `auth`; trang login dịch theo ngôn ngữ đang dùng.
export const SIGN_IN_REASON_KEYS: Record<string, string> = {
  [SIGN_IN_REQUIRED_REASON]: "login.reason.signinRequired",
};
