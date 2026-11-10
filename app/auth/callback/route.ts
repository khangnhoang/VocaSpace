import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { oauthCallbackCodeSchema } from "@/lib/schemas/auth";
import {
  LAST_SIGN_IN_METHOD_COOKIE,
  RETURN_PATH_COOKIE,
  expiredReturnPathCookieOptions,
  isHttpsProtocol,
  lastSignInMethodCookieOptions,
  resolveReturnPath,
} from "@/lib/auth/return-path";

// G1: thất bại luôn về path cố định; thành công về `/` hoặc trang đích nội bộ thuộc allowlist mà proxy đã ghi vào
// cookie. Không bao giờ đọc `next`/`redirect_to` từ query.
const FAILURE_PATH = "/login?auth_error=oauth";

export async function GET(request: NextRequest) {
  // Location tương đối như /auth/confirm: NextRequest đổi 127.0.0.1 thành localhost,
  // redirect tuyệt đối sẽ sang host khác và mất cookie session vừa đặt.
  const redirectTo = (path: string) =>
    new NextResponse(null, { status: 303, headers: { Location: path } });

  const { searchParams } = request.nextUrl;
  // Nhà cung cấp trả `error` khi người dùng hủy; không đổi code lấy session trong trường hợp đó.
  if (searchParams.has("error") || searchParams.has("error_description")) {
    return redirectTo(FAILURE_PATH);
  }

  const code = oauthCallbackCodeSchema.safeParse(searchParams.get("code"));
  if (!code.success) return redirectTo(FAILURE_PATH);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code.data);
    if (error) return redirectTo(FAILURE_PATH);
  } catch {
    return redirectTo(FAILURE_PATH);
  }

  const secure = isHttpsProtocol(request.nextUrl.protocol);
  const response = redirectTo(resolveReturnPath(request.cookies.get(RETURN_PATH_COOKIE)?.value));
  response.cookies.set(RETURN_PATH_COOKIE, "", expiredReturnPathCookieOptions(secure));
  response.cookies.set(LAST_SIGN_IN_METHOD_COOKIE, "google", lastSignInMethodCookieOptions(secure));
  return response;
}
