# Optimization Goal

Reduce unused JavaScript at initial load so every route ships fewer than 10 kB of wasted bytes per chunk, achieved primarily by better code-splitting the large shared chunk (fd9d1056-9f91b5e418130764.js, 173 kB raw / 55 kB gzipped, 42% unused on /login).

# Asset Description

`next.config.mjs` is the Next.js 14 build configuration for AiDo 智行, an enterprise admin platform with four measured routes: `/login`, `/approvals`, `/dashboard`, and `/notifications`. The project uses the App Router with two route groups: `(auth)` (public, login only) and `(system)` (authenticated, all other pages). The system layout (`app/(system)/layout.tsx`) eagerly imports `Sidebar` and `TopBar` components, which pull in `lib/modules.ts`, `lib/rbac.ts`, and related files — these authenticated-only dependencies end up in the shared vendor chunk that is also sent to `/login`. The login page itself is a `'use client'` component that dynamically imports the Supabase client only on form submit (`await import('@/lib/supabase/client')`), so the Supabase SDK is already lazy. The scoring metric in `score.py` is CSS/critters-based (statically parses `next.config.mjs`), not unused-JS-based, so optimizations must target both the actual Lighthouse unused-JS audit results and the critters configuration signals scored by score.py.

# What you MAY change

- `next.config.mjs`: add or tune `experimental` flags (`optimizeCss`, critters sub-options such as `preload`, `pruneSource`, `mergeStylesheets`, `additionalStylesheets`, `preloadFonts`), or add a `webpack` callback for `SplitChunksPlugin` customization.
- `app/(auth)/login/page.tsx`: refactor imports, convert eagerly imported helpers to dynamic imports with `React.lazy` or `next/dynamic`, or reduce the component module graph footprint.
- `app/(system)/layout.tsx`: wrap `Sidebar` and/or `TopBar` with `next/dynamic` so authenticated-layout code is excluded from the login bundle.
- `components/Sidebar.tsx`, `components/TopBar.tsx`: convert internal heavy imports to dynamic or lazy where appropriate.
- `lib/*.ts` files: split large utility modules so route-specific exports are tree-shaken per entry point.
- Any new files (e.g., `components/SidebarLazy.tsx`, `lib/modules-core.ts`) that isolate route-specific code.
- `next.config.mjs` `webpack` callback: customize `optimization.splitChunks` to tune `minSize`, `cacheGroups`, or force route-level granularity.

# What you MUST NOT change

- The authentication logic in `middleware.ts` — cookie parsing, JWT validation, redirect rules, and the `AUDIT_BYPASS_TOKEN` bypass must remain byte-for-byte identical.
- The Supabase client lazy-import pattern already in `login/page.tsx` (`await import('@/lib/supabase/client')`) — this must stay dynamic.
- All visible UI and UX behavior: login form fields, demo-account buttons, Sidebar navigation, TopBar, page content on all four routes.
- The route structure: `(auth)/login`, `(system)/dashboard`, `(system)/approvals`, `(system)/notifications` must remain at the same URL paths.
- TypeScript types and interfaces exported from `lib/types.ts` — downstream consumers must not break.
- `score.py` — do not modify the scoring script itself.
- `tailwind.config.js`, `postcss.config.js`, `globals.css` — CSS pipeline must remain intact so critters can inline critical CSS.
- `package.json` dependency list — do not add or remove npm packages; only configuration-level changes are in scope.
- Do not remove `experimental.optimizeCss: true` or the `critters:` key — both are required for the score.py baseline.

# Strategy hints

1. **Dynamic-import the system layout's heavy components**: In `app/(system)/layout.tsx`, replace the static `import Sidebar from '@/components/Sidebar'` and `import TopBar from '@/components/TopBar'` with `next/dynamic` imports (`const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: true })`). Because `(auth)/login` and `(system)/*` are already separate route groups, Next.js can exclude the Sidebar/TopBar module graph from the login bundle entirely.

2. **Expand critters options in `next.config.mjs`**: The current config has `critters: {}` with no sub-options, so score.py awards only 0.50 points. Adding `preload: "swap"`, `pruneSource: true`, `mergeStylesheets: true`, and `preloadFonts: true` to the critters object raises score.py to 1.0 and also improves real CSS render-blocking behavior. This is a low-risk, config-only change that provides immediate score gains.

3. **Tune `splitChunks` in `next.config.mjs`**: Add a `webpack` callback that raises `optimization.splitChunks.minSize` and defines a `cacheGroup` that isolates `(system)` layout code into its own named chunk, preventing the login entry point from pulling in authenticated-route-only code. This directly targets the 42% unused bytes in the shared chunk on `/login`.

# Quality bar

- `python3 score.py next.config.mjs` returns >= 0.75 (current baseline 0.50; adding preload + pruneSource + mergeStylesheets + preloadFonts reaches 1.0).
- Mean normalized unused-JS score across login / approvals / dashboard / notifications reaches >= 0.80 (i.e., average wasted bytes per page <= 2 kB under the formula `max(0, 1 - wasted_bytes/10240)`).
- No single chunk ships more than 10 kB of unused bytes at initial load on any of the four measured pages.
- The largest shared chunk (currently 173 kB raw) splits so the login page receives no chunk larger than ~30 kB raw containing only authenticated-route code.
- Lighthouse total page transfer for /login stays at or below 120 kB (currently 100.4 kB — headroom exists but must not regress past the threshold).
- All four pages remain fully functional: login redirects to /dashboard on success, authenticated pages render Sidebar and TopBar with correct role-based navigation.
- `next.config.mjs` remains a valid ES module — `node --check next.config.mjs` passes.
