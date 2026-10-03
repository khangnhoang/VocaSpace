import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { emailConfirmationParamsSchema } from "@/lib/schemas/auth";

// G1: chỉ chuyển tới hai path cố định; không bao giờ đọc `next`/`redirect_to` từ query.
const SUCCESS_PATH = "/auth/set-password";
const FAILURE_PATH = "/login?auth_error=confirm";

export async function GET(request: NextRequest) {
  // Location tương đối để trình duyệt giữ đúng host gốc: NextRequest đổi 127.0.0.1 thành localhost,
  // redirect tuyệt đối sẽ sang host khác và mất cookie session vừa đặt.
  const redirectTo = (path: string) =>
    new NextResponse(null, { status: 303, headers: { Location: path } });

  const params = emailConfirmationParamsSchema.safeParse({
    token_hash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  });
  if (!params.success) return redirectTo(FAILURE_PATH);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(params.data);
  if (error) return redirectTo(FAILURE_PATH);

  return redirectTo(SUCCESS_PATH);
}
