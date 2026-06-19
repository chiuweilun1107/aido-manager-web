# Optimization Goal

Configure `next.config.mjs` with full critters critical-CSS options so that `score.py` awards maximum points for render-blocking mitigation, enabling Lighthouse to measure LCP, FCP, CLS, INP, and TTFB on authenticated dynamic routes via the AUDIT_BYPASS_TOKEN bypass.

# Asset Description

`middleware.ts` is a Next.js Edge middleware that guards every non-static route with a Supabase JWT check. It exposes a bypass hatch: if the request header `x-audit-bypass` matches the `AUDIT_BYPASS_TOKEN` environment variable, the middleware calls `NextResponse.next()` immediately, skipping authentication entirely. This allows Lighthouse (or any headless runner) to audit authenticated-only pages such as `/module/[code]` and `/request/[id]` without a real session cookie, simply by injecting the shared secret header.

`next.config.mjs` is the Next.js build configuration. It currently enables `experimental.optimizeCss: true` and an empty `experimental.critters: {}` object. `score.py` statically parses this file and awards fractional points for each critters sub-option that is present.

# What you MAY change

- `next.config.mjs` — add or expand the `critters` configuration object with any subset of the following keys to raise the score.py score:
  - `preload` (worth +0.15)
  - `pruneSource` (worth +0.10)
  - `mergeStylesheets` (worth +0.10)
  - `additionalStylesheets` (worth +0.10)
  - `inlineFonts` or `preloadFonts` (worth +0.05)
- The `AUDIT_BYPASS_TOKEN` environment variable value (in `.env.local` or equivalent) — setting or rotating it is safe as long as `middleware.ts` reads the same variable name.
- Lighthouse runner scripts or CI configuration that injects the `x-audit-bypass` header pointing at `/module/[code]` and `/request/[id]`.

# What you MUST NOT change

- `middleware.ts` authentication logic — the JWT validation path and the redirect to `/login` must remain intact for real user sessions. The bypass check at lines 7-10 already works correctly; do not alter its header name (`x-audit-bypass`) or the env-var name (`AUDIT_BYPASS_TOKEN`).
- The `matcher` pattern in `middleware.ts` — it correctly excludes static assets while protecting all dynamic routes.
- `score.py` — it is the scoring oracle and must not be modified.
- `optimizeCss: true` in `next.config.mjs` — required for the +0.30 base score; removing it collapses the score to at most 0.70.
- The `critters:` key itself — required for the +0.20 bonus; replacing it with a different structure loses that point.
- Application routes, Supabase schema, API handlers, or component files — performance measurement must not alter business logic.

# Strategy hints

1. **Expand critters options in one edit** — replace `critters: {}` with a fully populated object: `critters: { preload: 'swap', pruneSource: true, mergeStylesheets: true, additionalStylesheets: [], preloadFonts: true }`. This single change takes `score.py` from 0.50 (optimizeCss + critters keys only) to 1.00 (all seven signals present), clearing the quality bar in one step.

2. **Inject AUDIT_BYPASS_TOKEN for Lighthouse runs** — set `AUDIT_BYPASS_TOKEN` to any non-empty secret in `.env.local`, then launch Lighthouse with `--extra-headers '{"x-audit-bypass":"<token>"}'` and `--url` pointing at `http://localhost:3000/module/SOME_CODE` and `http://localhost:3000/request/SOME_ID`. This exercises the bypass path and produces real LCP/FCP/CLS/INP/TTFB numbers for both dynamic routes.

3. **Use representative fixture IDs for dynamic routes** — the routes `/module/[code]` and `/request/[id]` will 404 or render empty if the slug does not exist in the database. Before running Lighthouse, query Supabase (or use seed data from `app/api/seed`) to obtain at least one real `code` and one real `id`, then substitute those into the Lighthouse target URLs to get accurate render-performance data rather than error-page metrics.

# Quality bar

- `score.py next.config.mjs` outputs **1.0** (all seven critters signals detected).
- Lighthouse produces at least one complete report for `/module/[code]` and one for `/request/[id]`, both with non-null values for LCP, FCP, CLS, INP, and TTFB in authenticated context (bypass token accepted, HTTP 200 returned, no redirect to `/login`).
- No existing Lighthouse baseline files (`lh-*.json`, `lighthouse-report.json`) are overwritten; new reports are written to separate files (e.g., `lh-module.json`, `lh-request.json`).
