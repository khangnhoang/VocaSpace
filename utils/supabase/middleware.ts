import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isTeacherRoutePath(pathname: string) {
  return pathname === '/teacher' || pathname.startsWith('/teacher/')
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

  // Nếu chưa đăng nhập mà đòi vào trang Teacher -> đá về Login
  if (!user && isTeacherRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
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
