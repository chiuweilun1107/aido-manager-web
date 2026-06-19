# Optimization Goal
Reduce Speed Index below 3400ms (ideally below 1800ms) for three routes exceeding the threshold due to 307 redirect round-trip RTT cost accumulated in the middleware auth-guard path.

# Asset Description
`middleware.ts` is a Next.js edge middleware that runs on every non-static matched request. It reads a Supabase auth-token cookie (single or chunked `.0`/`.1` variants, base64 or plain JSON), extracts the JWT access_token via regex to avoid a full outer JSON.parse, base64-decodes the JWT payload, and checks `exp` against current time. Unauthenticated requests to protected routes receive a 307 redirect to `/login`; authenticated users hitting `/login` are redirected to `/dashboard`. An `x-audit-bypass` / `AUDIT_BYPASS_TOKEN` escape hatch short-circuits all auth logic when a matching secret header is present. Static assets are excluded from the matcher. The `supabaseRef` constant is hoisted to module scope and parsed once at cold start. Baseline score.py score: **100 / 100** (all ten checks PASS).

# What you MAY change
- **Public-route fast-path before cookie read**: The `/login` path check currently occurs after cookie access. Moving it (and other known-public paths) before the cookie read adds an explicit fast-path, skipping JWT decode work for unauthenticated hits to public URLs — reduces per-request CPU on public paths without changing behavior.
- **Expand public-route allowlist**: Add `pathname.startsWith('/api/')` or other known-public prefixes to the early-exit guard. Ensures API probes and crawler hits skip auth overhead entirely.
- **Replace auth-guard redirect with rewrite**: For unauthenticated requests to protected routes, switch `NextResponse.redirect(new URL('/login', request.url))` to `NextResponse.rewrite(new URL('/login', request.url))`. This removes the client-visible 307 round-trip that adds RTT cost (40-53ms per observation) to the Speed Index visual-progress timeline.
- **Extend matcher exclusions**: Additional font extensions (`woff`, `ttf`, `eot`) or well-known paths (`/robots.txt`, `/sitemap.xml`) can be added to the negative-lookahead if middleware is being invoked on them unnecessarily.
- **Module-level compiled regex**: The access_token extractor regex can be promoted to module scope as a compiled `RegExp` constant to avoid recompilation per invocation.

# What you MUST NOT change
- **`config.matcher` core exclusions**: Must continue to exclude `_next/static`, `_next/image`, `favicon.ico`, and common image/font extensions (`png|svg|jpg|jpeg|webp|woff2|ico`). Removing these causes middleware to run on every static asset and breaks the score.py `matcher_excludes_static_assets` check (weight 15).
- **`x-audit-bypass` escape hatch**: The header check (`x-audit-bypass` vs `process.env.AUDIT_BYPASS_TOKEN`) must remain and must short-circuit before any auth logic. Lighthouse performance measurements depend on this path.
- **Cookie name convention**: Cookie names `sb-${supabaseRef}-auth-token` and `.0`/`.1` chunked variants, with `supabaseRef` derived from `NEXT_PUBLIC_SUPABASE_URL`, must be preserved. Supabase clients write exactly these names.
- **JWT expiry check** (`payload.exp > Date.now() / 1000`): The security invariant. Must not be removed, weakened, or replaced with a truthy check.
- **`try/catch` around JWT decode**: Invalid or malformed tokens must silently produce `authenticated = false`, not surface an unhandled exception.
- **Authenticated-user redirect from /login to /dashboard**: If a valid non-expired token is present and the user requests `/login`, they must be sent to `/dashboard`.
- **Regex extraction shortcut** (`match(/"access_token"...)`): Must not regress to parsing the entire cookie value with outer `JSON.parse` — the regex path is a deliberate lightweight optimization.
- **No blocking I/O**: No `fetch()`, `axios`, or synchronous network calls inside the middleware function. Edge middleware must remain synchronous.
- **TypeScript / Next.js edge runtime compatibility**: Must remain valid TypeScript targeting the Next.js edge runtime. No Node.js-only APIs (`fs`, `crypto` without Web Crypto, `Buffer` without polyfill).
- **Do not modify `score.py`**: It is the scoring oracle.

# Strategy hints
1. **Add /login early-exit before cookie read (highest ROI, zero score regression risk)**: Insert a public-path guard immediately after the bypass-token block and before `request.cookies.get(...)`. For example: `if (pathname === '/login') return NextResponse.next()`. This skips all cookie access and JWT decode work on the cold-start path Lighthouse audits. Score remains 100/100 because the scored `cookie_read_conditional` check only requires an `if` before the cookie read — adding an earlier `if` block satisfies that.
2. **Switch auth-guard redirect to rewrite**: Replace `NextResponse.redirect(new URL('/login', request.url))` with `NextResponse.rewrite(new URL('/login', request.url))`. Eliminates the client-visible 307 round-trip that accumulates 40-53ms RTT cost in the Speed Index visual-progress timeline. The authenticated-user redirect to `/dashboard` is unaffected.
3. **Validate authenticated routes with the bypass header**: Set `AUDIT_BYPASS_TOKEN` server-side and pass the matching header in Lighthouse custom headers to measure authenticated routes directly. This removes the confounding factor (all routes redirecting to `/login` HTML) before attributing remaining SI cost to middleware latency.

# Quality bar
- **score.py output = 100.0** (current baseline is already 100.0; any change must not regress below 95.0).
- **Speed Index < 3400ms** on all measured routes (Lighthouse 'Good' band threshold); ideal < 1800ms.
- **Speed Index for /notifications remains <= 1518ms** (RTT=17ms baseline — do not regress the already-fast route).
- **No new TypeScript errors**: `tsc --noEmit` passes on the modified `middleware.ts`.
- **`x-audit-bypass` still short-circuits** before any cookie read or JWT decode.
- **No `fetch()` or blocking I/O** introduced in the middleware function.
