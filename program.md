# Optimization Goal

Eliminate ~11.4 kB of dead-weight ES2019–ES2022 polyfills shipped by chunk `117-9bcfe95f89d4b2e1.js` on every page load, reducing Lighthouse `legacy-javascript-insight` wastedBytes to 0 across all routes.

# Asset Description

`tsconfig.json` is the TypeScript compiler configuration for a Next.js 14 project (`aido-system`). It sets `target: "ES2022"` and `module: "esnext"`, which should tell bundlers that modern JS syntax and built-ins are available natively. The project depends on `@supabase/ssr` and `@supabase/supabase-js`, which are the primary suspects for bundling their own polyfill layer regardless of the browserslist target. Despite the ES2022 target being set, seven ES2019–ES2022 methods (Array.at, Array.flat, Array.flatMap, Object.fromEntries, Object.hasOwn, String.trimStart, String.trimEnd) are being polyfilled in every page's JS bundle, adding ~11,669 bytes of waste per route across 11 Lighthouse-audited routes (baseline score approximately -128,395).

# What you MAY change

- `tsconfig.json` — adjust `target`, `lib`, or `compilerOptions` to more explicitly signal ES2022+ capability; for example change `lib` from `["dom","dom.iterable","esnext"]` to `["dom","dom.iterable","ES2022"]` if it helps tree-shaking, or upgrade `target` to `ES2023`/`ESNext`
- `next.config.mjs` — add `transpilePackages`, `modularizeImports`, webpack `resolve.alias`, custom webpack config, or `experimental.esmExternals` to prevent polyfill bundles from being included
- `package.json` — add a `browserslist` field targeting modern browsers that natively support ES2022 (e.g. `"last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, not dead"`) to signal to SWC/Babel/webpack that polyfills are unnecessary
- New config files such as `.browserslistrc` or `babel.config.js` if needed to configure polyfill elimination
- `postcss.config.js` / `tailwind.config.js` — changes here are unlikely to help but are not restricted

# What you MUST NOT change

- The TypeScript `target` must remain at `ES2022` or higher — `score.py` applies a -50,000 prerequisite penalty if `target` drops below ES2022 (valid values: `es2022`, `es2023`, `es2024`, `es2025`, `esnext`)
- Application logic in `app/`, `components/`, `lib/`, `supabase/`, `system/`, and `middleware.ts` — functional behavior must be preserved
- Lighthouse report files (`lh-*.json`) — these are the scoring ground truth; do not create, modify, or delete them
- `score.py` — the scoring script must not be altered
- The project must still build successfully (`next build`) without TypeScript errors
- Do NOT downgrade any dependency to an older version that lacks ES2022 features used in the codebase

# Strategy hints

1. **Add `browserslist` to `package.json`**: Set `"browserslist": ["chrome >= 107", "firefox >= 108", "safari >= 16", "edge >= 107"]` (all ship with full ES2022 support). Next.js/SWC reads this when deciding what transforms and polyfills to inject — without an explicit target it defaults to a wide compatibility list that polyfills Array.at, Object.fromEntries, etc. This single change is the most likely fix.

2. **Configure `next.config.mjs` to transpile Supabase packages with the project's own target**: Add `transpilePackages: ["@supabase/supabase-js", "@supabase/ssr", "@supabase/realtime-js"]` so Next.js applies the project's browserslist when compiling those packages instead of letting them ship their pre-built polyfill-laden bundles. Combine with `swcMinify: true` to ensure dead polyfill code is removed.

3. **Use `source-map-explorer` to pinpoint the polyfill source before making changes**: Run `next build` then `npx source-map-explorer .next/static/chunks/117-*.js` to confirm exactly which package (likely `@supabase/realtime-js`, `cross-fetch`, or `@supabase/node-fetch`) is injecting the polyfills. Once identified, use `resolve.alias` in webpack config to replace that package's polyfill entry with an empty module, or use `modularizeImports` to tree-shake it.

# Quality bar

Score = `-(total wastedBytes across all lh-*.json legacy-javascript-insight audits)`. Baseline is approximately -128,395 (11 routes x ~11,669 bytes each). A fix is considered successful when score reaches **0.0** (zero polyfill waste on every route). An intermediate improvement is meaningful if score rises above -64,000 (at least half the waste eliminated). The tsconfig `target` prerequisite must remain satisfied (no -50,000 penalty).
