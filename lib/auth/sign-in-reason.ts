// Nguồn duy nhất cho lý do "cần đăng nhập" khi redirect về /login (G1, open redirect/phishing).
// Chỉ literal cố định này được ghi vào URL; trang login tra message từ map, không bao giờ dùng giá trị thô.
export const SIGN_IN_REASON_PARAM = "reason";
export const SIGN_IN_REQUIRED_REASON = "signin_required";

export const SIGN_IN_REQUIRED_LOGIN_PATH = `/login?${SIGN_IN_REASON_PARAM}=${SIGN_IN_REQUIRED_REASON}`;

export const SIGN_IN_REASON_MESSAGES: Record<string, string> = {
  [SIGN_IN_REQUIRED_REASON]: "Vui lòng đăng nhập để tiếp tục.",
};
