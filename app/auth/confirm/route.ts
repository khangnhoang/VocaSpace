import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@/utils/supabase/server";
import { emailConfirmationParamsSchema } from "@/lib/schemas/auth";
import { recordPasswordRecovery } from "@/lib/auth/password-setup";

// G1: chỉ chuyển tới path cố định; không bao giờ đọc `next`/`redirect_to` từ query.
const SUCCESS_PATH = "/auth/set-password";
const FAILURE_PATH = "/login?auth_error=confirm";
const RECOVERY_FAILURE_PATH = "/login?auth_error=recovery";

export async function GET(request: NextRequest) {
  // Location tương đối để trình duyệt giữ đúng host gốc: NextRequest đổi 127.0.0.1 thành localhost,
  // redirect tuyệt đối sẽ sang host khác và mất cookie session vừa đặt.
  const redirectTo = (path: string) =>
    new NextResponse(null, { status: 303, headers: { Location: path } });

  const params = emailConfirmationParamsSchema.safeParse({
    token_hash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  });
  const failurePath = request.nextUrl.searchParams.get("type") === "recovery"
    ? RECOVERY_FAILURE_PATH : FAILURE_PATH;
  if (!params.success) return redirectTo(failurePath);

  if (params.data.type === "recovery") {
    // Không ghi vào cookie store của Next: verifyOtp và signOut có thể ghi cookie trước khi
    // biết bằng chứng đã lưu được chưa. Chỉ commit buffer khi recovery được chấp nhận.
    const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const cookie of cookiesToSet) pendingCookies.set(cookie.name, cookie);
          },
        },
      },
    );
    const { error } = await supabase.auth.verifyOtp(params.data);
    if (error) return redirectTo(RECOVERY_FAILURE_PATH);

    let recorded = false;
    try {
      const { data, error: claimsError } = await supabase.auth.getClaims();
      const userId = data?.claims.sub;
      const sessionId = data?.claims.session_id;
      if (!claimsError && typeof userId === "string" && typeof sessionId === "string" && sessionId) {
        recorded = await recordPasswordRecovery(userId, sessionId);
      } else {
        console.error("confirm recovery claims failed:", claimsError?.code ?? "invalid_claims");
      }
    } catch {
      console.error("confirm recovery evidence failed:", "unexpected_failure");
    }
    if (!recorded) {
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) console.error("confirm recovery signOut failed:", signOutError.code ?? signOutError.status);
      } catch {
        console.error("confirm recovery signOut failed:", "unexpected_failure");
      }
      return redirectTo(RECOVERY_FAILURE_PATH);
    }

    const response = redirectTo(SUCCESS_PATH);
    for (const { name, value, options } of pendingCookies.values()) response.cookies.set(name, value, options);
    return response;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(params.data);
  if (error) return redirectTo(FAILURE_PATH);

  return redirectTo(SUCCESS_PATH);
}
