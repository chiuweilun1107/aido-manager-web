#!/usr/bin/env python3
"""
score.py - API Route Audit Exclusion Score
Asset: any file in the aido-web project (e.g. middleware.ts or score.py)

Optimization goal:
  Six API routes (/api/*) were included in the Lighthouse audit sweep but they
  return JSON, not HTML, so Lighthouse cannot produce valid performance scores.
  The audit configuration should use a route allowlist limited to HTML-rendering
  routes, or the score aggregation script should explicitly skip /api/* paths.

Score = composite 0..100 measuring how well API routes are excluded from audit:
  - [40 pts] No /api/* URLs appear as requestedUrl in any lh-*.json report
  - [30 pts] middleware.ts has a blanket /api exclusion (not just /api/seed)
  - [20 pts] middleware.ts has both /login AND /api in its public-route allowlist
  - [10 pts] All discovered lh-*.json report files target known HTML-only routes

Higher = better. Perfect = 100.0 (API routes fully excluded from audit scope).
Baseline: middleware only excludes /api/seed (not blanket) => 70.0.

Usage:
    python3 score.py <path-to-any-project-file>
"""

import sys
import json
import glob
import os
import re
from urllib.parse import urlparse


def find_project_root(asset_path):
    directory = os.path.dirname(os.path.abspath(asset_path))
    for _ in range(4):
        if glob.glob(os.path.join(directory, "lh-*.json")):
            return directory
        parent = os.path.dirname(directory)
        if parent == directory:
            break
        directory = parent
    return os.path.dirname(os.path.abspath(asset_path))


def check_lh_reports_for_api(lh_dir):
    pattern = os.path.join(lh_dir, "lh-*.json")
    report_files = sorted(glob.glob(pattern))
    total_count = len(report_files)
    api_count = 0
    for fpath in report_files:
        try:
            with open(fpath, encoding="utf-8") as fh:
                data = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue
        requested_url = data.get("requestedUrl", "")
        path = urlparse(requested_url).path if requested_url else ""
        if path.startswith("/api/"):
            api_count += 1
    html_only = (api_count == 0 and total_count > 0)
    return api_count, total_count, html_only


def check_middleware_api_exclusion(lh_dir):
    middleware_path = os.path.join(lh_dir, "middleware.ts")
    if not os.path.exists(middleware_path):
        return False, False
    try:
        with open(middleware_path, encoding="utf-8") as fh:
            content = fh.read()
    except OSError:
        return False, False
    blanket_api_re = re.compile(
        r"""pathname\.startsWith\s*\(\s*['"][/]api['"]\s*\)"""
        r"""|pathname\.startsWith\s*\(\s*['"][/]api/['"]\s*\)""",
        re.MULTILINE
    )
    has_blanket = bool(blanket_api_re.search(content))
    has_login = bool(re.search(r"""['"]/login['"]""", content))
    has_api_any = bool(re.search(r"""['"]/api""", content))
    has_login_and_api = has_login and has_api_any
    return has_blanket, has_login_and_api


def check_html_route_purity(lh_dir):
    pattern = os.path.join(lh_dir, "lh-*.json")
    report_files = sorted(glob.glob(pattern))
    if not report_files:
        return False
    for fpath in report_files:
        try:
            with open(fpath, encoding="utf-8") as fh:
                data = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue
        for key in ("requestedUrl", "finalUrl", "mainDocumentUrl"):
            url = data.get(key, "")
            if url:
                path = urlparse(url).path
                if path.startswith("/api/"):
                    return False
    return True


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-project-file>", file=sys.stderr)
        sys.exit(1)
    asset_path = sys.argv[1]
    lh_dir = find_project_root(asset_path)
    print(f"Project root: {lh_dir}", file=sys.stderr)

    api_count, total_count, html_only = check_lh_reports_for_api(lh_dir)
    print(f"lh-*.json files scanned: {total_count}", file=sys.stderr)
    print(f"API routes found in reports: {api_count}", file=sys.stderr)
    if total_count == 0:
        pts_no_api = 20.0
    elif html_only:
        pts_no_api = 40.0
    else:
        fraction_html = (total_count - api_count) / total_count
        pts_no_api = round(40.0 * fraction_html, 1)

    has_blanket, has_login_and_api = check_middleware_api_exclusion(lh_dir)
    print(f"middleware.ts blanket /api exclusion: {has_blanket}", file=sys.stderr)
    print(f"middleware.ts has both /login and /api: {has_login_and_api}", file=sys.stderr)
    pts_blanket = 30.0 if has_blanket else 0.0
    pts_login_api = 20.0 if has_login_and_api else 0.0

    all_html = check_html_route_purity(lh_dir)
    print(f"All lh-*.json URLs are HTML-only: {all_html}", file=sys.stderr)
    pts_html_purity = 10.0 if all_html else 0.0

    total = pts_no_api + pts_blanket + pts_login_api + pts_html_purity
    print(
        f"Component scores: no_api_in_reports={pts_no_api}, "
        f"blanket_exclusion={pts_blanket}, login_and_api={pts_login_api}, "
        f"html_purity={pts_html_purity}",
        file=sys.stderr
    )
    print(f"Total score: {total}", file=sys.stderr)
    print(float(total))


if __name__ == "__main__":
    main()
