import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const isLogin = url.pathname.startsWith('/login')

  // Supabase sets one of these on sign-in
  const hasSession =
    req.cookies.get('sb-access-token') ||
    req.cookies.get('sb:token') ||
    req.cookies.get('supabase-auth-token')

  if (!hasSession && !isLogin) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && isLogin) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login'],
}

