import { NextResponse, type NextRequest } from "next/server";
import { PATHNAME_HEADER } from "./locked-areas";

// Ghi đè header đường dẫn bằng đường dẫn proxy thấy (AC7: giá trị client gửi lên bị thay), gửi lên upstream cho getRequestLocale.
// Gọi lại sau khi setAll sửa cookie của request, để request upstream vẫn mang cookie phiên đã refresh.
export function nextWithPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}
