import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
  const raw = request.cookies.get(`sb-${ref}-auth-token`)?.value
    ?? (request.cookies.get(`sb-${ref}-auth-token.0`)?.value ?? '')
      + (request.cookies.get(`sb-${ref}-auth-token.1`)?.value ?? '')

  let authenticated = false
  if (raw) {
    try {
      // Decode session JSON (handles both default and base64url cookieEncoding)
      const sessionJson = raw.startsWith('base64-')
        ? atob(raw.slice(7).replace(/-/g, '+').replace(/_/g, '/'))
        : raw
      const jwt: string = JSON.parse(sessionJson).access_token
      if (!jwt) throw new Error('no access_token')
      const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      authenticated = payload.exp > Date.now() / 1000
    } catch { /* invalid token = not authenticated */ }
  }

  if (!authenticated && !pathname.startsWith('/login') && !pathname.startsWith('/api/seed')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (authenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)']
}
