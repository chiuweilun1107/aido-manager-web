import { NextResponse, type NextRequest } from 'next/server'

// Hoist module-level constant so it parses once at cold start, not per request
const supabaseRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lighthouse audit bypass — only active when AUDIT_BYPASS_TOKEN is set server-side
  const bypassToken = request.headers.get('x-audit-bypass')
  if (bypassToken && process.env.AUDIT_BYPASS_TOKEN && bypassToken === process.env.AUDIT_BYPASS_TOKEN) {
    return NextResponse.next()
  }

  const raw = request.cookies.get(`sb-${supabaseRef}-auth-token`)?.value
    ?? (request.cookies.get(`sb-${supabaseRef}-auth-token.0`)?.value ?? '')
      + (request.cookies.get(`sb-${supabaseRef}-auth-token.1`)?.value ?? '')

  let authenticated = false
  if (raw) {
    try {
      // Extract access_token via regex to avoid outer JSON.parse
      const match = (raw.startsWith('base64-')
        ? atob(raw.slice(7))
        : raw
      ).match(/"access_token"\s*:\s*"([^"]+)"/)
      if (match) {
        const payload = JSON.parse(atob(match[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        authenticated = payload.exp > Date.now() / 1000
      }
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
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|webp|woff2|ico)$).*)']
}
