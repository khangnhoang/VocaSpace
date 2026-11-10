import { lastSignInMethodSchema, returnPathSchema, type LastSignInMethod } from "@/lib/schemas/auth";

// U3: hai cookie của luồng đăng nhập. Proxy ghi trang đích khi tự chuyển khách chưa đăng nhập về /login;
// signInUser và /auth/callback đọc, kiểm tra lại rồi xoá. Cookie cách đăng nhập chỉ chứa `email`/`google`.
export const RETURN_PATH_COOKIE = "vs_return_to";
export const LAST_SIGN_IN_METHOD_COOKIE = "vs_last_sign_in";

const RETURN_PATH_MAX_AGE_SECONDS = 10 * 60;
const LAST_SIGN_IN_METHOD_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const DEFAULT_DESTINATION = "/";

export function parseReturnPath(value: unknown): string | null {
  const parsed = returnPathSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveReturnPath(value: unknown): string {
  return parseReturnPath(value) ?? DEFAULT_DESTINATION;
}

export function parseLastSignInMethod(value: unknown): LastSignInMethod | null {
  const parsed = lastSignInMethodSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// G2: `Secure` theo giao thức thật của request, không theo NODE_ENV, vì bản build production của CI chạy trên http.
export function isHttpsProtocol(protocol: string | null | undefined): boolean {
  return protocol === "https:" || protocol === "https";
}

// Server Action không có đối tượng request: lấy giao thức từ proxy phía trước (x-forwarded-proto), thiếu thì
// lấy scheme của Origin. Không xác định được thì coi như không HTTPS.
export function isHttpsRequest(headers: Headers): boolean {
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return isHttpsProtocol(forwarded);
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return isHttpsProtocol(new URL(origin).protocol);
  } catch {
    return false;
  }
}

export function returnPathCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure, maxAge: RETURN_PATH_MAX_AGE_SECONDS };
}

export function expiredReturnPathCookieOptions(secure: boolean) {
  return { ...returnPathCookieOptions(secure), maxAge: 0 };
}

export function lastSignInMethodCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure, maxAge: LAST_SIGN_IN_METHOD_MAX_AGE_SECONDS };
}
