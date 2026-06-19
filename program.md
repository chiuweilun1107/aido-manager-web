# Optimization Goal
Reduce FCP on authenticated routes below 1800 ms by eliminating the unauthenticated redirect chain in middleware.ts — either via a rewrite-instead-of-redirect strategy for the auth guard or a Lighthouse bypass-header mechanism so real authenticated performance can be measured directly.

# Asset Description
`middleware.ts` is the Next.js Edge Middleware for `aido-web`, a TypeScript + Tailwind + Supabase enterprise admin platform. It runs on every request matched by `config.matcher`, validates the Supabase JWT stored in cookies (handling both plain-JSON and base64-chunked cookie variants), and either redirects unauthenticated visitors to `/login` (307) or passes the request through. Lighthouse audited `/notifications` without an auth cookie, triggering the 307 → `/login` redirect chain, which adds a full extra round-trip before any paint. The observed real-browser FCP is 2405 ms vs simulated FCP of 821 ms; the gap is entirely the redirect penalty.

# What you MAY change
- Replace `NextResponse.redirect(new URL('/login', request.url))` with `NextResponse.rewrite(new URL('/login', request.url))` so the browser receives `/login` content at the original URL without an extra round-trip.
- Add or expand the bypass-header check (`x-audit-bypass` / `AUDIT_BYPASS_TOKEN`) so Lighthouse runs can inject the header and hit authenticated content directly, measuring real FCP without the redirect chain penalty.
- Extend `config.matcher` to exclude additional static-asset patterns (fonts, CSS, JS chunks) that should never pass through the auth logic, reducing middleware cold-start cost.
- Add entries to the public-route allowlist (the `!pathname.startsWith('/login')` condition) for routes that should be publicly indexable, e.g., landing pages or public API endpoints.
- Optimize the Supabase token parsing logic (e.g., short-circuit earlier if the cookie is absent, avoid redundant string concatenation) to reduce per-request CPU time.
- Rename or restructure internal variables for clarity, provided behaviour is identical.

# What you MUST NOT change
- Do NOT break the Supabase JWT expiry check (`payload.exp > Date.now() / 1000`) — authenticated sessions must remain protected.
- Do NOT remove the `sb-${supabaseRef}-auth-token` cookie lookup or the `.0` / `.1` chunked-cookie fallback — production Supabase auth depends on both variants.
- Do NOT modify `score.py` — it is the scoring oracle.
- Do NOT alter `package.json`, `next.config.mjs`, `tsconfig.json`, or any file outside `middleware.ts` unless the change is strictly required to support a `middleware.ts` fix.
- Do NOT widen `config.matcher` to include `_next/static`, `_next/image`, or favicon/image extensions — these must remain excluded to avoid unnecessary middleware overhead.
- Do NOT allow unauthenticated requests to reach protected routes (i.e., any route not in the public allowlist and without a valid non-expired JWT must still be blocked).
- Do NOT change the redirect destination for authenticated users visiting `/login` — they must still be sent to `/dashboard`.

# Strategy hints
1. **Rewrite instead of redirect for auth guard**: Change `NextResponse.redirect(new URL('/login', request.url))` to `NextResponse.rewrite(new URL('/login', request.url))`. This renders `/login` content at the requested URL in a single round-trip, eliminating the 307 → browser re-request → `/login` response chain. The browser sees HTTP 200 with the login page body immediately, shaving one full RTT off FCP.
2. **Strengthen the audit bypass header**: The current `x-audit-bypass` implementation already exists but only works when `AUDIT_BYPASS_TOKEN` is set. Verify the bypass path returns `NextResponse.next()` before the cookie-parsing block so Lighthouse runs with the correct header skip all auth overhead and measure authenticated page performance directly.
3. **Expand the public-route allowlist**: Add a structured `PUBLIC_PATHS` constant (array or Set) that covers `/login`, `/api/seed`, and any future public routes. Check it with a single `.some()` call rather than chained `startsWith` comparisons — this also makes it easy to add crawlable marketing pages without modifying logic elsewhere.

# Quality bar
- `python3 score.py middleware.ts` prints a value >= 0.9 to stdout (scored 0.0–1.0; higher = more FCP-reducing patterns present).
- The rewrite-vs-redirect pattern is used for the unauthenticated guard (static analysis check in score.py).
- The `x-audit-bypass` / `AUDIT_BYPASS_TOKEN` bypass header path is present and positioned before cookie parsing.
- `config.matcher` excludes `_next/static`, `_next/image`, and common asset extensions.
- Token parsing does not redundantly call `JSON.parse` on the outer cookie value.
- A public-route allowlist (constant or equivalent) is present and used for the guard condition.
- Real-browser FCP on authenticated routes targets < 1800 ms; Lighthouse performance score >= 0.9.
