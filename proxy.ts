// proxy.ts (Nằm ở root dự án)
import { type NextRequest } from 'next/server'
import { nextWithPathname } from '@/lib/i18n/pathname-header'
import { updateSession } from '@/utils/supabase/middleware'

// Đuôi ảnh mà matcher chính bỏ qua trên đường dẫn thô. Một request có đuôi ảnh thô chỉ tới được proxy qua mục matcher `/(teacher|admin)/:path*`
// (Next khớp matcher trên cả dạng thô lẫn dạng đã giải mã; đuôi ảnh thô luôn còn nguyên sau khi giải mã nên matcher chính bỏ qua cả hai).
// Với những request đó proxy chỉ ghi header đường dẫn cho khóa tiếng Việt (U9 H5) và không gọi updateSession, nên auth và phiên giữ như base,
// kể cả `/admin%2Fx.png` (không thuộc khu bị khóa nhưng vẫn tới proxy qua dạng đã giải mã `/admin/x.png`).
const SKIPPED_IMAGE_PATH = /\.(?:svg|png|jpg|jpeg|gif|webp)$/

// TRƯỚC ĐÂY: export async function middleware(request: NextRequest) {
// BÂY GIỜ: Đổi tên hàm thành "proxy"
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)
  if (SKIPPED_IMAGE_PATH.test(pathname)) {
    return nextWithPathname(request)
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!sitemap\\.xml$|robots\\.txt$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Khớp thêm mọi URL dưới khu bị khóa để URL ảnh mà matcher trên bỏ qua vẫn tới proxy() và nhận header đường dẫn (xem proxy()).
    '/(teacher|admin)/:path*',
  ],
}
