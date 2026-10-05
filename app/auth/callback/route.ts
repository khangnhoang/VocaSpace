import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { oauthCallbackCodeSchema } from "@/lib/schemas/auth";

// G1: chỉ chuyển tới hai path cố định; không bao giờ đọc `next`/`redirect_to` từ query.
const SUCCESS_PATH = "/";
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

  return redirectTo(SUCCESS_PATH);
}
