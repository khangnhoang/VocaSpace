// proxy.ts (Nằm ở root dự án)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// TRƯỚC ĐÂY: export async function middleware(request: NextRequest) {
// BÂY GIỜ: Đổi tên hàm thành "proxy"
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}