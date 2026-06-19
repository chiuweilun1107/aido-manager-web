# Optimization Goal

Eliminate the ~11 KiB of legacy-javascript polyfills injected by webpack into chunk `117-9bcfe95f89d4b2e1.js` by aligning the SWC/Browserslist transpilation target with the ES2022 baseline already declared in `tsconfig.json`.

# Asset Description

`117-9bcfe95f89d4b2e1.js` is a webpack chunk loaded on every audited route. Lighthouse `legacy-javascript` insight reports score 0 and estimates ~11 KiB of wasted bytes per route (baseline score: -10674). The polyfilled APIs — `Array.prototype.at`, `Object.hasOwn`, and similar ES2022 builtins — are natively supported in all modern browsers. `tsconfig.json` already declares `target: "ES2022"`, but the SWC/Babel transpilation layer used by Next.js respects the **Browserslist** configuration (`.browserslistrc`, `package.json > browserslist`, or `next.config` `experimental.browsersListForSwc`), not `tsconfig.target`. If Browserslist resolves to a legacy baseline (e.g., the `"defaults"` preset covering IE 11 / old Safari), Next.js instructs SWC to inject `core-js` polyfills for APIs the target browsers lack — even though the production audience only uses modern browsers. Additionally, `critters` (^0.0.23, listed in `dependencies`) ships with an optional `core-js` peer; if it resolves an unconditional `core-js` import transitively, those polyfills appear regardless of Browserslist.

# What you MAY change

- `package.json` — add a top-level `"browserslist"` field targeting modern browsers, e.g.: `["last 2 Chrome versions", "last 2 Firefox versions", "last 2 Safari versions", "last 2 Edge versions"]`
- `next.config.mjs` — set `experimental.browsersListForSwc: true` so Next.js SWC reads Browserslist instead of falling back to a built-in legacy preset; optionally add other SWC tuning flags
- `.browserslistrc` — create this file as an alternative to the `package.json` `"browserslist"` field (do not create both; prefer `package.json` field for single-file clarity)
- `next.config.mjs` — add `@next/bundle-analyzer` wrapper (dev mode only) to inspect which module pulls `core-js` unconditionally
- `package.json` `devDependencies` — add `@next/bundle-analyzer` (dev only, does not affect production bundle)
- Any source file in `app/`, `components/`, or `lib/` that contains an explicit `import 'core-js/...'` or `require('core-js')` statement — remove or guard behind a runtime feature-detect

# What you MUST NOT change

- `tsconfig.json` — already correct (`target: "ES2022"`); do not touch
- `score.py` — the scoring script must not be modified
- `middleware.ts` — authentication and redirect logic must remain intact; all protected routes must continue to redirect unauthenticated users
- `lib/supabase/server.ts` and `lib/supabase/client.ts` — server/client Supabase access patterns and exported types must not break
- `supabase/` directory — schema, migrations, and seed files are out of scope
- Existing Lighthouse JSON report files (`lh-*.json`, `lighthouse-report.json`) — baseline artefacts; do not delete or overwrite (write post-optimisation reports as new files)
- `tailwind.config.js`, `postcss.config.js` — unrelated build tooling
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Runtime behaviour: authentication flow, API route responses, and page content must be identical before and after the change
- TypeScript types and interfaces exported from `lib/` consumed across the codebase

# Strategy hints

1. **Add modern Browserslist in `package.json` and enable `browsersListForSwc`**: Add `"browserslist": ["last 2 Chrome versions", "last 2 Firefox versions", "last 2 Safari versions", "last 2 Edge versions"]` to `package.json`, and set `experimental.browsersListForSwc: true` in `next.config.mjs`. This tells SWC to stop polyfilling ES2022 builtins (`Array.prototype.at`, `Object.hasOwn`, etc.) because the target browsers already support them natively. Run `next build` and re-run Lighthouse to confirm chunk `117-9bcfe95f89d4b2e1.js` disappears or carries 0 KiB wasted.

2. **Audit `critters` for unconditional `core-js` imports**: The `critters` package (^0.0.23) is in `dependencies` and can transitively pull `core-js`. Use `ANALYZE=true next build` with `@next/bundle-analyzer` to trace the import chain. If `critters` unconditionally imports `core-js`, pin to a version that does not, or add a `package.json` `overrides` entry to redirect the resolution.

3. **Search for direct `core-js` imports in source**: Run `grep -r "core-js\|regenerator-runtime" app/ components/ lib/` to find any explicit polyfill imports in application code. These bypass Browserslist entirely and force polyfills into the bundle regardless of SWC configuration. Remove or replace them with native ES2022 calls, since `tsconfig.json` already guarantees the ES2022 baseline at compile time.

# Quality bar

- Score formula: `+1000` (tsconfig ES2022 target already present) `+` up to `+800` (modern Browserslist config bonuses) `-` average `wastedBytes` of the legacy-polyfill chunk across all Lighthouse routes; baseline is `-10674`, target is `+1500` or better
- Lighthouse `legacy-javascript` insight reports 0 KiB wasted on every audited route (chunk `117-9bcfe95f89d4b2e1.js` either disappears or carries 0 wasted bytes)
- `next build` completes without TypeScript errors (`tsc --noEmit` exits 0)
- No existing route returns a non-200 HTTP status that was 200 before the change
- Total JS transfer per page must not increase relative to baseline
