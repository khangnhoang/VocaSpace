import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { LAST_SIGN_IN_METHOD_COOKIE, parseLastSignInMethod } from "@/lib/auth/return-path";

// Layout chung giữ panel đường cong không mount lại khi chuyển giữa /login và /register (U3 AC2).
// Cách đăng nhập lần trước đọc ở server để thứ tự nút đúng ngay lần vẽ đầu (AC6).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lastSignInMethod = parseLastSignInMethod((await cookies()).get(LAST_SIGN_IN_METHOD_COOKIE)?.value);
  return <AuthShell lastSignInMethod={lastSignInMethod}>{children}</AuthShell>;
}
