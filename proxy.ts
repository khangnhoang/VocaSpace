// proxy.ts (Nằm ở root dự án)
import { type NextRequest } from 'next/server'
import { isLockedAreaPath } from '@/lib/i18n/locked-areas'
import { nextWithPathname } from '@/lib/i18n/pathname-header'
import { updateSession } from '@/utils/supabase/middleware'

// Đuôi ảnh mà matcher chính bỏ qua. Dưới /teacher và /admin, một URL không tồn tại có đuôi này vẫn render not-found của app,
// nên proxy phải ghi header đường dẫn cho nó (U9 H5); đó là mọi thứ proxy làm ở đây, không gọi updateSession.
const SKIPPED_IMAGE_PATH = /\.(?:svg|png|jpg|jpeg|gif|webp)$/

// TRƯỚC ĐÂY: export async function middleware(request: NextRequest) {
// BÂY GIỜ: Đổi tên hàm thành "proxy"
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)
  // Matcher chính bỏ qua URL chỉ khi cả dạng thô lẫn dạng đã giải mã đều có đuôi ảnh; đuôi ảnh thô kéo theo đuôi ảnh đã giải mã,
  // còn `missing%2Epng` thô không có đuôi nên vẫn qua updateSession như base. Khu bị khóa nhận diện cả `/%61dmin/...`.
  if (SKIPPED_IMAGE_PATH.test(pathname) && isLockedAreaPath(pathname)) {
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
