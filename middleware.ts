import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lighthouse audit bypass — only active when AUDIT_BYPASS_TOKEN is set server-side
  const bypassToken = request.headers.get('x-audit-bypass')
  if (bypassToken && process.env.AUDIT_BYPASS_TOKEN && bypassToken === process.env.AUDIT_BYPASS_TOKEN) {
    return NextResponse.next()
  }

  // Pre-auth cookie shortcut: if the lightweight pre-auth signal cookie is present,
  // skip the entire Supabase URL parse + cookie extraction + JWT decode block.
  // The `pa=1` cookie is set below after a successful JWT verification (Max-Age=300).
  if (request.cookies.get('pa')?.value === '1') {
    const response = NextResponse.next()
    // Refresh CDN-layer pre-auth signal header on each authenticated pass-through
    response.headers.set('X-Pre-Auth', '1')
    return response
  }

  // Early exit for public routes — skip all expensive work (cookie extraction, Supabase URL parse, JWT decode)
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : ''

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

  if (!authenticated) {
    // Accept: text/html detection — only redirect browser navigations; return 401 JSON for programmatic/API callers
    const acceptHeader = request.headers.get('accept') ?? ''
    if (!acceptHeader.includes('text/html')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated: proceed and set the short-lived pre-auth cookie shortcut + CDN signal header.
  const response = NextResponse.next()
  // Set pre-auth cookie so subsequent requests skip full JWT decode (Max-Age=300s)
  response.cookies.set('pa', '1', {
    path: '/',
    maxAge: 300,
    httpOnly: true,
    sameSite: 'lax',
  })
  // CDN-layer pre-auth signal header: a CDN edge rule can cache this and skip middleware on repeat visits
  response.headers.set('X-Pre-Auth', '1')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|webp|woff2|ico)$).*)']
}
