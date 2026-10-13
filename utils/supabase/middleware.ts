import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SIGN_IN_REASON_PARAM, SIGN_IN_REQUIRED_REASON } from '@/lib/auth/sign-in-reason'

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
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
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
  // (không kèm next/redirect_to: G1, tránh open redirect)
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
    return NextResponse.redirect(url)
  }

  // Nếu đăng nhập rồi mà cứ đòi vào trang Login -> đá vào Dashboard/Teacher
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
