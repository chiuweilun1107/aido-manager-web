# Optimization Goal
Eliminate the 22.9 kB shared chunk loaded on every route by converting heavy dependencies (Supabase, UI shell components, large data modules) from static imports in layout files into dynamic imports or lazy-loaded components, achieving 0 kB unused JS in the critical path.

# Asset Description
`app/layout.tsx` is the Next.js root layout — it wraps every route in the application. Any module statically imported here is bundled into the shared initial chunk that ships to the browser on every page load, regardless of which route the user visits. The file currently imports only `Metadata` (type-only, zero runtime cost) and `globals.css` (pure CSS, no JS), making it a clean baseline. However, sub-layouts (`app/(auth)/layout.tsx`, `app/(system)/layout.tsx`) and page-level files likely contain the heavy static imports that end up in the shared chunk. The scorer (`app/score.py`) measures `app/layout.tsx` specifically, penalising any heavy static imports added there.

Heavy candidates found in the project:
- **Supabase**: `lib/supabase/` (`@supabase/ssr`, `@supabase/supabase-js`) — large SDK pulled in on every authenticated route
- **UI shell**: `components/Sidebar.tsx`, `components/TopBar.tsx` — client components with substantial sub-dependency trees
- **Data/config modules**: `lib/modules.ts`, `lib/rbac.ts`, `lib/chains.ts`, `lib/bpm.ts` — large static definition objects

# What you MAY change
- Add `dynamic()` / `React.lazy()` / `import()` patterns anywhere in `app/layout.tsx` to wrap heavy components
- Add `<Suspense>` boundaries with appropriate fallback UI
- Convert client-heavy sub-components to server components where possible
- Split sub-layouts (`(auth)/layout.tsx`, `(system)/layout.tsx`) to isolate Supabase imports to routes that need them
- Introduce `next/dynamic` with `{ ssr: false }` for browser-only heavy components (e.g. rich editors, charts)
- Add `server-only` guard to modules that should never reach the client bundle
- Use `import type` instead of value imports wherever only TypeScript types are needed
- Move Supabase session logic into route handlers or Server Actions to avoid bundling the SDK client-side

# What you MUST NOT change
- The HTML structure `<html lang="zh-TW"><body>{children}</body></html>` in root layout — changing this breaks hydration and accessibility
- The `metadata` export object (`title: 'AiDo 智行'`, `description: '企業行政管理平台'`) — used by Next.js for `<head>` generation
- `globals.css` import — required for base Tailwind styles on every route
- Public-facing routes must remain functional: login, dashboard, approvals, notifications, module views
- TypeScript strict-mode compliance — no `any` escapes to satisfy types
- Supabase authentication must still work on protected routes; only the import location changes, not the logic
- The scorer file `app/score.py` must not be modified

# Strategy hints
1. **Keep root layout dead-simple (server component, no heavy imports)**: The root `app/layout.tsx` is already clean. Verify that sub-layouts (`(auth)/layout.tsx`, `(system)/layout.tsx`) do not re-export or re-import Supabase at the root level. If they do, wrap Supabase calls in a Server Action or a dedicated route segment so the SDK never enters the shared chunk.
2. **Lazy-load Sidebar and TopBar with `next/dynamic`**: These shell components are only rendered on authenticated pages. Wrap them with `const Sidebar = dynamic(() => import('../components/Sidebar'), { ssr: false })` inside the `(system)` sub-layout and add a `<Suspense fallback={<div />}>` boundary — this alone can eliminate the heavy UI chunk from unauthenticated routes.
3. **Audit `lib/modules.ts` and `lib/rbac.ts` import sites**: These files likely contain large static arrays/objects. If they are imported at layout level (even indirectly via a context provider), move them behind a `dynamic()` import or lazy-initialise them inside a Server Component where they are only serialised to the client on demand.

# Quality bar
- `python3 app/score.py app/layout.tsx` returns **100** (currently at 100; must stay at 100 after any changes)
- Next.js build (`next build`) completes with **0 TypeScript errors** and **0 ESLint errors**
- The 22.9 kB shared chunk drops to **< 5 kB** as measured by `next build` bundle analysis or Lighthouse JS coverage
- All existing routes (login, dashboard, approvals, notifications, module views) render correctly with no console errors
- Lighthouse Performance score on `/dashboard` remains >= the baseline captured in `lh-dashboard.json`
