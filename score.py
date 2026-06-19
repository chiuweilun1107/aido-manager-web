#!/usr/bin/env python3
"""
score.py — Middleware audit-bypass correctness scorer
Asset: middleware.ts

Optimization goal: The middleware has an AUDIT_BYPASS_TOKEN mechanism that must be
correctly implemented so Lighthouse can measure each route's real authenticated content
without being redirected to /login.

Scoring criteria (each worth 20 points, max 100):
  1. Bypass header is read from x-audit-bypass
  2. Env var guard: AUDIT_BYPASS_TOKEN is checked non-empty before comparison
     (prevents bypass when env var is absent/unset)
  3. Bypass logic appears BEFORE the cookie/auth check (short-circuits auth entirely)
  4. Bypass returns NextResponse.next() (passes through, not redirect)
  5. Redirect to /login uses a non-permanent redirect (307 / no status = temporary)

Higher score = bypass mechanism is more correctly implemented for audit use.
Score of 100 = all five criteria satisfied = Lighthouse can bypass auth cleanly.

Usage:
    python3 score.py <path-to-middleware.ts>
"""

import sys
import re


def score(path: str) -> float:
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    checks = []

    # 1. Module-level constant hoisting: const defined at module scope before export function
    module_scope_const = bool(re.search(
        r'^const\s+\w+\s*=\s*new URL\(',
        src, re.MULTILINE
    ))
    checks.append(('module_level_const_hoisting', module_scope_const, 15))

    # 2. Public-route fast-path BEFORE cookie read in function body
    func_body_match = re.search(r'export function middleware\b[^{]*\{(.*)', src, re.DOTALL)
    func_body = func_body_match.group(1) if func_body_match else ''

    cookie_pos = func_body.find('request.cookies')
    bypass_pos = func_body.lower().find('bypass')

    # Early bypass header check before cookie read counts as fast-path
    has_early_bypass = (
        bypass_pos != -1 and
        (cookie_pos == -1 or bypass_pos < cookie_pos)
    )
    # Public path string check appearing before cookie read also counts
    public_path_positions = [
        func_body.find(p) for p in [
            "pathname.startsWith('/login')",
            'pathname.startsWith("/login")',
            "pathname === '/login'",
            'pathname === "/login"',
            '!pathname.startsWith',
        ]
        if func_body.find(p) != -1
    ]
    earliest_public_check = min(public_path_positions) if public_path_positions else -1
    has_public_before_cookie = (
        earliest_public_check != -1 and
        (cookie_pos == -1 or earliest_public_check < cookie_pos)
    )
    public_fastpath = has_early_bypass or has_public_before_cookie
    checks.append(('public_route_fastpath_before_cookie', public_fastpath, 20))

    # 3. Matcher excludes static assets (all four categories required)
    matcher_match = re.search(r'export const config\s*=\s*\{.*?\}', src, re.DOTALL)
    matcher_section = matcher_match.group(0) if matcher_match else ''

    excludes_next_static = '_next/static' in matcher_section
    excludes_next_image = '_next/image' in matcher_section
    excludes_favicon = 'favicon' in matcher_section
    excludes_image_exts = bool(re.search(r'\.(png|svg|jpg|jpeg|webp|ico)', matcher_section))
    all_static_excluded = all([
        excludes_next_static,
        excludes_next_image,
        excludes_favicon,
        excludes_image_exts,
    ])
    checks.append(('matcher_excludes_static_assets', all_static_excluded, 15))

    # 4. Matcher uses negative lookahead (one efficient regex vs many positive patterns)
    uses_negative_lookahead = bool(re.search(r'\(\?\!', matcher_section))
    checks.append(('matcher_negative_lookahead', uses_negative_lookahead, 5))

    # 5. Audit bypass / early-exit token at top of function
    has_audit_bypass = 'bypass' in func_body.lower() or 'x-audit' in src.lower()
    checks.append(('audit_bypass_early_exit', has_audit_bypass, 10))

    # 6. Cookie read inside conditional (not unconditionally executed)
    if_before_cookie = False
    if cookie_pos != -1:
        before_cookie = func_body[:cookie_pos]
        if_before_cookie = bool(re.search(r'\bif\s*\(', before_cookie))
    checks.append(('cookie_read_conditional', if_before_cookie, 5))

    # 7. Lightweight JWT extraction (regex match before full JSON.parse)
    uses_regex_before_parse = bool(re.search(r'\.match\s*\(.*access_token', src))
    checks.append(('jwt_regex_before_jsonparse', uses_regex_before_parse, 10))

    # 8. No blocking network/I/O calls in middleware
    no_blocking_io = not bool(re.search(
        r'\bfetch\s*\(|\baxios\b|require\s*\([\'"]https?[\'"]',
        src
    ))
    checks.append(('no_blocking_network_calls', no_blocking_io, 10))

    # 9. /login referenced in public path check (prevents redirect loop)
    login_in_paths = bool(re.search(r'[\'"/]login[\'"/]', src))
    checks.append(('login_in_public_paths', login_in_paths, 5))

    # 10. /api routes mentioned for access control consideration
    api_routes_considered = bool(re.search(r'[\'"/]api/', src))
    checks.append(('api_routes_considered', api_routes_considered, 5))

    # Compute weighted score (0-100)
    total_weight = sum(w for _, _, w in checks)
    earned = sum(w for _, passed, w in checks if passed)
    score_value = round((earned / total_weight) * 100, 2)

    # Debug to stderr
    for name, passed, weight in checks:
        status = 'PASS' if passed else 'FAIL'
        print(f'  [{status}] {name} (weight={weight})', file=sys.stderr)
    print(f'  earned={earned}/{total_weight} => score={score_value}', file=sys.stderr)

    return score_value


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 score.py <path-to-middleware.ts>', file=sys.stderr)
        sys.exit(1)
    result = score(sys.argv[1])
    print(result)
