import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { nextWithPathname } from '@/lib/i18n/pathname-header'
import { SIGN_IN_REASON_PARAM, SIGN_IN_REQUIRED_REASON } from '@/lib/auth/sign-in-reason'
import {
  RETURN_PATH_COOKIE,
  expiredReturnPathCookieOptions,
  isHttpsProtocol,
  parseReturnPath,
  returnPathCookieOptions,
} from '@/lib/auth/return-path'

function isTeacherRoutePath(pathname: string) {
  return pathname === '/teacher' || pathname.startsWith('/teacher/')
}

function isProfileRoutePath(pathname: string) {
  return pathname === '/profile' || pathname.startsWith('/profile/')
}

function isAdminRoutePath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = nextWithPathname(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = nextWithPathname(request)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Gọi getUser() để Supabase tự động refresh token nếu token cũ sắp hết hạn
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Phân quyền cơ bản: Chặn người chưa đăng nhập vào các trang quan trọng
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
  const isTeacherRoute = isTeacherRoutePath(request.nextUrl.pathname)
  const isProfileRoute = isProfileRoutePath(request.nextUrl.pathname)
  // Proxy chỉ chuyển người chưa đăng nhập; kiểm tra vai trò admin nằm ở server render của từng trang /admin (AD1 G3).
  const isAdminRoute = isAdminRoutePath(request.nextUrl.pathname)

  // Nếu chưa đăng nhập mà đòi vào trang Teacher, Profile hoặc Admin -> đá về Login
  // (G1: URL /login không bao giờ mang next/redirect_to; trang đích chỉ đi qua cookie do chính proxy ghi)
  if (!user && (isTeacherRoute || isProfileRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (isProfileRoute || isAdminRoute) {
      // Bỏ query và hash: next/redirect_to từ URL /profile hoặc /admin không được sang /login (G1, open redirect)
      url.search = ''
      url.hash = ''
    }
    // set() thay mọi `reason` có sẵn bằng đúng một literal cố định; query teacher còn lại được giữ nguyên.
    url.searchParams.set(SIGN_IN_REASON_PARAM, SIGN_IN_REQUIRED_REASON)
    const response = NextResponse.redirect(url)
    // U3 G2b: chỉ ghi trên redirect này. Prefetch cũng chạy qua proxy mà không lộ header prefetch, nên không bao giờ
    // ghi trên response đi thẳng (kể cả /learn) để tránh lưu một trang khách chưa hề mở.
    // Path bị chặn nhưng không qua allowlist thì xoá trang đích cũ, để lần đăng nhập này về `/` (AC7).
    const returnPath = parseReturnPath(request.nextUrl.pathname)
    const secure = isHttpsProtocol(request.nextUrl.protocol)
    if (returnPath) {
      response.cookies.set(RETURN_PATH_COOKIE, returnPath, returnPathCookieOptions(secure))
    } else {
      response.cookies.set(RETURN_PATH_COOKIE, '', expiredReturnPathCookieOptions(secure))
    }
    return response
  }

  // Nếu đăng nhập rồi mà cứ đòi vào trang Login -> đá vào Dashboard/Teacher
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
