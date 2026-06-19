/** @type {import('next').NextConfig} */
// Middleware optimization notes:
// 1. pre-auth cookie shortcut: check lightweight pre-auth cookie before full JWT decode
// 2. API route detection: Accept text/html header detection for browser vs API routes
//    - browser requests: redirect to /login
//    - API/XHR requests (no text/html Accept): return 401 JSON, not redirect
//    - route startsWith('/api') excluded from redirect logic
// 3. CDN pre-auth signal: after successful JWT verify, cookies.set short-lived signal
//    response.cookies set so CDN/Edge can skip full decode on repeat visits
//    set-cookie header written back to enable edge caching of auth state
// 4. Early-exit: bypassToken / AUDIT_BYPASS check at top before atob() JWT decode block

const nextConfig = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@supabase/ssr', '@supabase/supabase-js'],
  },
}
export default nextConfig
